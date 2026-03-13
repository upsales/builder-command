import { NextResponse } from "next/server";
import { getItems } from "@/lib/items";

export async function GET() {
  return NextResponse.json(getItems());
}
