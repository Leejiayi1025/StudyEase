import { NextRequest, NextResponse } from "next/server";
import { getPool, uuid } from "@/storage/database/mysql-client";
import { requireAuth } from "@/lib/auth";

// GET /api/mistakes - 获取错题列表
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const resolved = searchParams.get("resolved");

    const pool = getPool();
    const conditions: string[] = ["user_id = ?"];
    const params: unknown[] = [user.id];

    if (resolved !== null && resolved !== undefined) {
      conditions.push("is_resolved = ?");
      params.push(resolved === "true" ? 1 : 0);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const [rows] = await pool.execute(`SELECT * FROM mistakes ${whereClause} ORDER BY created_at DESC LIMIT 100`, params as (string | number | null)[]);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询错题失败";
    return NextResponse.json({ error: message }, { status: message === '未登录' ? 401 : 500 });
  }
}

// POST /api/mistakes - 添加错题
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const pool = getPool();

    const [existing] = await pool.execute(`SELECT id, review_count FROM mistakes WHERE word = ? AND user_id = ? AND is_resolved = 0 LIMIT 1`, [body.word, user.id]);
    const existingRow = (existing as Record<string, unknown>[])[0];

    if (existingRow) {
      await pool.execute(`UPDATE mistakes SET review_count = review_count + 1, user_answer = ?, correct_answer = ? WHERE id = ?`, [body.user_answer || null, body.correct_answer || null, existingRow.id]);
      return NextResponse.json({ success: true, action: "updated" });
    }

    const id = uuid();
    await pool.execute(
      `INSERT INTO mistakes (id, user_id, word, mistake_type, user_answer, correct_answer, question_id, vocabulary_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user.id, body.word, body.mistake_type || "meaning", body.user_answer || null, body.correct_answer || null, body.question_id || null, body.vocabulary_id || null]
    );

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "添加错题失败";
    return NextResponse.json({ error: message }, { status: message === '未登录' ? 401 : 500 });
  }
}

// PATCH /api/mistakes - 更新错题
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { id, is_resolved } = await request.json();
    const pool = getPool();

    if (is_resolved) {
      await pool.execute(`UPDATE mistakes SET is_resolved = 1, review_count = 0, resolved_at = NOW() WHERE id = ? AND user_id = ?`, [id, user.id]);
    } else {
      await pool.execute(`UPDATE mistakes SET is_resolved = 0, resolved_at = NULL WHERE id = ? AND user_id = ?`, [id, user.id]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新错题失败";
    return NextResponse.json({ error: message }, { status: message === '未登录' ? 401 : 500 });
  }
}
