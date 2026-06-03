import { NextRequest, NextResponse } from "next/server";
import { getPool, uuid } from "@/storage/database/mysql-client";

// GET /api/mistakes - 获取错题列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resolved = searchParams.get("resolved");
    const mistakeType = searchParams.get("type");

    const pool = getPool();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (resolved !== null && resolved !== undefined) {
      conditions.push("is_resolved = ?");
      params.push(resolved === "true" ? 1 : 0);
    }
    if (mistakeType) {
      conditions.push("mistake_type = ?");
      params.push(mistakeType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await pool.execute(
      `SELECT * FROM mistakes ${whereClause} ORDER BY created_at DESC LIMIT 100`,
      params as (string | number | null)[]
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询错题失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/mistakes - 添加错题
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pool = getPool();

    // Check if same word mistake already exists and is unresolved
    const [existing] = await pool.execute(
      `SELECT id, review_count FROM mistakes WHERE word = ? AND is_resolved = 0 LIMIT 1`,
      [body.word]
    );
    const existingRow = (existing as Record<string, unknown>[])[0];

    if (existingRow) {
      // Update review count instead of creating duplicate
      await pool.execute(
        `UPDATE mistakes SET review_count = review_count + 1, user_answer = ?, correct_answer = ? WHERE id = ?`,
        [body.user_answer || null, body.correct_answer || null, existingRow.id]
      );
      return NextResponse.json({ success: true, action: "updated" });
    }

    const id = uuid();
    await pool.execute(
      `INSERT INTO mistakes (id, word, mistake_type, user_answer, correct_answer, question_id, vocabulary_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.word,
        body.mistake_type || "meaning",
        body.user_answer || null,
        body.correct_answer || null,
        body.question_id || null,
        body.vocabulary_id || null,
      ]
    );

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "添加错题失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/mistakes - 标记错题为已解决
export async function PATCH(request: NextRequest) {
  try {
    const { id, is_resolved } = await request.json();
    const pool = getPool();

    if (is_resolved) {
      await pool.execute(
        `UPDATE mistakes SET is_resolved = 1, review_count = 0, resolved_at = NOW() WHERE id = ?`,
        [id]
      );
    } else {
      await pool.execute(
        `UPDATE mistakes SET is_resolved = 0, resolved_at = NULL WHERE id = ?`,
        [id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新错题失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
