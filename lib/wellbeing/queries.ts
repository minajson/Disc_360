import "server-only";
import { z } from "zod";
import { requireOnboarded, type AuthContext } from "@/lib/auth/guards";
import { getWellbeingPolicy, type WellbeingPolicy } from "@/lib/wellbeing/policy";
import { compareToPrevious, type WellbeingComparison } from "@/lib/scoring/wellbeing";
import type { WorkLocation } from "@/data/wellbeing-taxonomy";

/**
 * Reading a participant's OWN wellbeing data.
 *
 * Every function here reads through the caller's own RLS-scoped client, and
 * none of them takes a profile id. There is no argument in which to name
 * somebody else, which is a stronger guarantee than a check that could be
 * edited away later. `wellbeing_results_select_own` does the rest.
 *
 * A miss returns null and every caller turns that into a 404 — an id that
 * exists but belongs to someone else must be indistinguishable from one that
 * does not exist.
 */

/* ── questionnaire ──────────────────────────────────────────────────── */

export interface WellbeingItemView {
  id: string;
  externalId: string;
  position: number;
  prompt: string;
  options: { position: number; label: string }[];
}

export interface WellbeingQuestionnaire {
  versionId: string;
  versionNumber: number;
  name: string;
  items: WellbeingItemView[];
}

/**
 * The active questionnaire, or null.
 *
 * Null is a real, expected product state, not an error: until GHQ-12
 * electronic-use rights are evidenced, no version is `licensed`, and the
 * database refuses to activate a `structure_only` one. The participant surface
 * says so plainly rather than rendering twelve empty questions.
 */
export async function getActiveQuestionnaire(
  context: AuthContext,
): Promise<WellbeingQuestionnaire | null> {
  const { data: version } = await context.supabase
    .from("wellbeing_versions")
    .select("id, name, version, content_status, is_active")
    .eq("is_active", true)
    .maybeSingle();
  if (!version) return null;

  const { data: items } = await context.supabase
    .from("wellbeing_items")
    .select("id, external_id, position, prompt, wellbeing_item_options (position, label)")
    .eq("version_id", version.id)
    .order("position");

  const view: WellbeingItemView[] = (items ?? [])
    .map((item) => ({
      id: item.id as string,
      externalId: item.external_id as string,
      position: item.position as number,
      prompt: (item.prompt as string | null) ?? "",
      options: ((item.wellbeing_item_options ?? []) as { position: number; label: string | null }[])
        .map((option) => ({ position: option.position, label: option.label ?? "" }))
        .sort((a, b) => a.position - b.position),
    }))
    .sort((a, b) => a.position - b.position);

  // An active version with missing wording would be a seeding fault. Treat it
  // as "no questionnaire" rather than showing blank items to a participant.
  const complete =
    view.length === 12 &&
    view.every((item) => item.prompt.length > 0 && item.options.length === 4) &&
    view.every((item) => item.options.every((option) => option.label.length > 0));
  if (!complete) return null;

  return {
    versionId: version.id as string,
    versionNumber: version.version as number,
    name: version.name as string,
    items: view,
  };
}

/* ── form taxonomy ──────────────────────────────────────────────────── */

export interface WellbeingFormOptions {
  departments: { id: string; name: string }[];
  officeLocations: { id: string; name: string }[];
}

/**
 * Department / Function and Office Location for the organisation the
 * participant is assessing in. Governed lookups, not a hard-coded list — an
 * organisation adds a function without a deployment.
 *
 * Platform-level rows (organization_id null) are always included, so a team
 * whose organisation has not customised the taxonomy still gets a usable form.
 */
export async function getWellbeingFormOptions(
  context: AuthContext,
  organizationId: string | null,
): Promise<WellbeingFormOptions> {
  const departmentQuery = context.supabase
    .from("wellbeing_departments")
    .select("id, name, position, organization_id")
    .is("archived_at", null)
    .order("position")
    .order("name");
  const officeQuery = context.supabase
    .from("wellbeing_office_locations")
    .select("id, name, position, organization_id")
    .is("archived_at", null)
    .order("position")
    .order("name");

  // With a known organisation, show its taxonomy plus the platform defaults.
  //
  // Without one — a participant taking a pulse outside any team — do NOT
  // narrow to platform rows only. That produced an empty Department /
  // Function list and an unusable form for anyone whose organisation had
  // customised the taxonomy. Leaving the filter off lets RLS decide, and
  // `can_read_wellbeing_lookup` already scopes it to organisations the person
  // genuinely belongs to.
  const [{ data: departments }, { data: offices }] = await Promise.all([
    organizationId
      ? departmentQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`)
      : departmentQuery,
    organizationId
      ? officeQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`)
      : officeQuery,
  ]);

  // An organisation's own entry outranks a platform entry of the same name, so
  // installing the default catalogue and then renaming one function does not
  // show the participant both spellings.
  const dedupe = (rows: { id: string; name: string; organization_id: string | null }[]) => {
    const byName = new Map<string, { id: string; name: string }>();
    for (const row of rows) {
      const key = row.name.toLowerCase();
      if (!byName.has(key) || row.organization_id !== null) {
        byName.set(key, { id: row.id, name: row.name });
      }
    }
    return [...byName.values()];
  };

  return {
    departments: dedupe((departments ?? []) as never),
    officeLocations: dedupe((offices ?? []) as never),
  };
}

/* ── the participant's own results ──────────────────────────────────── */

export interface WellbeingHistoryRecord {
  id: string;
  completedAt: string;
  totalScore: number;
  threshold: number;
  atOrAboveThreshold: boolean;
  attemptNumber: number | null;
  departmentAtCompletion: string | null;
  workLocationAtCompletion: WorkLocation | null;
  officeLocationAtCompletion: string | null;
  jobTitleAtCompletion: string | null;
  teamNameAtCompletion: string | null;
  organizationNameAtCompletion: string | null;
  questionnaireVersion: number;
  scoringVersion: string;
  /** Movement against the immediately preceding pulse, oldest-first. */
  comparison: WellbeingComparison | null;
}

export interface WellbeingHistory {
  /** Newest first, for the list. */
  records: WellbeingHistoryRecord[];
  /** Oldest first, for the trend chart. */
  chronological: WellbeingHistoryRecord[];
  count: number;
  /** True when the pulses were not all scored against the same threshold. */
  thresholdChanged: boolean;
}

// One string literal, not a concatenation: supabase-js infers the row shape
// from the literal type, and `"a" + "b"` widens to `string`.
const RESULT_COLUMNS =
  "id, profile_id, session_id, total_score, likert_score, threshold_at_completion, at_or_above_threshold, attempt_number, completed_at, questionnaire_version, scoring_version, department_at_completion, work_location_at_completion, office_location_at_completion, job_title_at_completion, team_name_at_completion, organization_name_at_completion";

/**
 * This participant's complete wellbeing history.
 *
 * Every completed pulse is a separate historical record and none is ever
 * replaced: a retake inserts a row, and `wellbeing_results` carries no UPDATE
 * and no DELETE policy at all, so overwriting is not something the API can do
 * even by mistake.
 *
 * Note what is NOT loaded: no management average, no organisational
 * comparison, no cohort figure. A private history is the person's own numbers
 * and nothing else.
 */
export async function getMyWellbeingHistory(): Promise<{
  context: AuthContext;
  history: WellbeingHistory;
}> {
  const context = await requireOnboarded();

  const { data } = await context.supabase
    .from("wellbeing_results")
    .select(RESULT_COLUMNS)
    .eq("profile_id", context.user.id)
    .order("completed_at", { ascending: true });

  const chronological: WellbeingHistoryRecord[] = (data ?? []).map((row, index, all) => {
    const previous = index > 0 ? all[index - 1] : null;
    return {
      id: row.id as string,
      completedAt: row.completed_at as string,
      totalScore: row.total_score as number,
      threshold: row.threshold_at_completion as number,
      atOrAboveThreshold: row.at_or_above_threshold as boolean,
      attemptNumber: (row.attempt_number as number | null) ?? null,
      departmentAtCompletion: (row.department_at_completion as string | null) ?? null,
      workLocationAtCompletion: (row.work_location_at_completion as WorkLocation | null) ?? null,
      officeLocationAtCompletion: (row.office_location_at_completion as string | null) ?? null,
      jobTitleAtCompletion: (row.job_title_at_completion as string | null) ?? null,
      teamNameAtCompletion: (row.team_name_at_completion as string | null) ?? null,
      organizationNameAtCompletion:
        (row.organization_name_at_completion as string | null) ?? null,
      questionnaireVersion: row.questionnaire_version as number,
      scoringVersion: row.scoring_version as string,
      comparison: previous
        ? compareToPrevious(row.total_score as number, previous.total_score as number)
        : null,
    };
  });

  const thresholds = new Set(chronological.map((record) => record.threshold));

  return {
    context,
    history: {
      chronological,
      records: [...chronological].reverse(),
      count: chronological.length,
      thresholdChanged: thresholds.size > 1,
    },
  };
}

export interface OwnWellbeingResult {
  context: AuthContext;
  record: WellbeingHistoryRecord;
  /** Every pulse this person has completed, for the trend on the result page. */
  history: WellbeingHistory;
  policy: WellbeingPolicy;
}

/**
 * One of the participant's own results, by id.
 *
 * The redundant `profile_id === user.id` comparison on top of RLS is
 * deliberate: it means a future policy edit cannot silently widen this path.
 */
export async function loadOwnWellbeingResult(
  resultId: string,
): Promise<OwnWellbeingResult | null> {
  if (!z.uuid().safeParse(resultId).success) return null;

  const { context, history } = await getMyWellbeingHistory();
  const record = history.chronological.find((entry) => entry.id === resultId) ?? null;
  if (!record) return null;

  // Confirm ownership against the row itself rather than trusting the list.
  const { data: row } = await context.supabase
    .from("wellbeing_results")
    .select("id, profile_id, organization_id")
    .eq("id", resultId)
    .maybeSingle();
  if (!row || row.profile_id !== context.user.id) return null;

  const policy = await getWellbeingPolicy(
    context.supabase,
    (row.organization_id as string | null) ?? null,
  );

  return { context, record, history, policy };
}
