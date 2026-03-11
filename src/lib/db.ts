import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "todo.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
  }
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      github_username TEXT,
      linear_email TEXT,
      slack_user_id TEXT,
      slack_token TEXT,
      google_refresh_token TEXT
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT,
      raw_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(source, source_id)
    );

    CREATE TABLE IF NOT EXISTS dismissed (
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      dismissed_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY(source, source_id)
    );
  `);

  // Style samples: stores user's own Slack messages for reply style matching
  db.exec(`
    CREATE TABLE IF NOT EXISTS slack_style (
      channel TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      PRIMARY KEY(channel, timestamp)
    );
  `);

  // Daily todos
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_todos (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_daily_todos_date ON daily_todos(date);
  `);

  // XP / gamification log
  db.exec(`
    CREATE TABLE IF NOT EXISTS xp_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      source TEXT,
      xp INTEGER NOT NULL,
      label TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_xp_log_date ON xp_log(created_at);
  `);

  // Snooze table
  db.exec(`
    CREATE TABLE IF NOT EXISTS snoozed (
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      snooze_until TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY(source, source_id)
    );
    CREATE INDEX IF NOT EXISTS idx_snoozed_until ON snoozed(snooze_until);
  `);

  // Agent sessions for autonomous task processing
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY,
      todo_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      summary TEXT,
      failure_reason TEXT,
      messages TEXT,
      tool_calls TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Add columns to existing tables
  try { db.exec("ALTER TABLE profile ADD COLUMN google_refresh_token TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE daily_todos ADD COLUMN deadline TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE daily_todos ADD COLUMN image TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE daily_todos ADD COLUMN note TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE daily_todos ADD COLUMN agent_enabled INTEGER DEFAULT 0"); } catch { /* already exists */ }
}
