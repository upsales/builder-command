import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { token } = await request.json();

  if (!token || !token.startsWith("xoxp-")) {
    return NextResponse.json({ error: "Invalid token. Must be a user token starting with xoxp-" }, { status: 400 });
  }

  // Verify token works and get user ID
  try {
    const client = new WebClient(token);
    const auth = await client.auth.test();

    const db = getDb();
    db.prepare(
      "UPDATE profile SET slack_user_id = ?, slack_token = ? WHERE id = 1"
    ).run(auth.user_id, token);

    return NextResponse.json({ ok: true, user: auth.user });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid token" }, { status: 400 });
  }
}
