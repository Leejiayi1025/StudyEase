import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { getPool, uuid } from "@/storage/database/mysql-client";

export async function POST(request: NextRequest) {
  try {
    const { content, sourceType, title } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "请提供有效的文本内容" }, { status: 400 });
    }

    const systemPrompt = `你是一位专业的英语学习分析专家。你的任务是：
1. 从给定的英语文本中提取出可能的练习题（阅读理解题、词汇题、语法题）
2. 提取文本中的重点词汇
3. 对每个重点词汇提供详细信息

请严格按照以下JSON格式返回，不要添加任何其他文字：
{
  "questions": [
    {
      "question_text": "题目内容",
      "options": {"A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D"},
      "correct_answer": "A",
      "explanation": "答案解析",
      "question_type": "reading/vocabulary/grammar"
    }
  ],
  "key_vocabulary": [
    {
      "word": "单词",
      "phonetic": "音标",
      "part_of_speech": "词性",
      "meaning": "中文释义",
      "example_sentence": "例句",
      "example_translation": "例句翻译",
      "common_phrases": [{"phrase": "搭配短语", "meaning": "短语释义"}],
      "word_forms": {"original": "原形", "past": "过去式", "past_participle": "过去分词", "gerund": "现在分词"}
    }
  ],
  "summary": "文本概要翻译"
}`;

    const responseContent = await callLLM(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `请分析以下英语文本，提取考题和重点词汇：\n\n${content}` },
      ],
      { temperature: 0.3 }
    );

    let analysisResult;
    try {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      analysisResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { questions: [], key_vocabulary: [], summary: "" };
    } catch {
      analysisResult = { questions: [], key_vocabulary: [], summary: responseContent };
    }

    // Save to database
    const pool = getPool();
    const materialId = uuid();

    await pool.execute(
      `INSERT INTO study_materials (id, title, content, source_type, analysis) VALUES (?, ?, ?, ?, ?)`,
      [materialId, title || "导入学习材料", content, sourceType || "text", JSON.stringify(analysisResult)]
    );

    // Save extracted questions
    if (analysisResult.questions?.length > 0) {
      for (const q of analysisResult.questions) {
        await pool.execute(
          `INSERT INTO questions (id, material_id, question_text, options, correct_answer, explanation, question_type)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid(),
            materialId,
            q.question_text,
            JSON.stringify(q.options),
            q.correct_answer,
            q.explanation,
            q.question_type || "reading",
          ]
        );
      }
    }

    // Save vocabulary (upsert to avoid duplicates)
    if (analysisResult.key_vocabulary?.length > 0) {
      for (const vocab of analysisResult.key_vocabulary) {
        const [existing] = await pool.execute(
          `SELECT id FROM vocabulary WHERE word = ? LIMIT 1`,
          [vocab.word]
        );
        const existingRow = (existing as Record<string, unknown>[])[0];

        if (existingRow) {
          await pool.execute(
            `UPDATE vocabulary SET phonetic = ?, part_of_speech = ?, meaning = ?, example_sentence = ?, example_translation = ?, common_phrases = ?, word_forms = ? WHERE id = ?`,
            [
              vocab.phonetic || null,
              vocab.part_of_speech || null,
              vocab.meaning,
              vocab.example_sentence || null,
              vocab.example_translation || null,
              vocab.common_phrases ? JSON.stringify(vocab.common_phrases) : null,
              vocab.word_forms ? JSON.stringify(vocab.word_forms) : null,
              existingRow.id,
            ]
          );
        } else {
          await pool.execute(
            `INSERT INTO vocabulary (id, word, phonetic, part_of_speech, meaning, example_sentence, example_translation, common_phrases, word_forms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuid(),
              vocab.word,
              vocab.phonetic || null,
              vocab.part_of_speech || null,
              vocab.meaning,
              vocab.example_sentence || null,
              vocab.example_translation || null,
              vocab.common_phrases ? JSON.stringify(vocab.common_phrases) : null,
              vocab.word_forms ? JSON.stringify(vocab.word_forms) : null,
            ]
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      material_id: materialId,
      questions_count: analysisResult.questions?.length || 0,
      vocabulary_count: analysisResult.key_vocabulary?.length || 0,
      analysis: analysisResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提取分析失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
