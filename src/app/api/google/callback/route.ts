import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/integrations/google-calendar";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect("http://localhost:3000?google_error=" + (error ?? "no_code"));
  }

  try {
    const refreshToken = await exchangeCode(code);

    const db = getDb();
    db.prepare(
      "UPDATE profile SET google_refresh_token = ? WHERE id = 1"
    ).run(refreshToken);

    return NextResponse.redirect("http://localhost:3000?google=connected");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect("http://localhost:3000?google_error=" + encodeURIComponent(msg));
  }
}
