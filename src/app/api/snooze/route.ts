import { NextRequest, NextResponse } from "next/server";
import { snoozeItem, getSnoozedItems } from "@/lib/items";
import { getDb } from "@/lib/db";
import { logBehavior, extractItemContext } from "@/lib/behavior";

export async function POST(request: NextRequest) {
  const { source, source_id, duration } = await request.json();
  if (!source || !source_id || !duration) {
    return NextResponse.json({ error: "source, source_id, and duration required" }, { status: 400 });
  }

  const now = new Date();
  const durations: Record<string, number> = {
    "1h": 60 * 60 * 1000,
    "2h": 2 * 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
    "tomorrow": (() => {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow.getTime() - now.getTime();
    })(),
    "next_week": (() => {
      const monday = new Date(now);
      monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
      monday.setHours(9, 0, 0, 0);
      return monday.getTime() - now.getTime();
    })(),
  };

  const ms = durations[duration];
  if (!ms) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }

  const snoozeUntil = new Date(now.getTime() + ms).toISOString().replace("T", " ").slice(0, 19);

  // Log snooze behavior with duration context
  const itemRow = db.prepare("SELECT title, raw_data FROM items WHERE source = ? AND source_id = ?").get(source, source_id) as { title: string; raw_data: string | null } | undefined;
  logBehavior("snooze", source, source_id, itemRow?.title, extractItemContext(source, itemRow?.raw_data ?? null), { duration, snooze_until: snoozeUntil });

  snoozeItem(source, source_id, snoozeUntil);

  // Remove from dismissed if it was dismissed
  const db = getDb();
  db.prepare("DELETE FROM dismissed WHERE source = ? AND source_id = ?").run(source, source_id);

  return NextResponse.json({ ok: true, snooze_until: snoozeUntil });
}

export async function GET() {
  const items = getSnoozedItems();
  return NextResponse.json(items);
}
