import { NextRequest, NextResponse } from "next/server";
import { getProfile, saveProfile } from "@/lib/items";

export async function GET() {
  const profile = getProfile();
  if (!profile) return NextResponse.json(null);

  // Don't expose token to frontend
  return NextResponse.json({
    github_username: profile.github_username,
    linear_email: profile.linear_email,
    slack_user_id: profile.slack_user_id,
    slack_connected: !!profile.slack_token,
    google_connected: !!profile.google_refresh_token,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  saveProfile({
    github_username: body.github_username ?? null,
    linear_email: body.linear_email ?? null,
    slack_user_id: body.slack_user_id ?? null,
    slack_token: getProfile()?.slack_token ?? null,
    google_refresh_token: getProfile()?.google_refresh_token ?? null,
  });
  return NextResponse.json(getProfile());
}
