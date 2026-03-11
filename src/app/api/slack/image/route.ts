import { NextRequest } from "next/server";
import { getProfile } from "@/lib/items";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return new Response("Missing url parameter", { status: 400 });
  }

  const profile = getProfile();
  if (!profile?.slack_token) {
    return new Response("No Slack token configured", { status: 401 });
  }

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${profile.slack_token}` },
  });

  if (!resp.ok) {
    return new Response(`Slack returned ${resp.status}`, { status: resp.status });
  }

  const contentType = resp.headers.get("content-type") ?? "application/octet-stream";
  const body = await resp.arrayBuffer();

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
