import { NextRequest, NextResponse } from "next/server";
import { callLLM, type LLMContentBlock } from "@/lib/llm";
import { getPool, uuid } from "@/storage/database/mysql-client";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { content, imageData, imageMimeType, images, sourceType, title, save } = await request.json();

    // Support: text, single image (legacy), or multiple images
    const imageList: Array<{ data: string; mimeType: string }> = images || (imageData ? [{ data: imageData, mimeType: imageMimeType || 'image/png' }] : []);

    if (!content && imageList.length === 0) {
      return NextResponse.json({ error: "请提供文本内容或图片" }, { status: 400 });
    }

    // ===== If save=true, just save the provided analysis =====
    if (save && save.analysis) {
      const pool = getPool();
      const materialId = uuid();
      const analysisResult = save.analysis;
      const materialTitle = title || (imageList.length > 0 ? `图片导入 (${imageList.length}张)` : '导入学习材料');
      const materialContent = content || analysisResult.article?.original || `[图片导入 ${imageList.length}张]`;

      await pool.execute(
        `INSERT INTO study_materials (id, user_id, title, content, source_type, analysis) VALUES (?, ?, ?, ?, ?, ?)`,
        [materialId, user.id, materialTitle, materialContent, sourceType || (imageList.length > 0 ? 'image' : 'text'), JSON.stringify(analysisResult)]
      );

      // Save questions
      if (analysisResult.questions?.length > 0) {
        for (const q of analysisResult.questions) {
          const explanationFull = q.explanation_cn ? `${q.explanation}\n\n${q.explanation_cn}` : q.explanation;
          await pool.execute(
            `INSERT INTO questions (id, user_id, material_id, question_text, options, correct_answer, explanation, question_type, analysis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuid(), user.id, materialId, q.question_text, JSON.stringify({ options: q.options, options_translation: q.options_translation, question_translation: q.question_translation, socratic_hints: q.socratic_hints, question_type_cn: q.question_type_cn, explanation_cn: q.explanation_cn }), q.correct_answer, explanationFull, q.question_type || 'reading', JSON.stringify({ socratic_hints: q.socratic_hints })]
          );
        }
      }

      // Save vocabulary
      const savedWords = new Set<string>();
      if (analysisResult.vocabulary?.length > 0) {
        for (const vocab of analysisResult.vocabulary) {
          savedWords.add(vocab.word.toLowerCase());
          const [existing] = await pool.execute(`SELECT id FROM vocabulary WHERE word = ? LIMIT 1`, [vocab.word]);
          const existingRow = (existing as Record<string, unknown>[])[0];
          const vocabData = [vocab.phonetic || null, vocab.part_of_speech || null, vocab.meaning, vocab.example_sentence || null, vocab.example_translation || null, vocab.common_phrases ? JSON.stringify(vocab.common_phrases) : null, vocab.word_forms ? JSON.stringify(vocab.word_forms) : null, vocab.synonyms ? JSON.stringify(vocab.synonyms) : null, vocab.antonyms ? JSON.stringify(vocab.antonyms) : null];
          if (existingRow) {
            await pool.execute(`UPDATE vocabulary SET phonetic=?, part_of_speech=?, meaning=?, example_sentence=?, example_translation=?, common_phrases=?, word_forms=?, synonyms=?, antonyms=? WHERE id=?`, [...vocabData, existingRow.id]);
          } else {
            await pool.execute(`INSERT INTO vocabulary (id, user_id, word, phonetic, part_of_speech, meaning, example_sentence, example_translation, common_phrases, word_forms, synonyms, antonyms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [uuid(), user.id, vocab.word, ...vocabData]);
          }
        }
      }

      // Background word caching
      const fullText = analysisResult.article?.original || materialContent || '';
      const allWordsInText: string[] = (fullText.match(/[a-zA-Z]{3,}/g) || []).map((w: string) => w.toLowerCase());
      const uniqueWords: string[] = [...new Set(allWordsInText)].filter(w => w.length >= 3 && !savedWords.has(w));
      if (uniqueWords.length > 0) {
        (async () => {
          try {
            const [existingWords] = await pool.execute(`SELECT word FROM vocabulary WHERE word IN (${uniqueWords.map(() => '?').join(',')})`, uniqueWords as (string | number | null)[]);
            const existingSet = new Set((existingWords as Record<string, unknown>[]).map(r => String(r.word).toLowerCase()));
            const newWords = uniqueWords.filter((w: string) => !existingSet.has(w));
            if (newWords.length > 0) {
              for (let i = 0; i < newWords.length; i += 60) {
                const chunk = newWords.slice(i, i + 60);
                try {
                  const batchResponse = await callLLM([
                    { role: 'system', content: '你是英语词典。对每个单词返回JSON数组。词性用标准缩写：n. v. adj. adv. prep. conj. pron. det. int. 格式：[{"word":"单词","phonetic":"音标","pos":"n.","meaning":"中文释义","synonyms":[],"antonyms":[]}]。只返回JSON。' },
                    { role: 'user', content: chunk.join(', ') },
                  ], { temperature: 0.1, maxTokens: 4096 });
                  const jsonMatch = batchResponse.match(/\[[\s\S]*\]/);
                  if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    for (const item of parsed) {
                      if (item.word && item.meaning) {
                        await pool.execute(`INSERT IGNORE INTO vocabulary (id, user_id, word, phonetic, part_of_speech, meaning, synonyms, antonyms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [uuid(), user.id, item.word.toLowerCase(), item.phonetic || null, item.pos || null, item.meaning, item.synonyms ? JSON.stringify(item.synonyms) : null, item.antonyms ? JSON.stringify(item.antonyms) : null]);
                      }
                    }
                  }
                } catch { /* skip */ }
              }
            }
          } catch { /* ignore */ }
        })();
      }

      return NextResponse.json({ success: true, material_id: materialId, saved: true });
    }

    // ===== Analyze only (don't save yet) =====
    const systemPrompt = `你是英语学习分析专家，熟悉四六级考试题型。你的任务是从给定的英语文本或图片中提取完整内容。

重要规则：
1. 如果有多张图片，它们属于同一份材料，必须合并识别
2. 识别图片中的所有文字，一字不漏
3. 提取完整的题目（包括所有选项），不能只提取部分
4. 如果一道题跨越多张图片，必须合并成完整的一道题
5. 文章必须完整保留原文

严格按以下JSON格式返回：
{
  "article": {
    "original": "完整英文原文（所有图片/文本中的全部文字）",
    "translation": "完整中文翻译",
    "sentences": [{"english":"英文句子","chinese":"中文翻译"}]
  },
  "questions": [
    {
      "question_text": "题目完整原文",
      "question_translation": "题目中文翻译",
      "question_type": "reading/cloze/vocabulary/translation/writing",
      "question_type_cn": "阅读理解/完型填空/词汇选择/翻译题/作文",
      "options": {"A":"完整选项原文","B":"","C":"","D":""},
      "options_translation": {"A":"选项A中文翻译","B":"","C":"","D":""},
      "correct_answer": "A",
      "explanation": "英文解析",
      "explanation_cn": "中文解析",
      "socratic_hints": ["English hint (中文翻译)"]
    }
  ],
  "vocabulary": [
    {
      "word":"单词","phonetic":"音标","part_of_speech":"n./v./adj.等",
      "meaning":"中文释义","example_sentence":"原文例句","example_translation":"翻译",
      "source":"article/question/option",
      "synonyms":["同义词"],"antonyms":["反义词"],
      "common_phrases":[{"phrase":"搭配","meaning":"释义"}],
      "word_forms":{"past":"过去式","past_participle":"过去分词"}
    }
  ]
}

题型：reading=阅读理解 cloze=完型填空 vocabulary=词汇选择 translation=翻译题 writing=作文题
词性缩写：n. v. adj. adv. prep. conj. pron. det. int.`;

    let userContent: string | LLMContentBlock[];
    if (imageList.length > 0) {
      const blocks: LLMContentBlock[] = [];
      // Add text instruction first
      blocks.push({
        type: 'text' as const,
        text: `请识别以下${imageList.length}张图片中的所有英文文字。这些图片是同一份试卷的不同页面。请将所有图片的内容合并，提取完整的文章、题目和选项。如果题目跨越多张图片，请合并成完整的一道题。${content ? `\n补充：${content}` : ''}`,
      });
      // Add all images
      for (const img of imageList) {
        const mediaType = (img.mimeType || 'image/png') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        blocks.push({ type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: img.data } });
      }
      userContent = blocks;
    } else {
      userContent = `分析以下英语文本：\n\n${content}`;
    }

    const llmOptions = imageList.length > 0
      ? { temperature: 0.2, maxTokens: 8192, model: process.env.DASHSCOPE_VL_MODEL || 'qwen-vl-plus' }
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

    // Log for debugging
    console.log('[extract] AI response length:', responseContent.length, 'questions:', analysisResult.questions?.length, 'vocab:', analysisResult.vocabulary?.length);

    // If AI returned nothing useful, return error
    if (!analysisResult.questions?.length && !analysisResult.article?.original && !analysisResult.vocabulary?.length) {
      return NextResponse.json({
        success: false,
        error: 'AI未能识别内容，请确认图片清晰并重试',
        raw: responseContent.slice(0, 500),
      });
    }

    // Auto-categorize questions
    if (analysisResult.questions) {
      const typeMap: Record<string, string> = { reading: '阅读理解', cloze: '完型填空', vocabulary: '词汇选择', translation: '翻译题', writing: '作文题' };
      for (const q of analysisResult.questions) {
        if (!q.question_type) q.question_type = 'reading';
        if (!q.question_type_cn) q.question_type_cn = typeMap[q.question_type] || '阅读理解';
      }
    }

    return NextResponse.json({
      success: true,
      analysis: analysisResult,
      saved: false,
      questions_count: analysisResult.questions?.length || 0,
      vocabulary_count: analysisResult.vocabulary?.length || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提取分析失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
