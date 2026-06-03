import { NextRequest, NextResponse } from "next/server";
import { callLLM, type LLMContentBlock } from "@/lib/llm";
import { getPool, uuid } from "@/storage/database/mysql-client";

export async function POST(request: NextRequest) {
  try {
    const { content, imageData, imageMimeType, sourceType, title } = await request.json();

    if (!content && !imageData) {
      return NextResponse.json({ error: "请提供文本内容或图片" }, { status: 400 });
    }

    const systemPrompt = `英语学习分析专家。从文本或图片中提取练习题和重点词汇。严格按JSON返回：
{"questions":[{"question_text":"题目","options":{"A":"","B":"","C":"","D":""},"correct_answer":"A","explanation":"解析","question_type":"reading/vocabulary/grammar"}],"key_vocabulary":[{"word":"单词","phonetic":"音标","part_of_speech":"词性","meaning":"中文释义","example_sentence":"例句","example_translation":"翻译","common_phrases":[{"phrase":"搭配","meaning":"释义"}],"word_forms":{"past":"过去式","past_participle":"过去分词","gerund":"现在分词"}}],"summary":"概要"}`;

    // Build user message - support text, image, or both
    let userContent: string | LLMContentBlock[];

    if (imageData) {
      // Image mode: send image as base64 to LLM
      const mediaType = (imageMimeType || 'image/png') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      const blocks: LLMContentBlock[] = [
        {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType,
            data: imageData,
          },
        },
        {
          type: 'text' as const,
          text: content
            ? `请识别图片中的英文文本并分析。补充上下文：${content}`
            : '请识别图片中的所有英文文本，提取其中的考试题目和重点词汇，并进行详细分析。',
        },
      ];
      userContent = blocks;
    } else {
      userContent = `请分析以下英语文本，提取考题和重点词汇：\n\n${content}`;
    }

    const responseContent = await callLLM(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      { temperature: 0.2, maxTokens: 4096 }
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
    const materialTitle = title || (imageData ? "图片导入" : "导入学习材料");
    const materialContent = content || "[图片导入]";

    await pool.execute(
      `INSERT INTO study_materials (id, title, content, source_type, analysis) VALUES (?, ?, ?, ?, ?)`,
      [materialId, materialTitle, materialContent, sourceType || (imageData ? "image" : "text"), JSON.stringify(analysisResult)]
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
