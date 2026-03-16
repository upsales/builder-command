import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const CLANKER_URL = process.env.CLANKER_URL || "https://clanker.upsales.com";

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

  // Remove internal fields before forwarding to clanker
  const { source, sourceId, ...clankerBody } = body;

  const res = await fetch(`${CLANKER_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(clankerBody),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

// GET — proxy repos list from clanker
export async function GET() {
  const res = await fetch(`${CLANKER_URL}/api/repos`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
