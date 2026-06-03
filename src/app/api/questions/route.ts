import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/storage/database/mysql-client";

// GET /api/questions - 获取题库列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const questionType = searchParams.get("type");
    const materialId = searchParams.get("material_id");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const pool = getPool();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (questionType) {
      conditions.push("q.question_type = ?");
      params.push(questionType);
    }
    if (materialId) {
      conditions.push("q.material_id = ?");
      params.push(materialId);
    }
    if (search) {
      conditions.push("q.question_text LIKE ?");
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count query
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as count FROM questions q ${whereClause}`,
      params as (string | number | null)[]
    );
    const count = Number((countRows as Record<string, unknown>[])[0]?.count ?? 0);

    // Data query with join to get material title
    const offset = (page - 1) * pageSize;
    const [rows] = await pool.execute(
      `SELECT q.id, q.question_text, q.options, q.correct_answer, q.explanation, q.question_type, q.material_id, q.created_at, q.analysis,
              sm.title as material_title
       FROM questions q
       LEFT JOIN study_materials sm ON q.material_id = sm.id
       ${whereClause}
       ORDER BY q.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset] as (string | number | null)[]
    );

    // Transform to match expected format
    const data = (rows as Record<string, unknown>[]).map(row => {
      const optionsData = typeof row.options === 'string' ? JSON.parse(row.options as string) : (row.options || {});
      const analysisData = typeof row.analysis === 'string' ? JSON.parse(row.analysis as string) : (row.analysis || {});
      return {
        id: row.id,
        question_text: row.question_text,
        options: optionsData.options || optionsData,
        options_translation: optionsData.options_translation || {},
        question_translation: optionsData.question_translation || '',
        socratic_hints: analysisData.socratic_hints || optionsData.socratic_hints || [],
        correct_answer: row.correct_answer,
        explanation: row.explanation,
        question_type: row.question_type,
        material_id: row.material_id,
        created_at: row.created_at,
        study_materials: row.material_title ? { title: row.material_title } : null,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      total: count,
      page,
      pageSize,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询题库失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
