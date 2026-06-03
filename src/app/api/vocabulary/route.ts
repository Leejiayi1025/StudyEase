import { NextRequest, NextResponse } from "next/server";
import { getPool, uuid } from "@/storage/database/mysql-client";
import { requireAuth } from "@/lib/auth";

// GET /api/vocabulary - 获取词汇列表
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const mastery = searchParams.get("mastery");
    const search = searchParams.get("search");
    const favorite = searchParams.get("favorite");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    const pool = getPool();
    const conditions: string[] = ["user_id = ?"];
    const params: unknown[] = [user.id];

    if (mastery !== null && mastery !== undefined && mastery !== "") {
      conditions.push("mastery_level = ?");
      params.push(parseInt(mastery));
    }
    if (search) {
      conditions.push("(word LIKE ? OR meaning LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (favorite === "true") {
      conditions.push("is_favorite = 1");
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [countRows] = await pool.execute(`SELECT COUNT(*) as count FROM vocabulary ${whereClause}`, params as (string | number | null)[]);
    const count = Number((countRows as Record<string, unknown>[])[0]?.count ?? 0);

    const offset = (page - 1) * pageSize;
    params.push(pageSize, offset);
    const [rows] = await pool.execute(
      `SELECT id, word, phonetic, part_of_speech, meaning, mastery_level, review_count, correct_count, difficulty, synonyms, antonyms, is_favorite FROM vocabulary ${whereClause} ORDER BY word ASC LIMIT ? OFFSET ?`,
      params as (string | number | null)[]
    );

    return NextResponse.json({ success: true, data: rows, total: count, page, pageSize });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询词汇失败";
    return NextResponse.json({ error: message }, { status: message === '未登录' ? 401 : 500 });
  }
}

// POST /api/vocabulary - 添加词汇
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const pool = getPool();
    const id = uuid();

    await pool.execute(
      `INSERT INTO vocabulary (id, user_id, word, phonetic, part_of_speech, meaning, example_sentence, example_translation, common_phrases, word_forms, difficulty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user.id, body.word, body.phonetic || null, body.part_of_speech || null, body.meaning, body.example_sentence || null, body.example_translation || null, body.common_phrases ? JSON.stringify(body.common_phrases) : null, body.word_forms ? JSON.stringify(body.word_forms) : null, body.difficulty || "medium"]
    );

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "添加词汇失败";
    return NextResponse.json({ error: message }, { status: message === '未登录' ? 401 : 500 });
  }
}

// PATCH /api/vocabulary - 更新词汇
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { id, mastery_level, increment_review, increment_correct, is_favorite } = await request.json();
    const pool = getPool();

    const updates: string[] = [];
    const params: unknown[] = [];

    if (typeof mastery_level === "number") {
      updates.push("mastery_level = ?");
      params.push(mastery_level);
    }
    if (increment_review) {
      updates.push("review_count = review_count + 1");
      updates.push("last_reviewed_at = NOW()");
    }
    if (increment_correct) {
      updates.push("correct_count = correct_count + 1");
    }
    if (typeof is_favorite === "number") {
      updates.push("is_favorite = ?");
      params.push(is_favorite);
    }

    if (updates.length === 0) return NextResponse.json({ success: true });

    params.push(id, user.id);
    await pool.execute(`UPDATE vocabulary SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`, params as (string | number | null)[]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新词汇失败";
    return NextResponse.json({ error: message }, { status: message === '未登录' ? 401 : 500 });
  }
}

// DELETE /api/vocabulary - 删除词汇
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { id } = await request.json();
    const pool = getPool();

    await pool.execute(`DELETE FROM vocabulary WHERE id = ? AND user_id = ?`, [id, user.id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除失败";
    return NextResponse.json({ error: message }, { status: message === '未登录' ? 401 : 500 });
  }
}
