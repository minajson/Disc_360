import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/server";

/**
 * Live-session state for participant followers. Read under the caller's own
 * RLS (members can read their team's row) — a non-member gets 404, and only
 * the participant-safe fields ever leave: state and slide index.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: team } = await supabase
    .from("teams")
    .select("session_state, active_slide, assessment_type")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json(
    {
      state: team.session_state,
      activeSlide: team.active_slide ?? 0,
      assessmentType: team.assessment_type,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
