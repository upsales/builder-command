import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function todayStart() {
  return new Date().toISOString().slice(0, 10) + " 00:00:00";
}

export async function GET() {
  const db = getDb();

  // Total XP
  const totalRow = db.prepare("SELECT COALESCE(SUM(xp), 0) as total FROM xp_log").get() as { total: number };

  // Today's XP
  const todayRow = db.prepare(
    "SELECT COALESCE(SUM(xp), 0) as today FROM xp_log WHERE created_at >= ?"
  ).get(todayStart()) as { today: number };

  // Today's actions for the summary
  const todayActions = db.prepare(
    "SELECT action, source, xp, label, created_at FROM xp_log WHERE created_at >= ? ORDER BY created_at DESC"
  ).all(todayStart()) as { action: string; source: string | null; xp: number; label: string | null; created_at: string }[];

  // Streak: count consecutive days with XP
  const days = db.prepare(
    "SELECT DISTINCT date(created_at) as d FROM xp_log ORDER BY d DESC LIMIT 30"
  ).all() as { d: string }[];

  let streak = 0;
  const now = new Date();
  for (let i = 0; i < days.length; i++) {
    const expected = new Date(now);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);
    if (days[i].d === expectedStr) {
      streak++;
    } else {
      break;
    }
  }

  // Level: every 500 XP = 1 level
  const level = Math.floor(totalRow.total / 500) + 1;
  const xpInLevel = totalRow.total % 500;

  return NextResponse.json({
    total: totalRow.total,
    today: todayRow.today,
    level,
    xpInLevel,
    xpForNextLevel: 500,
    streak,
    todayActions,
  });
}

export async function POST(request: NextRequest) {
  const { action, source, xp, label } = await request.json();
  const db = getDb();
  db.prepare(
    "INSERT INTO xp_log (action, source, xp, label) VALUES (?, ?, ?, ?)"
  ).run(action, source ?? null, xp, label ?? null);
  return NextResponse.json({ ok: true });
}
