import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/integrations/google-calendar";
import { getDb } from "@/lib/db";

function getBaseUrl() {
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const base = getBaseUrl();

  if (error || !code) {
    return NextResponse.redirect(`${base}?google_error=${error ?? "no_code"}`);
  }

  try {
    const refreshToken = await exchangeCode(code);

    const db = getDb();
    db.prepare(
      "UPDATE profile SET google_refresh_token = ? WHERE id = 1"
    ).run(refreshToken);

    return NextResponse.redirect(`${base}?google=connected`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(`${base}?google_error=${encodeURIComponent(msg)}`);
  }
}
