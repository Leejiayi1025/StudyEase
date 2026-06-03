import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/storage/database/mysql-client";
import { requireAuth } from "@/lib/auth";

// GET /api/materials - 获取材料列表，或单个材料详情
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get("id");
    const search = searchParams.get("search");
    const favorite = searchParams.get("favorite");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const pool = getPool();

    // Single material detail
    if (materialId) {
      const [rows] = await pool.execute(
        `SELECT id, title, content, source_type, analysis, created_at, is_favorite, tags FROM study_materials WHERE id = ? AND user_id = ? LIMIT 1`,
        [materialId, user.id]
      );
      const material = (rows as Record<string, unknown>[])[0];
      if (!material) {
        return NextResponse.json({ error: "材料不存在" }, { status: 404 });
      }
      const analysis = typeof material.analysis === 'string' ? JSON.parse(material.analysis as string) : material.analysis;
      return NextResponse.json({ success: true, data: { ...material, analysis } });
    }

    // List materials with question counts
    const offset = (page - 1) * pageSize;
    const conditions = ['sm.user_id = ?'];
    const params: unknown[] = [user.id];

    if (search) {
      conditions.push('sm.title LIKE ?');
      params.push(`%${search}%`);
    }
    if (favorite === 'true') {
      conditions.push('sm.is_favorite = 1');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    params.push(pageSize, offset);

    const [rows] = await pool.execute(
      `SELECT sm.id, sm.title, sm.source_type, sm.created_at, sm.is_favorite, sm.tags,
              COUNT(q.id) as question_count,
              SUM(CASE WHEN q.question_type = 'reading' THEN 1 ELSE 0 END) as reading_count,
              SUM(CASE WHEN q.question_type = 'cloze' THEN 1 ELSE 0 END) as cloze_count,
              SUM(CASE WHEN q.question_type = 'vocabulary' THEN 1 ELSE 0 END) as vocabulary_count,
              SUM(CASE WHEN q.question_type = 'translation' THEN 1 ELSE 0 END) as translation_count,
              SUM(CASE WHEN q.question_type = 'writing' THEN 1 ELSE 0 END) as writing_count
       FROM study_materials sm
       LEFT JOIN questions q ON sm.id = q.material_id
       ${whereClause}
       GROUP BY sm.id
       ORDER BY sm.created_at DESC
       LIMIT ? OFFSET ?`,
      params as (string | number | null)[]
    );

    const [countRows] = await pool.execute(`SELECT COUNT(*) as count FROM study_materials WHERE user_id = ?`, [user.id]);
    const total = Number((countRows as Record<string, unknown>[])[0]?.count ?? 0);

    return NextResponse.json({ success: true, data: rows, total, page, pageSize });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取材料列表失败";
    return NextResponse.json({ error: message }, { status: message === '未登录' ? 401 : 500 });
  }
}

// PATCH /api/materials - 更新收藏/标签
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { id, is_favorite, tags } = await request.json();
    const pool = getPool();

    const updates: string[] = [];
    const params: unknown[] = [];

    if (typeof is_favorite === 'number') {
      updates.push('is_favorite = ?');
      params.push(is_favorite);
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      params.push(tags);
    }

    if (updates.length === 0) return NextResponse.json({ success: true });

    params.push(id, user.id);
    await pool.execute(`UPDATE study_materials SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params as (string | number | null)[]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失败";
    return NextResponse.json({ error: message }, { status: message === '未登录' ? 401 : 500 });
  }
}

// DELETE /api/materials - 删除材料（级联删除题目）
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { id } = await request.json();
    const pool = getPool();

    await pool.execute(`DELETE FROM study_materials WHERE id = ? AND user_id = ?`, [id, user.id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除失败";
    return NextResponse.json({ error: message }, { status: message === '未登录' ? 401 : 500 });
  }
}
