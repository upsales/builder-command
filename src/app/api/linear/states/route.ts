import { NextResponse } from "next/server";
import { fetchTeamStates } from "@/lib/integrations/linear";

export async function GET() {
  const states = await fetchTeamStates();
  return NextResponse.json(states);
}
