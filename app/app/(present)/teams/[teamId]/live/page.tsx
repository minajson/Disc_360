import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTeamAccess } from "@/lib/auth/guards";
import { getDeck, isDeckType } from "@/lib/presentations/registry";
import { LiveDeckFollower } from "@/components/teams/LiveDeckFollower";
import {
  reviewAllowed,
  type PresentationAccess,
  type SessionState,
} from "@/lib/teams/session";

export const metadata: Metadata = { title: "Live session" };

/**
 * Participant live view: follows the facilitator's current slide for the
 * team's SELECTED assessment only. Review mode (free browsing) is available
 * exactly when the coach's presentation-access setting allows it.
 */
export default async function LiveSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { teamId } = await params;
  const { mode: modeParam } = await searchParams;
  const { supabase } = await requireTeamAccess(teamId);

  const { data: team } = await supabase
    .from("teams")
    .select("assessment_type, session_state, active_slide, presentation_access")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) redirect("/app");

  const state = team.session_state as SessionState;
  const access = team.presentation_access as PresentationAccess;
  const wantsReview = modeParam === "review";

  if (wantsReview && !reviewAllowed(state, access)) redirect("/app");
  if (!wantsReview && state !== "presentation") {
    // No live presentation running: fall back to review when allowed,
    // otherwise back to the session card.
    redirect(reviewAllowed(state, access) ? `/app/teams/${teamId}/live?mode=review` : "/app");
  }

  const deckType = isDeckType(team.assessment_type) ? team.assessment_type : "disc";
  const deck = getDeck(deckType);

  return (
    <LiveDeckFollower
      deck={deck}
      teamId={teamId}
      mode={wantsReview ? "review" : "live"}
      initialSlide={team.active_slide ?? 0}
      initialState={state}
    />
  );
}
