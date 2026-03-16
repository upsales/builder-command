import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";

const DEFAULT_REPLIES = ["Kollar på det!"];

export async function GET() {
  const raw = getSetting("quick_replies");
  const replies = raw ? JSON.parse(raw) : DEFAULT_REPLIES;
  return NextResponse.json({ replies });
}

export async function POST(request: NextRequest) {
  const { replies } = await request.json();
  if (!Array.isArray(replies) || replies.some((r: unknown) => typeof r !== "string")) {
    return NextResponse.json({ error: "replies must be an array of strings" }, { status: 400 });
  }
  const filtered = replies.filter((r: string) => r.trim().length > 0);
  setSetting("quick_replies", JSON.stringify(filtered));
  return NextResponse.json({ replies: filtered });
}
