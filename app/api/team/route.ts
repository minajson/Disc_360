import { NextResponse } from "next/server";
import { apiError } from "@/lib/assessment/schemas";
import { getTeamOverview } from "@/lib/insights/team";

export const dynamic = "force-dynamic";

/** GET /api/team — demo team roster, composition, and averages. */
export async function GET() {
  const overview = await getTeamOverview();
  if (!overview) {
    return NextResponse.json(apiError("TEAM_NOT_FOUND", "No team available"), {
      status: 404,
    });
  }
  return NextResponse.json(overview);
}
