import { NextResponse } from "next/server";
import { getItems } from "@/lib/items";
import { startSlackSocket } from "@/lib/slackSocket";

export async function GET() {
  startSlackSocket();
  return NextResponse.json(getItems());
}
