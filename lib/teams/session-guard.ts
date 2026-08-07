import "server-only";
import { redirect } from "next/navigation";
import { requireOnboarded, type AuthContext } from "@/lib/auth/guards";
import { logRouteDiagnostic } from "@/lib/observability/diagnostics";
import {
  SESSION_CARD_PRIORITY,
  type AssessmentProduct,
  type SessionState,
} from "@/lib/teams/session";

interface MembershipTeamRow {
  role: string;
  teams: {
    id: string;
    session_mode: string;
    session_state: string;
    assessment_type: string;
    archived_at: string | null;
    updated_at: string;
  } | null;
}

/** Typed authorization outcome — never a silent bounce. */
export type AssessmentDenialReason =
  | "not_team_member"
  | "wrong_team"
  | "wrong_assessment";

export interface AssessmentAuthorization {
  ok: boolean;
  reason?: AssessmentDenialReason;
  /** The facilitated team this attempt binds to; null for individual attempts. */
  teamId: string | null;
  context: AuthContext;
}

async function loadFacilitatedMemberships(
  supabase: AuthContext["supabase"],
  userId: string,
): Promise<MembershipTeamRow[]> {
  const { data } = await supabase
    .from("team_members")
    .select(
      "role, teams (id, session_mode, session_state, assessment_type, archived_at, updated_at)",
    )
    .eq("profile_id", userId);
  return ((data ?? []) as unknown as MembershipTeamRow[]).filter(
    (row) =>
      row.role !== "team_admin" &&
      row.teams &&
      !row.teams.archived_at &&
      row.teams.session_mode === "facilitator_led",
  );
}

/**
 * The single server-side authorization for starting/continuing an assessment.
 *
 * Resolves the authenticated user's facilitated memberships, validates the
 * requested product against the facilitator's selection, and returns the
 * EXACT team the attempt must bind to — with a typed denial reason (logged
 * safely) instead of a silent redirect. Coaches and purely self-paced users
 * authorize as individual attempts (teamId null).
 *
 * The facilitator's session_state NEVER gates entry: membership + the team's
 * selected assessment_type are the whole authorization. The facilitator
 * sequences the presentation and releases results, nothing more.
 */
export async function authorizeAssessment(
  product: AssessmentProduct,
  requestedTeamId?: string | null,
): Promise<AssessmentAuthorization> {
  const context = await requireOnboarded();
  const facilitated = await loadFacilitatedMemberships(context.supabase, context.user.id);

  // Self-paced / coach: individual attempt.
  if (facilitated.length === 0) return { ok: true, teamId: null, context };

  const deny = (reason: AssessmentDenialReason, teamId: string | null): AssessmentAuthorization => {
    logRouteDiagnostic({
      route: `assessment:${product}`,
      teamId: teamId ?? undefined,
      userId: context.user.id,
      step: "authorizeAssessment",
      message: reason,
    });
    return { ok: false, reason, teamId, context };
  };

  // The requested team must be one of the caller's own facilitated teams,
  // running exactly this product — session_state is deliberately not checked.
  if (requestedTeamId) {
    const target = facilitated.find((row) => row.teams!.id === requestedTeamId);
    if (!target) return deny("wrong_team", requestedTeamId);
    if (target.teams!.assessment_type !== product) return deny("wrong_assessment", requestedTeamId);
    return { ok: true, teamId: requestedTeamId, context };
  }

  // No explicit team: bind to the caller's facilitated team for this product.
  // With several, prefer the session the coach is actively running — the same
  // deterministic order the dashboard card uses, so a deep-link start binds
  // to the team the participant sees on their card.
  const candidates = facilitated
    .filter((row) => row.teams!.assessment_type === product)
    .sort(
      (a, b) =>
        (SESSION_CARD_PRIORITY[a.teams!.session_state as SessionState] ?? 9) -
          (SESSION_CARD_PRIORITY[b.teams!.session_state as SessionState] ?? 9) ||
        new Date(b.teams!.updated_at).getTime() - new Date(a.teams!.updated_at).getTime(),
    );
  if (candidates.length > 0) return { ok: true, teamId: candidates[0]!.teams!.id, context };

  return deny("wrong_assessment", null);
}

/** Denials land on the session card with an explicit, human explanation. */
export function redirectForDenial(reason: AssessmentDenialReason): never {
  redirect(`/app?notice=${reason}`);
}

/**
 * Start-action guard: authorize, or redirect WITH the reason. Returns the
 * team the attempt binds to (null = individual).
 */
export async function requireProductAllowed(
  product: AssessmentProduct,
  requestedTeamId?: string | null,
): Promise<{ context: AuthContext; teamId: string | null }> {
  const auth = await authorizeAssessment(product, requestedTeamId);
  if (!auth.ok) redirectForDenial(auth.reason!);
  return { context: auth.context, teamId: auth.teamId };
}

/*
 * There is deliberately no release gate for a participant's OWN result.
 *
 * `teams.session_state` sequences what the facilitator does in the room —
 * present, open the assessment, close it, walk the room through results. It
 * was previously also read as permission to see one's own report, which meant
 * a participant who had finished their assessment was told to wait for their
 * facilitator before they could open, download or email a report about
 * themselves. That coupled a personal artefact to a presentation state that
 * was never about withholding it, and it had no off switch: a facilitator who
 * never advanced the session locked participants out permanently.
 *
 * Completion plus ownership is now the whole authorization for an individual
 * result (`lib/reports/loader.ts`). Team-scoped surfaces — the live deck, the
 * roster, comparisons, team analytics and facilitator insights — keep every
 * check they had; see `requireTeamAdmin` / `requireTeamAccess` and
 * `reviewAllowed`.
 */
