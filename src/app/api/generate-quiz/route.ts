import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { getPool, uuid } from "@/storage/database/mysql-client";

export async function POST(request: NextRequest) {
  try {
    const { words, quizType, count } = await request.json();

    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: "请提供单词列表" }, { status: 400 });
    }

    const quizCount = Math.min(count || 10, 20);
    const typeLabel = quizType === "spelling" ? "拼写" : quizType === "collocation" ? "搭配" : "词义";

    const systemPrompt = `英语出题专家。生成${typeLabel}测试题。严格按JSON返回：
{"quiz_type":"${quizType || "meaning"}","questions":[{"id":1,"word":"单词","type":"${quizType || "meaning"}","question":"题目","options":{"A":"","B":"","C":"","D":""},"correct_answer":"A","explanation":"解析"}]}
要求：选项有迷惑性，解析简明。`;

    const responseContent = await callLLM(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `请根据以下单词生成${quizCount}道${typeLabel}测试题：\n${words.join(", ")}` },
      ],
      { temperature: 0.3, maxTokens: 2048 }
    );

    let quizResult;
    try {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      quizResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { quiz_type: quizType, questions: [] };
    } catch {
      quizResult = { quiz_type: quizType, questions: [] };
    }

    // Update study progress
    const today = new Date().toISOString().split("T")[0];
    const pool = getPool();
    const [progressRows] = await pool.execute(
      `SELECT id, words_reviewed FROM study_progress WHERE date = ? LIMIT 1`,
      [today]
    );
    const progress = (progressRows as Record<string, unknown>[])[0];

    if (progress) {
      await pool.execute(
        `UPDATE study_progress SET words_reviewed = ? WHERE id = ?`,
        [(Number(progress.words_reviewed) || 0) + words.length, progress.id] as (string | number | null)[]
      );
    } else {
      await pool.execute(
        `INSERT INTO study_progress (id, date, words_reviewed) VALUES (?, ?, ?)`,
        [uuid(), today, words.length]
      );
    }

    return NextResponse.json({ success: true, quiz: quizResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成测试题失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
