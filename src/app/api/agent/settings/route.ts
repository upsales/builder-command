import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";

const AGENT_SETTINGS = ["agent_prompt", "agent_max_rounds"] as const;

export async function GET() {
  const settings: Record<string, string | null> = {};
  for (const key of AGENT_SETTINGS) {
    settings[key] = getSetting(key);
  }
  return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { key, value } = body as { key: string; value: string };

  if (!AGENT_SETTINGS.includes(key as typeof AGENT_SETTINGS[number])) {
    return NextResponse.json({ error: "Invalid setting key" }, { status: 400 });
  }

  if (key === "agent_max_rounds") {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 5 || parsed > 100) {
      return NextResponse.json({ error: "agent_max_rounds must be between 5 and 100" }, { status: 400 });
    }
  }

  setSetting(key, value);
  return NextResponse.json({ ok: true, key, value });
}
