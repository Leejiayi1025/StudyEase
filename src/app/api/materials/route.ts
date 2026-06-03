import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/storage/database/mysql-client";

// GET /api/materials - 获取所有导入的材料（套题列表）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const pool = getPool();
    const offset = (page - 1) * pageSize;

    // Get materials with question counts by type
    const [rows] = await pool.execute(
      `SELECT sm.id, sm.title, sm.source_type, sm.created_at,
              COUNT(q.id) as question_count,
              SUM(CASE WHEN q.question_type = 'reading' THEN 1 ELSE 0 END) as reading_count,
              SUM(CASE WHEN q.question_type = 'cloze' THEN 1 ELSE 0 END) as cloze_count,
              SUM(CASE WHEN q.question_type = 'vocabulary' THEN 1 ELSE 0 END) as vocabulary_count,
              SUM(CASE WHEN q.question_type = 'translation' THEN 1 ELSE 0 END) as translation_count,
              SUM(CASE WHEN q.question_type = 'writing' THEN 1 ELSE 0 END) as writing_count
       FROM study_materials sm
       LEFT JOIN questions q ON sm.id = q.material_id
       GROUP BY sm.id
       ORDER BY sm.created_at DESC
       LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    const [countRows] = await pool.execute(`SELECT COUNT(*) as count FROM study_materials`);
    const total = Number((countRows as Record<string, unknown>[])[0]?.count ?? 0);

    return NextResponse.json({
      success: true,
      data: rows,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取材料列表失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
