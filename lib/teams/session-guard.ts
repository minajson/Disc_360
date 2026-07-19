import "server-only";
import { redirect } from "next/navigation";
import { requireOnboarded, type AuthContext } from "@/lib/auth/guards";
import type { AssessmentProduct } from "@/lib/teams/session";

interface MembershipTeamRow {
  role: string;
  teams: {
    session_mode: string;
    session_state: string;
    assessment_type: string;
    archived_at: string | null;
  } | null;
}

/**
 * Server-side assessment lock for facilitator-led participants.
 *
 * Hiding buttons is presentation; THIS is the enforcement: a participant who
 * belongs to a facilitator-led team can only start the assessment their
 * facilitator selected, and only while its window is open. Every start
 * action calls this before creating any session, so deep links to another
 * product's start path are rejected at the backend regardless of UI.
 *
 * Coaches (team_admin) and purely self-paced users are unaffected.
 */
export async function requireProductAllowed(
  product: AssessmentProduct,
): Promise<AuthContext> {
  const context = await requireOnboarded();
  const { supabase, user } = context;

  const { data: memberships } = await supabase
    .from("team_members")
    .select("role, teams (session_mode, session_state, assessment_type, archived_at)")
    .eq("profile_id", user.id);

  const facilitated = ((memberships ?? []) as unknown as MembershipTeamRow[]).filter(
    (row) =>
      row.role !== "team_admin" &&
      row.teams &&
      !row.teams.archived_at &&
      row.teams.session_mode === "facilitator_led",
  );

  // No facilitator-led membership → the self-paced catalogue applies.
  if (facilitated.length === 0) return context;

  const allowed = facilitated.some(
    (row) =>
      row.teams!.assessment_type === product &&
      row.teams!.session_state === "assessment_open",
  );
  if (!allowed) redirect("/app");

  return context;
}
