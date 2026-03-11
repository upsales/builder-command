import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ENV_PATH = path.join(process.cwd(), ".env");

// Env vars we allow viewing/editing via settings
const ALLOWED_KEYS = [
  "ANTHROPIC_API_KEY",
  "GITHUB_TOKEN",
  "LINEAR_API_KEY",
  "LINEAR_TEAM_ID",
  "SLACK_CLIENT_ID",
  "SLACK_CLIENT_SECRET",
  "SLACK_BOT_TOKEN",
  "SLACK_APP_TOKEN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "PORT",
];

function parseEnv(): Record<string, string> {
  if (!fs.existsSync(ENV_PATH)) return {};
  const content = fs.readFileSync(ENV_PATH, "utf-8");
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    result[key] = val;
  }
  return result;
}

export async function GET() {
  const env = parseEnv();
  // Return keys with masked values (show first 4 chars + ***)
  const masked: Record<string, { set: boolean; preview: string }> = {};
  for (const key of ALLOWED_KEYS) {
    const val = env[key] ?? "";
    masked[key] = {
      set: !!val,
      preview: val ? val.substring(0, 4) + "***" : "",
    };
  }
  // Also return webhook URLs
  const port = env.PORT || "3777";
  const webhooks = {
    linear: `http://localhost:${port}/api/webhooks/linear`,
    github: `http://localhost:${port}/api/webhooks/github`,
    slack: `http://localhost:${port}/api/webhooks/slack`,
  };
  return NextResponse.json({ env: masked, webhooks });
}

export async function POST(request: NextRequest) {
  const { key, value } = await request.json();
  if (!ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: "Key not allowed" }, { status: 400 });
  }

  const env = parseEnv();
  env[key] = value;

  // Rebuild .env file
  const lines: string[] = [];
  for (const k of ALLOWED_KEYS) {
    if (env[k] !== undefined && env[k] !== "") {
      lines.push(`${k}=${env[k]}`);
    }
  }
  // Preserve any unknown keys
  const existingEnv = parseEnv();
  for (const [k, v] of Object.entries(existingEnv)) {
    if (!ALLOWED_KEYS.includes(k) && v) {
      lines.push(`${k}=${v}`);
    }
  }
  fs.writeFileSync(ENV_PATH, lines.join("\n") + "\n");

  // Update process.env for current session
  process.env[key] = value;

  return NextResponse.json({ ok: true });
}
