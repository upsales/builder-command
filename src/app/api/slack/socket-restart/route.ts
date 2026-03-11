import { NextResponse } from "next/server";
import { restartSlackSocket } from "@/lib/slackSocket";

export async function POST() {
  restartSlackSocket();
  return NextResponse.json({ ok: true });
}
