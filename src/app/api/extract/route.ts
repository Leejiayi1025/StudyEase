import { NextRequest, NextResponse } from "next/server";
import { callLLM, type LLMContentBlock } from "@/lib/llm";
import { getPool, uuid } from "@/storage/database/mysql-client";

export async function POST(request: NextRequest) {
  try {
    const { content, imageData, imageMimeType, sourceType, title } = await request.json();

    if (!content && !imageData) {
      return NextResponse.json({ error: "请提供文本内容或图片" }, { status: 400 });
    }

    const systemPrompt = `你是英语学习分析专家。对给定的英语文本做全面分析。

严格按以下JSON格式返回，不要添加其他文字：
{
  "article": {
    "original": "完整英文原文（清理排版后）",
    "translation": "完整中文翻译",
    "sentences": [
      {"english": "英文句子1", "chinese": "中文翻译1"},
      {"english": "英文句子2", "chinese": "中文翻译2"}
    ]
  },
  "questions": [
    {
      "question_text": "题目英文",
      "question_translation": "题目中文翻译",
      "options": {"A": "英文选项A", "B": "英文选项B", "C": "英文选项C", "D": "英文选项D"},
      "options_translation": {"A": "中文翻译A", "B": "中文翻译B", "C": "中文翻译C", "D": "中文翻译D"},
      "correct_answer": "A",
      "explanation": "答案解析（英文+中文）",
      "socratic_hints": [
        "Think about what the passage says about... (想想文章中关于...说了什么)",
        "Look back at paragraph X where it mentions... (回到第X段，它提到了...)",
        "Can you find a keyword in the question that matches the passage? (你能找到题目中和文章对应的关键词吗？)"
      ]
    }
  ],
  "vocabulary": [
    {
      "word": "单词",
      "phonetic": "音标",
      "part_of_speech": "词性",
      "meaning": "中文释义",
      "example_sentence": "来自原文的例句",
      "example_translation": "例句翻译",
      "source": "article/question/option",
      "common_phrases": [{"phrase": "搭配", "meaning": "释义"}],
      "word_forms": {"past": "过去式", "past_participle": "过去分词", "gerund": "现在分词"}
    }
  ]
}

重要规则：
1. 文章：完整保留原文，逐句翻译
2. 题目：每道题的选项必须翻译成中文
3. 苏格拉底提示：每道题给出3条英文引导问题（附中文翻译），引导用户思考，不要直接告诉答案
4. 单词：提取文章、题目、选项中所有值得学习的词汇，标注来源
5. 如果是图片，先OCR识别文字再分析`;

    // Build user message
    let userContent: string | LLMContentBlock[];
    if (imageData) {
      const mediaType = (imageMimeType || 'image/png') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      userContent = [
        { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: imageData } },
        { type: 'text' as const, text: content ? `识别图片并分析。补充：${content}` : '识别图片中的英文文本，做全面分析：逐句翻译、提取所有生词、出题并给出苏格拉底式引导。' },
      ];
    } else {
      userContent = `分析以下英语文本：\n\n${content}`;
    }

    // 图片识别用 Anthropic (mimo)，文本用 DashScope (DeepSeek V3)
    const llmOptions = imageData
      ? { temperature: 0.2, maxTokens: 6144, model: process.env.ANTHROPIC_MODEL || 'mimo-v2.5-pro' }
      : { temperature: 0.2, maxTokens: 6144 };

    // 图片需要切换到 Anthropic provider
    const originalProvider = process.env.LLM_PROVIDER;
    if (imageData) {
      process.env.LLM_PROVIDER = 'anthropic';
    }

    const responseContent = await callLLM(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
      llmOptions
    );

    // 恢复 provider
    if (imageData) {
      process.env.LLM_PROVIDER = originalProvider || 'dashscope';
    }

    let analysisResult;
    try {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      analysisResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { article: null, questions: [], vocabulary: [] };
    } catch {
      analysisResult = { article: { original: content, translation: '', sentences: [] }, questions: [], vocabulary: [], summary: responseContent };
    }

    // Save to database
    const pool = getPool();
    const materialId = uuid();
    const materialTitle = title || (imageData ? "图片导入" : "导入学习材料");

    await pool.execute(
      `INSERT INTO study_materials (id, title, content, source_type, analysis) VALUES (?, ?, ?, ?, ?)`,
      [materialId, materialTitle, content || "[图片导入]", sourceType || (imageData ? "image" : "text"), JSON.stringify(analysisResult)]
    );

    // Save questions (with socratic hints)
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
            }),
            q.correct_answer, q.explanation, q.question_type || "reading",
            JSON.stringify({ socratic_hints: q.socratic_hints }),
          ]
        );
      }
    }

    // Save ALL vocabulary (upsert)
    if (analysisResult.vocabulary?.length > 0) {
      for (const vocab of analysisResult.vocabulary) {
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
