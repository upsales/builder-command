import { getDb } from "./db";
import { TodoItem, Profile } from "./types";
import { randomUUID } from "crypto";

export function getProfile(): Profile | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM profile WHERE id = 1").get() as (Profile & { id: number }) | undefined;
  return row ? { github_username: row.github_username, linear_email: row.linear_email, slack_user_id: row.slack_user_id, slack_token: row.slack_token, google_refresh_token: row.google_refresh_token } : null;
}

export function saveProfile(profile: Profile): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO profile (id, github_username, linear_email, slack_user_id)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET github_username = ?, linear_email = ?, slack_user_id = ?`
  ).run(
    profile.github_username, profile.linear_email, profile.slack_user_id,
    profile.github_username, profile.linear_email, profile.slack_user_id,
  );
}

export function getItems(): TodoItem[] {
  const db = getDb();
  // Clear expired snoozes first
  db.prepare("DELETE FROM snoozed WHERE snooze_until <= datetime('now')").run();
  return db.prepare(
    `SELECT i.* FROM items i
     LEFT JOIN dismissed d ON d.source = i.source AND d.source_id = i.source_id
     LEFT JOIN snoozed s ON s.source = i.source AND s.source_id = i.source_id
     WHERE d.source IS NULL AND s.source IS NULL
     ORDER BY i.created_at DESC`
  ).all() as TodoItem[];
}

export function snoozeItem(source: string, sourceId: string, snoozeUntil: string): void {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO snoozed (source, source_id, snooze_until) VALUES (?, ?, ?)`
  ).run(source, sourceId, snoozeUntil);
}

export function getSnoozedItems(): (TodoItem & { snooze_until: string })[] {
  const db = getDb();
  return db.prepare(
    `SELECT i.*, s.snooze_until FROM items i
     INNER JOIN snoozed s ON s.source = i.source AND s.source_id = i.source_id
     WHERE s.snooze_until > datetime('now')
     ORDER BY s.snooze_until ASC`
  ).all() as (TodoItem & { snooze_until: string })[];
}

export function dismissItem(source: string, sourceId: string): void {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO dismissed (source, source_id) VALUES (?, ?)`
  ).run(source, sourceId);
}

export function undismissItem(source: string, sourceId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM dismissed WHERE source = ? AND source_id = ?").run(source, sourceId);
}

export function getRecentlyDismissed(limit = 30): TodoItem[] {
  const db = getDb();
  return db.prepare(
    `SELECT i.* FROM items i
     INNER JOIN dismissed d ON d.source = i.source AND d.source_id = i.source_id
     WHERE d.dismissed_at > datetime('now', '-24 hours')
     ORDER BY d.dismissed_at DESC
     LIMIT ?`
  ).all(limit) as TodoItem[];
}

export function clearItems(): void {
  const db = getDb();
  db.prepare("DELETE FROM items").run();
}

export function clearItemsBySource(source: string): void {
  const db = getDb();
  db.prepare("DELETE FROM items WHERE source = ?").run(source);
}

export function removeStaleItems(source: string, currentSourceIds: string[]): void {
  const db = getDb();
  if (currentSourceIds.length === 0) return;
  const placeholders = currentSourceIds.map(() => "?").join(",");
  db.prepare(
    `DELETE FROM items WHERE source = ? AND source_id NOT IN (${placeholders})`
  ).run(source, ...currentSourceIds);
}

export function upsertItem(item: {
  source: TodoItem["source"];
  source_id: string;
  title: string;
  url?: string | null;
  raw_data?: string | null;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO items (id, source, source_id, title, url, raw_data)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(source, source_id) DO UPDATE SET title = ?, url = ?, raw_data = ?`
  ).run(
    randomUUID(), item.source, item.source_id, item.title, item.url ?? null, item.raw_data ?? null,
    item.title, item.url ?? null, item.raw_data ?? null,
  );
}
