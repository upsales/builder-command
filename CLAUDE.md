# Builder Agent - Claude Code Instructions

## Critical Rules

- **NEVER delete data/todo.db** — it contains the user's profile, Slack token, and synced data. Schema changes must use `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE` migrations, never destructive recreation.

## Project Overview

Next.js App Router + TypeScript + Tailwind CSS + SQLite (better-sqlite3). Local work management tool aggregating Linear, GitHub, and Slack into a single prioritized list.

## Key Paths

- `src/lib/db.ts` — SQLite schema and migrations
- `src/lib/items.ts` — DB helpers (profile, items, dismiss)
- `src/lib/integrations/` — Linear, GitHub, Slack API integrations
- `src/app/api/` — API routes (sync, profile, dismiss, actions)
- `src/app/page.tsx` — Main UI (all components in one file)
- `data/todo.db` — SQLite database (DO NOT DELETE)
- `.env` — API keys (LINEAR_API_KEY, GITHUB_TOKEN, SLACK_CLIENT_ID, etc.)

## Dev Commands

- `npm run dev` — Start dev server on port 3777
- `node https-proxy.mjs` — HTTPS proxy on port 3778 (for Slack OAuth)
