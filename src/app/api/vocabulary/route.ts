import { NextRequest, NextResponse } from "next/server";
import { getPool, uuid } from "@/storage/database/mysql-client";

// GET /api/vocabulary - 获取词汇列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mastery = searchParams.get("mastery");
    const search = searchParams.get("search");
    const cet4Core = searchParams.get("cet4_core");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    const pool = getPool();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (mastery !== null && mastery !== undefined && mastery !== "") {
      conditions.push("mastery_level = ?");
      params.push(parseInt(mastery));
    }
    if (search) {
      conditions.push("(word LIKE ? OR meaning LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (cet4Core === "true") {
      conditions.push("is_cet4_core = 1");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count query
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as count FROM vocabulary ${whereClause}`,
      params as (string | number | null)[]
    );
    const count = Number((countRows as Record<string, unknown>[])[0]?.count ?? 0);

    // Data query
    const offset = (page - 1) * pageSize;
    const [rows] = await pool.execute(
      `SELECT id, word, phonetic, part_of_speech, meaning, mastery_level, is_cet4_core, review_count, correct_count, difficulty FROM vocabulary ${whereClause} ORDER BY word ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset] as (string | number | null)[]
    );

    return NextResponse.json({
      success: true,
      data: rows,
      total: count,
      page,
      pageSize,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询词汇失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/vocabulary - 添加词汇
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pool = getPool();
    const id = uuid();

    await pool.execute(
      `INSERT INTO vocabulary (id, word, phonetic, part_of_speech, meaning, example_sentence, example_translation, common_phrases, word_forms, is_cet4_core, difficulty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.word,
        body.phonetic || null,
        body.part_of_speech || null,
        body.meaning,
        body.example_sentence || null,
        body.example_translation || null,
        body.common_phrases ? JSON.stringify(body.common_phrases) : null,
        body.word_forms ? JSON.stringify(body.word_forms) : null,
        body.is_cet4_core ?? false,
        body.difficulty || "medium",
      ]
    );

    return NextResponse.json({ success: true, data: { id, ...body } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "添加词汇失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/vocabulary - 更新词汇掌握度
export async function PATCH(request: NextRequest) {
  try {
    const { id, mastery_level, increment_review, increment_correct } = await request.json();
    const pool = getPool();

    const updates: string[] = ["last_reviewed_at = NOW()"];
    const params: unknown[] = [];

    if (typeof mastery_level === "number") {
      updates.push("mastery_level = ?");
      params.push(mastery_level);
    }

    if (increment_review) {
      updates.push("review_count = review_count + 1");
    }

    if (increment_correct) {
      updates.push("correct_count = correct_count + 1");
    }

    params.push(id);
    await pool.execute(
      `UPDATE vocabulary SET ${updates.join(", ")} WHERE id = ?`,
      params as (string | number | null)[]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新词汇失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
