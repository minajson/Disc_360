import { NextResponse } from "next/server";
import { apiError } from "@/lib/assessment/schemas";
import { getCurrentUser } from "@/lib/auth";
import { getHistory } from "@/lib/insights/history";

export const dynamic = "force-dynamic";

/** GET /api/history?limit=20 — newest-first result summaries. */
export async function GET(request: Request) {
  const limitParam = new URL(request.url).searchParams.get("limit");
  let limit: number | undefined;
  if (limitParam !== null) {
    limit = Number(limitParam);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        apiError("INVALID_LIMIT", "limit must be an integer between 1 and 100"),
        { status: 400 },
      );
    }
  }

  const user = await getCurrentUser();
  const history = await getHistory(user.id, limit);
  return NextResponse.json(history);
}
