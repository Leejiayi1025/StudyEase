import { NextRequest, NextResponse } from "next/server";
import { callLLM, type LLMContentBlock } from "@/lib/llm";
import { getPool, uuid } from "@/storage/database/mysql-client";

export async function POST(request: NextRequest) {
  try {
    const { content, imageData, imageMimeType, images, sourceType, title } = await request.json();

    // Support: text, single image (legacy), or multiple images
    const imageList: Array<{ data: string; mimeType: string }> = images || (imageData ? [{ data: imageData, mimeType: imageMimeType || 'image/png' }] : []);

    if (!content && imageList.length === 0) {
      return NextResponse.json({ error: "请提供文本内容或图片" }, { status: 400 });
    }

    const systemPrompt = `你是英语学习分析专家，熟悉四六级考试题型。对给定的英语文本/图片做全面分析。

严格按以下JSON格式返回，不要添加其他文字：
{
  "article": {
    "original": "完整英文原文（一字不漏，保留所有内容）",
    "translation": "完整中文翻译（逐句对应）",
    "sentences": [{"english":"英文句子","chinese":"中文翻译"}]
  },
  "questions": [
    {
      "question_text": "题目英文原文（完整保留）",
      "question_translation": "题目中文翻译",
      "question_type": "reading/cloze/vocabulary/translation/writing",
      "question_type_cn": "阅读理解/完型填空/词汇选择/翻译题/作文",
      "options": {"A":"英文选项完整原文","B":"","C":"","D":""},
      "options_translation": {"A":"选项A中文翻译","B":"","C":"","D":""},
      "correct_answer": "A",
      "explanation": "英文解析",
      "explanation_cn": "中文解析翻译",
      "socratic_hints": ["English hint 1 (中文翻译)", "English hint 2 (中文翻译)"]
    }
  ],
  "vocabulary": [
    {
      "word":"单词","phonetic":"音标","part_of_speech":"n./v./adj./adv.等标准缩写",
      "meaning":"中文释义",
      "example_sentence":"原文例句","example_translation":"例句翻译",
      "source":"article/question/option",
      "synonyms":["同义词1","同义词2"],
      "antonyms":["反义词1"],
      "common_phrases":[{"phrase":"搭配","meaning":"释义"}],
      "word_forms":{"past":"过去式","past_participle":"过去分词","gerund":"现在分词"}
    }
  ]
}

规则：
1. article.original 必须是完整原文，不能省略任何内容
2. article.sentences 逐句翻译，每句都要
3. 选项必须翻译成中文
4. explanation 必须有英文+中文（explanation_cn）
5. 每道题给出2-3条苏格拉底式引导（英文+中文翻译）
6. 词性必须用标准缩写：n. v. adj. adv. prep. conj. pron. det. int.
7. 同义词反义词尽量提供
8. 如果是图片，先OCR识别所有文字再分析`;

    // Build user content
    let userContent: string | LLMContentBlock[];

    if (imageList.length > 0) {
      // Multiple images mode
      const blocks: LLMContentBlock[] = [];
      for (const img of imageList) {
        const mediaType = (img.mimeType || 'image/png') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        blocks.push({
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: mediaType, data: img.data },
        });
      }
      blocks.push({
        type: 'text' as const,
        text: content
          ? `识别图片中的英文文本并分析。补充：${content}`
          : `识别这些图片中的所有英文文本。这些可能是四六级考试题目（阅读理解、完型填空、词汇选择、翻译题等）。请：1)识别所有文字 2)按题型分类 3)逐句翻译 4)提取所有生词 5)给出苏格拉底式引导`,
      });
      userContent = blocks;
    } else {
      userContent = `分析以下英语文本（可能是四六级考试题）：\n\n${content}`;
    }

    // Text用 DeepSeek V3，图片用 Qwen-VL
    const llmOptions = imageList.length > 0
      ? { temperature: 0.2, maxTokens: 6144, model: process.env.DASHSCOPE_VL_MODEL || 'qwen-vl-plus' }
      : { temperature: 0.2, maxTokens: 6144 };

    const responseContent = await callLLM(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
      llmOptions
    );

    let analysisResult;
    try {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      analysisResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { article: null, questions: [], vocabulary: [] };
    } catch {
      analysisResult = { article: { original: content || '', translation: '', sentences: [] }, questions: [], vocabulary: [] };
    }

    // Auto-categorize questions if AI didn't
    if (analysisResult.questions) {
      for (const q of analysisResult.questions) {
        if (!q.question_type) q.question_type = 'reading';
        if (!q.question_type_cn) {
          const typeMap: Record<string, string> = { reading: '阅读理解', cloze: '完型填空', vocabulary: '词汇选择', translation: '翻译题', writing: '作文题' };
          q.question_type_cn = typeMap[q.question_type] || '阅读理解';
        }
      }
    }

    // Save to database
    const pool = getPool();
    const materialId = uuid();
    const materialTitle = title || (imageList.length > 0 ? `图片导入 (${imageList.length}张)` : '导入学习材料');
    const materialContent = content || `[图片导入 ${imageList.length}张]`;

    await pool.execute(
      `INSERT INTO study_materials (id, title, content, source_type, analysis) VALUES (?, ?, ?, ?, ?)`,
      [materialId, materialTitle, materialContent, sourceType || (imageList.length > 0 ? 'image' : 'text'), JSON.stringify(analysisResult)]
    );

    // Save questions with type classification
    if (analysisResult.questions?.length > 0) {
      for (const q of analysisResult.questions) {
        const explanationFull = q.explanation_cn
          ? `${q.explanation}\n\n${q.explanation_cn}`
          : q.explanation;
        await pool.execute(
          `INSERT INTO questions (id, material_id, question_text, options, correct_answer, explanation, question_type, analysis)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid(), materialId, q.question_text,
            JSON.stringify({
              options: q.options,
              options_translation: q.options_translation,
              question_translation: q.question_translation,
              socratic_hints: q.socratic_hints,
              question_type_cn: q.question_type_cn,
              explanation_cn: q.explanation_cn,
            }),
            q.correct_answer, explanationFull, q.question_type || 'reading',
            JSON.stringify({ socratic_hints: q.socratic_hints }),
          ]
        );
      }
    }

    // Save AI-extracted vocabulary (upsert)
    const savedWords = new Set<string>();
    if (analysisResult.vocabulary?.length > 0) {
      for (const vocab of analysisResult.vocabulary) {
        savedWords.add(vocab.word.toLowerCase());
        const [existing] = await pool.execute(`SELECT id FROM vocabulary WHERE word = ? LIMIT 1`, [vocab.word]);
        const existingRow = (existing as Record<string, unknown>[])[0];
        const vocabData = [
          vocab.phonetic || null, vocab.part_of_speech || null, vocab.meaning,
          vocab.example_sentence || null, vocab.example_translation || null,
          vocab.common_phrases ? JSON.stringify(vocab.common_phrases) : null,
          vocab.word_forms ? JSON.stringify(vocab.word_forms) : null,
          vocab.synonyms ? JSON.stringify(vocab.synonyms) : null,
          vocab.antonyms ? JSON.stringify(vocab.antonyms) : null,
        ];
        if (existingRow) {
          await pool.execute(`UPDATE vocabulary SET phonetic=?, part_of_speech=?, meaning=?, example_sentence=?, example_translation=?, common_phrases=?, word_forms=?, synonyms=?, antonyms=? WHERE id=?`, [...vocabData, existingRow.id]);
        } else {
          await pool.execute(`INSERT INTO vocabulary (id, word, phonetic, part_of_speech, meaning, example_sentence, example_translation, common_phrases, word_forms, synonyms, antonyms) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [uuid(), vocab.word, ...vocabData]);
        }
      }
    }

    // ===== Pre-cache ALL words from the article =====
    // Extract all English words from the text
    const fullText = analysisResult.article?.original || content || '';
    const allWordsInText: string[] = (fullText.match(/[a-zA-Z]{3,}/g) || []).map((w: string) => w.toLowerCase());
    const uniqueWords: string[] = [...new Set(allWordsInText)].filter(w => w.length >= 3 && !savedWords.has(w));

    if (uniqueWords.length > 0) {
      // Check which words already exist in DB
      const [existingWords] = await pool.execute(
        `SELECT word FROM vocabulary WHERE word IN (${uniqueWords.map(() => '?').join(',')})`,
        uniqueWords as (string | number | null)[]
      );
      const existingSet = new Set((existingWords as Record<string, unknown>[]).map(r => String(r.word).toLowerCase()));
      const newWords = uniqueWords.filter((w: string) => !existingSet.has(w));

      // Batch translate new words with AI (chunks of 60)
      if (newWords.length > 0) {
        const CHUNK_SIZE = 60;
        for (let i = 0; i < newWords.length; i += CHUNK_SIZE) {
          const chunk = newWords.slice(i, i + CHUNK_SIZE);
          try {
            const batchResponse = await callLLM([
              { role: 'system', content: '你是英语词典。对每个单词返回JSON数组。词性用标准缩写：n.名词 v.动词 adj.形容词 adv.副词 prep.介词 conj.连词 pron.代词 det.冠词 int.感叹词。格式：[{"word":"单词","phonetic":"音标","pos":"n./v./adj.等","meaning":"中文释义","synonyms":["同义词1","同义词2"],"antonyms":["反义词1"]}]。只返回JSON。' },
              { role: 'user', content: chunk.join(', ') },
            ], { temperature: 0.1, maxTokens: 4096 });

            const jsonMatch = batchResponse.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              for (const item of parsed) {
                if (item.word && item.meaning) {
                  await pool.execute(
                    `INSERT IGNORE INTO vocabulary (id, word, phonetic, part_of_speech, meaning, synonyms, antonyms) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                      uuid(), item.word.toLowerCase(), item.phonetic || null, item.pos || null, item.meaning,
                      item.synonyms ? JSON.stringify(item.synonyms) : null,
                      item.antonyms ? JSON.stringify(item.antonyms) : null,
                    ]
                  );
                }
              }
            }
          } catch {
            // Batch failed, skip - words will be translated on click
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      material_id: materialId,
      questions_count: analysisResult.questions?.length || 0,
      vocabulary_count: analysisResult.vocabulary?.length || 0,
      analysis: analysisResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提取分析失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
