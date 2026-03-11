import { NextResponse } from "next/server";
import { fetchTeamMembers } from "@/lib/integrations/linear";

export async function GET() {
  const members = await fetchTeamMembers();
  return NextResponse.json(members);
}
