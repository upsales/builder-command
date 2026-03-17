import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getProfile } from "@/lib/items";

const CLANKER_URL = process.env.CLANKER_URL || "https://clanker.upsales.com";
const CLANKER_API_KEY = process.env.CLANKER_API_KEY || "";

function clankerHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (CLANKER_API_KEY) h["X-API-Key"] = CLANKER_API_KEY;
  return h;
}

// POST — proxy session creation to clanker
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Resolve Linear URL from DB if source info is provided
  if (body.source === "linear" && body.sourceId && !body.linearUrl) {
    const db = getDb();
    const item = db.prepare("SELECT url FROM items WHERE source = ? AND source_id = ?").get("linear", body.sourceId) as { url?: string } | undefined;
    if (item?.url) {
      body.linearUrl = item.url;
    }
  }

  // Attach profile info so clanker can attribute the session
  const profile = getProfile();
  if (profile) {
    body.profileId = profile.slack_user_id || "builder-command";
    body.profileName = "Builder Command";
    body.profileEmail = profile.linear_email || undefined;
  }

  // Remove internal fields before forwarding to clanker
  const { source, sourceId, ...clankerBody } = body;

  const res = await fetch(`${CLANKER_URL}/api/sessions`, {
    method: "POST",
    headers: clankerHeaders(),
    body: JSON.stringify(clankerBody),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

// GET — proxy repos list from clanker
export async function GET() {
  const res = await fetch(`${CLANKER_URL}/api/repos`, { headers: clankerHeaders() });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
