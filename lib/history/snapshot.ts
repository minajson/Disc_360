import "server-only";
import { createSupabaseAdminClient } from "@/lib/db/admin";

/**
 * Context snapshot, taken at completion.
 *
 * A historical result must stay readable as it was on the day. Departments
 * change, teams get renamed, people move roles, organisations restructure —
 * and every one of those is a mutable field somewhere else in the database.
 * Resolving them at read time would silently rewrite history: a two-year-old
 * result would show today's job title.
 *
 * So the values are copied onto the result row once, at the moment it is
 * written, and never updated afterwards.
 */

/** Bumped only when the scoring contract changes. Frozen by lib/scoring/freeze.test.ts. */
export const SCORING_VERSION = "1.0.0";

export interface ResultSnapshot {
  role_at_completion: string | null;
  department_at_completion: string | null;
  team_name_at_completion: string | null;
  organization_name_at_completion: string | null;
  organization_id: string | null;
  team_series_id: string | null;
  assessment_version: number | null;
  scoring_version: string;
  attempt_number: number;
}

interface SnapshotInput {
  profileId: string;
  /** Null for an individual attempt taken outside any team. */
  teamId: string | null;
  /** Which result table the attempt number counts within. */
  table: "assessment_results" | "focus_results";
  /** Active assessment version number, when known. */
  assessmentVersion?: number | null;
}

/**
 * Service role, read-only, and narrowly scoped: the participant's own
 * profession, their own membership row for this team, and the team's own
 * name/organisation. A plain team member cannot read their organisation's
 * name under RLS (they are a team member, not an org member), which is
 * correct for browsing — but the snapshot is a record of where they assessed,
 * so it is resolved here and frozen onto the row.
 *
 * Every field degrades to null rather than to a guess. A result written
 * before snapshots existed shows "context not recorded", which is honest;
 * filling it in from today's values would be a fabricated historical record.
 */
export async function buildResultSnapshot(
  input: SnapshotInput,
): Promise<ResultSnapshot> {
  const admin = createSupabaseAdminClient();

  const [{ data: profile }, { count: priorCount }] = await Promise.all([
    admin.from("profiles").select("profession").eq("id", input.profileId).maybeSingle(),
    admin
      .from(input.table)
      .select("id", { count: "exact", head: true })
      .eq("profile_id", input.profileId),
  ]);

  const snapshot: ResultSnapshot = {
    role_at_completion: profile?.profession ?? null,
    department_at_completion: null,
    team_name_at_completion: null,
    organization_name_at_completion: null,
    organization_id: null,
    team_series_id: null,
    assessment_version: input.assessmentVersion ?? null,
    scoring_version: SCORING_VERSION,
    // 1-based within this participant's own history for this assessment kind.
    attempt_number: (priorCount ?? 0) + 1,
  };

  if (!input.teamId) return snapshot;

  const [{ data: team }, { data: member }] = await Promise.all([
    admin
      .from("teams")
      .select("name, organization_id, team_series_id, organizations (name)")
      .eq("id", input.teamId)
      .maybeSingle(),
    admin
      .from("team_members")
      .select("department")
      .eq("team_id", input.teamId)
      .eq("profile_id", input.profileId)
      .maybeSingle(),
  ]);

  if (team) {
    const organization = Array.isArray(team.organizations)
      ? team.organizations[0]
      : team.organizations;
    snapshot.team_name_at_completion = team.name;
    snapshot.organization_id = team.organization_id;
    snapshot.organization_name_at_completion =
      (organization as { name: string } | null)?.name ?? null;
    snapshot.team_series_id = team.team_series_id ?? null;
  }
  // The member's department on the team they assessed for — not their
  // department today, and not their department on some other team.
  if (member?.department) snapshot.department_at_completion = member.department;

  return snapshot;
}
