import { NextResponse } from "next/server";
import { getPool } from "@/storage/database/mysql-client";

// GET /api/progress - 获取学习进度
export async function GET() {
  try {
    const pool = getPool();

    // Get today's progress
    const today = new Date().toISOString().split("T")[0];
    const [todayRows] = await pool.execute(
      `SELECT * FROM study_progress WHERE date = ? LIMIT 1`,
      [today]
    );
    const todayProgress = (todayRows as Record<string, unknown>[])[0] || null;

    // Get last 7 days progress
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const [weeklyRows] = await pool.execute(
      `SELECT * FROM study_progress WHERE date >= ? ORDER BY date DESC`,
      [sevenDaysAgo.toISOString().split("T")[0]]
    );

    // Get vocabulary stats
    const [totalRows] = await pool.execute(`SELECT COUNT(*) as count FROM vocabulary`);
    const totalWords = Number((totalRows as Record<string, unknown>[])[0]?.count ?? 0);

    const [masteredRows] = await pool.execute(`SELECT COUNT(*) as count FROM vocabulary WHERE mastery_level = 3`);
    const masteredWords = Number((masteredRows as Record<string, unknown>[])[0]?.count ?? 0);

    const [learningRows] = await pool.execute(`SELECT COUNT(*) as count FROM vocabulary WHERE mastery_level IN (1, 2)`);
    const learningWords = Number((learningRows as Record<string, unknown>[])[0]?.count ?? 0);

    const [mistakesRows] = await pool.execute(`SELECT COUNT(*) as count FROM mistakes WHERE is_resolved = 0`);
    const unresolvedMistakes = Number((mistakesRows as Record<string, unknown>[])[0]?.count ?? 0);

    return NextResponse.json({
      success: true,
      today: todayProgress || {
        date: today,
        words_learned: 0,
        words_reviewed: 0,
        questions_attempted: 0,
        questions_correct: 0,
        study_minutes: 0,
      },
      weekly: weeklyRows,
      stats: {
        totalWords,
        masteredWords,
        learningWords,
        unresolvedMistakes,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取进度失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
