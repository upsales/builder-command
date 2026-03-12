import { NextRequest, NextResponse } from "next/server";

const CLANKER_URL = process.env.CLANKER_URL || "https://clanker.upsales.com";

// POST — proxy session creation to clanker
export async function POST(request: NextRequest) {
  const body = await request.json();

  const res = await fetch(`${CLANKER_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
