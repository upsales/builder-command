import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get("code");
  const error = new URL(request.url).searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect("https://localhost:3001?slack_error=" + (error ?? "no_code"));
  }

  // Exchange code for token
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: "https://localhost:3001/api/slack/callback",
    }),
  });

  const data = await res.json();

  if (!data.ok || !data.authed_user?.access_token) {
    return NextResponse.redirect("https://localhost:3001?slack_error=" + (data.error ?? "unknown"));
  }

  const userToken = data.authed_user.access_token;
  const userId = data.authed_user.id;

  // Store in profile
  const db = getDb();
  db.prepare(
    "UPDATE profile SET slack_user_id = ?, slack_token = ? WHERE id = 1"
  ).run(userId, userToken);

  return NextResponse.redirect("https://localhost:3001?slack=connected");
}
