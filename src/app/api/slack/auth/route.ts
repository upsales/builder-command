import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.SLACK_CLIENT_ID!;
  const redirectUri = `https://localhost:3001/api/slack/callback`;
  const scopes = [
    "search:read",
    "channels:read",
    "channels:write",
    "channels:history",
    "groups:read",
    "groups:write",
    "groups:history",
    "im:read",
    "im:write",
    "im:history",
    "mpim:read",
    "mpim:write",
    "mpim:history",
    "chat:write",
    "reactions:write",
    "reactions:read",
    "users:read",
    "files:read",
  ].join(",");

  const url = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&user_scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.redirect(url);
}
