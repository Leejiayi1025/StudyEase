import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/storage/database/mysql-client";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const pool = getPool();

    const today = new Date().toISOString().split("T")[0];
    const [todayRows] = await pool.execute(`SELECT * FROM study_progress WHERE date = ? AND user_id = ? LIMIT 1`, [today, user.id]);
    const todayProgress = (todayRows as Record<string, unknown>[])[0] || null;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const [weeklyRows] = await pool.execute(`SELECT * FROM study_progress WHERE date >= ? AND user_id = ? ORDER BY date DESC`, [sevenDaysAgo.toISOString().split("T")[0], user.id]);

    const [totalRows] = await pool.execute(`SELECT COUNT(*) as count FROM vocabulary WHERE user_id = ?`, [user.id]);
    const totalWords = Number((totalRows as Record<string, unknown>[])[0]?.count ?? 0);

    const [masteredRows] = await pool.execute(`SELECT COUNT(*) as count FROM vocabulary WHERE mastery_level = 3 AND user_id = ?`, [user.id]);
    const masteredWords = Number((masteredRows as Record<string, unknown>[])[0]?.count ?? 0);

    const [learningRows] = await pool.execute(`SELECT COUNT(*) as count FROM vocabulary WHERE mastery_level IN (1, 2) AND user_id = ?`, [user.id]);
    const learningWords = Number((learningRows as Record<string, unknown>[])[0]?.count ?? 0);

    const [mistakesRows] = await pool.execute(`SELECT COUNT(*) as count FROM mistakes WHERE is_resolved = 0 AND user_id = ?`, [user.id]);
    const unresolvedMistakes = Number((mistakesRows as Record<string, unknown>[])[0]?.count ?? 0);

    return NextResponse.json({
      success: true,
      today: todayProgress || { date: today, words_learned: 0, words_reviewed: 0, questions_attempted: 0, questions_correct: 0, study_minutes: 0 },
      weekly: weeklyRows,
      stats: { totalWords, masteredWords, learningWords, unresolvedMistakes },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取进度失败";
    return NextResponse.json({ error: message }, { status: message === '未登录' ? 401 : 500 });
  }
}
