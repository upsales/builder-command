import { getDb } from "./db";
import { randomUUID } from "crypto";

// ─── Types ───────────────────────────────────────────────────

export type BehaviorAction =
  | "dismiss"
  | "undismiss"
  | "snooze"
  | "focus"
  | "unfocus"
  | "merge_pr"
  | "approve_pr"
  | "reply_slack"
  | "create_task"
  | "complete_task"
  | "start_agent";

export interface BehaviorEntry {
  id: number;
  action: BehaviorAction;
  source: string;
  source_id: string;
  item_title: string | null;
  item_context: string | null;  // JSON: author, channel, priority, size, etc.
  metadata: string | null;      // JSON: snooze_duration, etc.
  created_at: string;
}

export interface LearnedPattern {
  id: string;
  pattern: string;        // Human-readable description
  category: string;       // dismiss, prioritize, review, communicate, etc.
  confidence: number;     // 0-1
  evidence_count: number;
  last_evidence_at: string | null;
  created_at: string;
}

// ─── Logging ─────────────────────────────────────────────────

export function logBehavior(
  action: BehaviorAction,
  source: string,
  sourceId: string,
  itemTitle?: string | null,
  itemContext?: Record<string, unknown> | null,
  metadata?: Record<string, unknown> | null,
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO behavior_log (action, source, source_id, item_title, item_context, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    action,
    source,
    sourceId,
    itemTitle ?? null,
    itemContext ? JSON.stringify(itemContext) : null,
    metadata ? JSON.stringify(metadata) : null,
  );
}

// ─── Querying ────────────────────────────────────────────────

export function getBehaviorLog(limit = 200, action?: string): BehaviorEntry[] {
  const db = getDb();
  if (action) {
    return db.prepare(
      `SELECT * FROM behavior_log WHERE action = ? ORDER BY created_at DESC LIMIT ?`
    ).all(action, limit) as BehaviorEntry[];
  }
  return db.prepare(
    `SELECT * FROM behavior_log ORDER BY created_at DESC LIMIT ?`
  ).all(limit) as BehaviorEntry[];
}

export function getBehaviorStats(): {
  total: number;
  byAction: Record<string, number>;
  bySource: Record<string, number>;
  since: string | null;
} {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) as c FROM behavior_log").get() as { c: number }).c;
  const byAction: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  const actions = db.prepare(
    "SELECT action, COUNT(*) as c FROM behavior_log GROUP BY action"
  ).all() as { action: string; c: number }[];
  for (const row of actions) byAction[row.action] = row.c;

  const sources = db.prepare(
    "SELECT source, COUNT(*) as c FROM behavior_log GROUP BY source"
  ).all() as { source: string; c: number }[];
  for (const row of sources) bySource[row.source] = row.c;

  const oldest = db.prepare(
    "SELECT created_at FROM behavior_log ORDER BY created_at ASC LIMIT 1"
  ).get() as { created_at: string } | undefined;

  return { total, byAction, bySource, since: oldest?.created_at ?? null };
}

// ─── Context extraction helpers ──────────────────────────────

export function extractItemContext(source: string, rawData: string | null): Record<string, unknown> {
  if (!rawData) return { source };
  try {
    const raw = JSON.parse(rawData);
    switch (source) {
      case "github": {
        const checks = (raw.checks ?? []) as { conclusion: string }[];
        const failingChecks = checks.filter(c => c.conclusion === "failure").length;
        const passingChecks = checks.filter(c => c.conclusion === "success").length;
        return {
          source,
          author: raw.author,
          repo: raw.repo,
          draft: raw.draft,
          mergeable: raw.mergeable,
          mergeableState: raw.mergeableState,
          reviewRequested: raw.reviewRequested,
          isReview: false,  // caller should override
          failingChecks,
          passingChecks,
          totalChecks: checks.length,
          commentCount: (raw.comments ?? []).length,
          // Approximate PR size from body length (real diff size isn't stored)
          bodyLength: (raw.body ?? "").length,
        };
      }
      case "slack": {
        return {
          source,
          channel: raw.channelName,
          sender: raw.senderName,
          isThread: !!raw.threadTs,
          replyCount: raw.replyCount ?? 0,
          isDM: (raw.channelName ?? "").startsWith("DM:"),
          hasFiles: (raw.files ?? []).length > 0,
        };
      }
      case "linear": {
        return {
          source,
          state: raw.state,
          priority: raw.priority,
          project: raw.project,
          labels: (raw.labels ?? []).map((l: { name: string }) => l.name),
          hasDescription: !!(raw.description && raw.description.length > 0),
        };
      }
      case "calendar": {
        return {
          source,
          allDay: raw.allDay,
          responseStatus: raw.responseStatus,
          attendeeCount: (raw.attendees ?? []).length,
          hasConferenceLink: !!raw.conferenceLink,
          organizer: raw.organizer,
        };
      }
      default:
        return { source };
    }
  } catch {
    return { source };
  }
}

// ─── Pattern Management ──────────────────────────────────────

export function getLearnedPatterns(minConfidence = 0): LearnedPattern[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM learned_patterns WHERE confidence >= ? ORDER BY confidence DESC, evidence_count DESC`
  ).all(minConfidence) as LearnedPattern[];
}

export function saveLearnedPatterns(patterns: {
  pattern: string;
  category: string;
  confidence: number;
  evidence_count: number;
}[]): void {
  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO learned_patterns (id, pattern, category, confidence, evidence_count, last_evidence_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       pattern = excluded.pattern,
       confidence = excluded.confidence,
       evidence_count = excluded.evidence_count,
       last_evidence_at = datetime('now')`
  );

  const tx = db.transaction(() => {
    // Clear old patterns before inserting fresh analysis
    db.prepare("DELETE FROM learned_patterns").run();
    for (const p of patterns) {
      upsert.run(
        randomUUID(),
        p.pattern,
        p.category,
        p.confidence,
        p.evidence_count,
      );
    }
  });
  tx();
}

// ─── Behavior Summary for AI Analysis ────────────────────────

export function buildBehaviorSummary(): string {
  const db = getDb();
  const stats = getBehaviorStats();

  if (stats.total === 0) {
    return "No behavior data collected yet.";
  }

  const lines: string[] = [];
  lines.push(`Total actions recorded: ${stats.total} (since ${stats.since})`);
  lines.push(`\nActions breakdown: ${JSON.stringify(stats.byAction)}`);
  lines.push(`Sources breakdown: ${JSON.stringify(stats.bySource)}`);

  // Dismiss patterns: what gets dismissed by source/context
  const dismissals = db.prepare(
    `SELECT source, item_title, item_context, created_at
     FROM behavior_log WHERE action = 'dismiss'
     ORDER BY created_at DESC LIMIT 100`
  ).all() as { source: string; item_title: string; item_context: string | null; created_at: string }[];

  if (dismissals.length > 0) {
    lines.push(`\n--- DISMISSAL PATTERNS (${dismissals.length} recent) ---`);
    for (const d of dismissals.slice(0, 50)) {
      const ctx = d.item_context ? JSON.parse(d.item_context) : {};
      lines.push(`  [${d.source}] "${d.item_title}" | context: ${JSON.stringify(ctx)}`);
    }
  }

  // Snooze patterns
  const snoozes = db.prepare(
    `SELECT source, item_title, item_context, metadata, created_at
     FROM behavior_log WHERE action = 'snooze'
     ORDER BY created_at DESC LIMIT 50`
  ).all() as { source: string; item_title: string; item_context: string | null; metadata: string | null; created_at: string }[];

  if (snoozes.length > 0) {
    lines.push(`\n--- SNOOZE PATTERNS (${snoozes.length} recent) ---`);
    for (const s of snoozes) {
      const ctx = s.item_context ? JSON.parse(s.item_context) : {};
      const meta = s.metadata ? JSON.parse(s.metadata) : {};
      lines.push(`  [${s.source}] "${s.item_title}" | duration: ${meta.duration} | context: ${JSON.stringify(ctx)}`);
    }
  }

  // Focus patterns (what the user prioritizes)
  const focuses = db.prepare(
    `SELECT source, item_title, item_context, created_at
     FROM behavior_log WHERE action = 'focus'
     ORDER BY created_at DESC LIMIT 50`
  ).all() as { source: string; item_title: string; item_context: string | null; created_at: string }[];

  if (focuses.length > 0) {
    lines.push(`\n--- FOCUS/PRIORITY PATTERNS (${focuses.length} recent) ---`);
    for (const f of focuses) {
      const ctx = f.item_context ? JSON.parse(f.item_context) : {};
      lines.push(`  [${f.source}] "${f.item_title}" | context: ${JSON.stringify(ctx)}`);
    }
  }

  // PR actions
  const prActions = db.prepare(
    `SELECT action, item_title, item_context, created_at
     FROM behavior_log WHERE source = 'github' AND action IN ('merge_pr', 'approve_pr', 'dismiss')
     ORDER BY created_at DESC LIMIT 50`
  ).all() as { action: string; item_title: string; item_context: string | null; created_at: string }[];

  if (prActions.length > 0) {
    lines.push(`\n--- PR DECISION PATTERNS (${prActions.length} recent) ---`);
    for (const p of prActions) {
      const ctx = p.item_context ? JSON.parse(p.item_context) : {};
      lines.push(`  ${p.action}: "${p.item_title}" | context: ${JSON.stringify(ctx)}`);
    }
  }

  // Slack reply patterns
  const slackActions = db.prepare(
    `SELECT action, item_title, item_context, created_at
     FROM behavior_log WHERE source = 'slack'
     ORDER BY created_at DESC LIMIT 50`
  ).all() as { action: string; item_title: string; item_context: string | null; created_at: string }[];

  if (slackActions.length > 0) {
    lines.push(`\n--- SLACK BEHAVIOR PATTERNS (${slackActions.length} recent) ---`);
    for (const s of slackActions) {
      const ctx = s.item_context ? JSON.parse(s.item_context) : {};
      lines.push(`  ${s.action}: "${s.item_title}" | context: ${JSON.stringify(ctx)}`);
    }
  }

  // Time-of-day patterns
  const hourly = db.prepare(
    `SELECT strftime('%H', created_at) as hour, action, COUNT(*) as c
     FROM behavior_log
     GROUP BY hour, action
     ORDER BY hour`
  ).all() as { hour: string; action: string; c: number }[];

  if (hourly.length > 0) {
    lines.push(`\n--- TIME-OF-DAY PATTERNS ---`);
    for (const h of hourly) {
      lines.push(`  Hour ${h.hour}: ${h.action} x${h.c}`);
    }
  }

  return lines.join("\n");
}
