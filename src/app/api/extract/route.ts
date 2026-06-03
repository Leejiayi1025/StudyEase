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
    "original": "完整英文原文",
    "translation": "完整中文翻译",
    "sentences": [{"english":"英文句子","chinese":"中文翻译"}]
  },
  "questions": [
    {
      "question_text": "题目英文",
      "question_translation": "题目中文翻译",
      "question_type": "reading/cloze/vocabulary/translation/writing",
      "question_type_cn": "阅读理解/完型填空/词汇选择/翻译题/作文",
      "options": {"A":"","B":"","C":"","D":""},
      "options_translation": {"A":"","B":"","C":"","D":""},
      "correct_answer": "A",
      "explanation": "解析（英文+中文）",
      "socratic_hints": ["引导问题1 (中文翻译)", "引导问题2 (中文翻译)"]
    }
  ],
  "vocabulary": [
    {
      "word":"单词","phonetic":"音标","part_of_speech":"词性","meaning":"中文释义",
      "example_sentence":"原文例句","example_translation":"翻译",
      "source":"article/question/option",
      "common_phrases":[{"phrase":"搭配","meaning":"释义"}],
      "word_forms":{"past":"过去式","past_participle":"过去分词"}
    }
  ]
}

题型分类规则：
- reading: 阅读理解（根据文章回答问题）
- cloze: 完型填空（文章中有空格需要选词填入）
- vocabulary: 词汇选择（词义辨析、选词填空）
- translation: 翻译题（中译英或英译中）
- writing: 作文题（给出写作任务）

重要：
1. 选项必须翻译成中文
2. 每道题给出2-3条苏格拉底式引导问题（英文+中文翻译）
3. 提取文章/题目/选项中所有值得学习的单词
4. 如果是图片，先OCR识别所有文字再分析`;

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
            }),
            q.correct_answer, q.explanation, q.question_type || 'reading',
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
        ];
        if (existingRow) {
          await pool.execute(`UPDATE vocabulary SET phonetic=?, part_of_speech=?, meaning=?, example_sentence=?, example_translation=?, common_phrases=?, word_forms=? WHERE id=?`, [...vocabData, existingRow.id]);
        } else {
          await pool.execute(`INSERT INTO vocabulary (id, word, phonetic, part_of_speech, meaning, example_sentence, example_translation, common_phrases, word_forms) VALUES (?,?,?,?,?,?,?,?,?)`, [uuid(), vocab.word, ...vocabData]);
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
              { role: 'system', content: '你是英语词典。对每个单词返回JSON数组，格式：[{"word":"单词","phonetic":"音标","pos":"词性","meaning":"中文释义"}]。只返回JSON，不要其他文字。' },
              { role: 'user', content: chunk.join(', ') },
            ], { temperature: 0.1, maxTokens: 4096 });

            const jsonMatch = batchResponse.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              for (const item of parsed) {
                if (item.word && item.meaning) {
                  await pool.execute(
                    `INSERT IGNORE INTO vocabulary (id, word, phonetic, part_of_speech, meaning) VALUES (?, ?, ?, ?, ?)`,
                    [uuid(), item.word.toLowerCase(), item.phonetic || null, item.pos || null, item.meaning]
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
