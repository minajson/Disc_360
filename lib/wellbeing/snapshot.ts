import "server-only";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import type { WorkLocation } from "@/data/wellbeing-taxonomy";

/**
 * Wellbeing context snapshot, frozen at completion.
 *
 * Same principle as lib/history/snapshot.ts, and for the same reason: a
 * person's department, team, job title and organisation are all mutable, and
 * resolving them at read time would silently rewrite history. A pulse taken in
 * Production in January must still read as Production in January after the
 * person moves to Wells in June — otherwise a trend line reports a movement
 * that never happened.
 *
 * The operational context (Department / Function, Work Location, Office
 * Location, job title) is answered by the PARTICIPANT on the form and copied
 * from their session, not inferred from any team record. That matters: the
 * existing `team_members.department` column is the product's "Sub Team", which
 * is a different question with a different answer set.
 *
 * Every field degrades to null rather than to a guess.
 */

export interface WellbeingSnapshot {
  team_id: string | null;
  organization_id: string | null;
  team_series_id: string | null;
  department_at_completion: string | null;
  work_location_at_completion: WorkLocation | null;
  office_location_at_completion: string | null;
  job_title_at_completion: string | null;
  team_name_at_completion: string | null;
  organization_name_at_completion: string | null;
  attempt_number: number;
}

export interface WellbeingSnapshotInput {
  profileId: string;
  teamId: string | null;
  /** The context the participant supplied on this attempt. */
  departmentName: string | null;
  workLocation: WorkLocation | null;
  officeLocationName: string | null;
  jobTitle: string | null;
}

/**
 * Service role, read-only, and narrowly scoped: this participant's own count
 * of prior wellbeing results, and the team's own name/organisation.
 *
 * The bypass is justified because a plain team member cannot read their
 * organisation's name under RLS — they are a team member, not an org member —
 * yet the snapshot is a record of where they assessed. No other row is read,
 * and nothing is read about any other person.
 */
export async function buildWellbeingSnapshot(
  input: WellbeingSnapshotInput,
): Promise<WellbeingSnapshot> {
  const admin = createSupabaseAdminClient();

  const { count: priorCount } = await admin
    .from("wellbeing_results")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", input.profileId);

  const snapshot: WellbeingSnapshot = {
    team_id: input.teamId,
    organization_id: null,
    team_series_id: null,
    department_at_completion: input.departmentName,
    work_location_at_completion: input.workLocation,
    // Field-based work carries no office location, ever — the database
    // enforces it too, but a snapshot that had to be corrected by a constraint
    // would already be wrong in the row it came from.
    office_location_at_completion:
      input.workLocation === "office_based" ? input.officeLocationName : null,
    job_title_at_completion: input.jobTitle,
    team_name_at_completion: null,
    organization_name_at_completion: null,
    // 1-based within this participant's own wellbeing history. Written once,
    // never recomputed, so it stays stable whatever happens later.
    attempt_number: (priorCount ?? 0) + 1,
  };

  if (!input.teamId) return snapshot;

  const { data: team } = await admin
    .from("teams")
    .select("name, organization_id, team_series_id, organizations (name)")
    .eq("id", input.teamId)
    .maybeSingle();

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

  return snapshot;
}
