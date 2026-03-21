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

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(key, value, value);
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

  // Key-value settings (for server-side access to UI preferences like watched channels)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Chat sessions (persist conversations for resumption)
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      messages TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at);
  `);

  // Agent memory — persistent facts the agent learns across sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_agent_memories_category ON agent_memories(category);
  `);

  // Persistent codebase index — structured understanding of repos
  db.exec(`
    CREATE TABLE IF NOT EXISTS repo_index (
      repo TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      architecture TEXT,
      patterns TEXT,
      key_modules TEXT,
      dependencies TEXT,
      fragile_areas TEXT,
      ownership TEXT,
      indexed_at TEXT DEFAULT (datetime('now')),
      commit_sha TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE INDEX IF NOT EXISTS idx_repo_index_status ON repo_index(status);
  `);

  // Granular module-level index entries for detailed queries
  db.exec(`
    CREATE TABLE IF NOT EXISTS repo_index_modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo TEXT NOT NULL,
      module_path TEXT NOT NULL,
      description TEXT NOT NULL,
      exports TEXT,
      dependencies TEXT,
      coupling_notes TEXT,
      UNIQUE(repo, module_path)
    );
    CREATE INDEX IF NOT EXISTS idx_repo_index_modules_repo ON repo_index_modules(repo);
  `);

  // Scheduled followups — agent can schedule itself to wake up later
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_followups (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      run_at TEXT NOT NULL,
      instruction TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_scheduled_followups_run_at ON scheduled_followups(run_at);
    CREATE INDEX IF NOT EXISTS idx_scheduled_followups_status ON scheduled_followups(status);
  `);

  // Add columns to existing tables
  try { db.exec("ALTER TABLE profile ADD COLUMN google_refresh_token TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE daily_todos ADD COLUMN deadline TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE daily_todos ADD COLUMN image TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE daily_todos ADD COLUMN note TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE daily_todos ADD COLUMN agent_enabled INTEGER DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE daily_todos ADD COLUMN source TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE daily_todos ADD COLUMN source_id TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE daily_todos ADD COLUMN completed_at TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE daily_todos ADD COLUMN agent_prompt TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE agent_sessions ADD COLUMN sdk_session_id TEXT"); } catch { /* already exists */ }
}
