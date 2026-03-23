import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getProfile } from "@/lib/items";
import { fetchSessions, fetchRepos, createSession } from "@/lib/integrations/clanker";

// POST — create a new clanker session
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
  void source; void sourceId;

  try {
    const session = await createSession(clankerBody);
    return NextResponse.json(session);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

// GET — list sessions or repos
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");

  if (type === "sessions") {
    try {
      const sessions = await fetchSessions();
      return NextResponse.json(sessions);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
    }
  }

  // Default: repos list (backwards compatible)
  try {
    const repos = await fetchRepos();
    return NextResponse.json(repos);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
