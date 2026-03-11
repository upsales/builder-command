import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/integrations/google-calendar";

export async function GET() {
  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
