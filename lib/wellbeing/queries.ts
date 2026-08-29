import "server-only";
import { z } from "zod";
import { requireOnboarded, type AuthContext } from "@/lib/auth/guards";
import { getWellbeingPolicy, type WellbeingPolicy } from "@/lib/wellbeing/policy";
import { compareToPrevious, type WellbeingComparison } from "@/lib/scoring/wellbeing";
import type { WorkLocation } from "@/data/wellbeing-taxonomy";
import { compareIndex, type IndexComparison } from "@/lib/scoring/disc360-wellbeing";
import {
  INSTRUMENT_KEYS,
  INSTRUMENTS,
  isInstrumentKey,
  type InstrumentKey,
  type InstrumentMetadata,
} from "@/data/wellbeing-instruments";
import {
  DISC360_WELLBEING_INSTRUCTION,
  type DimensionKey,
} from "@/data/disc360-wellbeing-items";

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
  /** Short internal label, e.g. "Focus". Null for instruments without facets. */
  facet: string | null;
  /** Null for GHQ, which has no dimensions. */
  dimensionKey: DimensionKey | null;
  options: { position: number; label: string }[];
}

export interface WellbeingQuestionnaire {
  versionId: string;
  versionNumber: number;
  name: string;
  instrumentKey: InstrumentKey;
  instrument: InstrumentMetadata;
  /** Shown once above the items. Empty for instruments that carry none. */
  instruction: string;
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
  instrumentKey: InstrumentKey,
): Promise<WellbeingQuestionnaire | null> {
  const { data: version } = await context.supabase
    .from("wellbeing_versions")
    .select("id, name, version, content_status, is_active, instrument_key")
    .eq("is_active", true)
    .eq("instrument_key", instrumentKey)
    .maybeSingle();
  if (!version) return null;
  return loadQuestionnaire(context, version, instrumentKey);
}

/**
 * The questionnaire for an EXACT version id. The participant-path loader.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS, AND WHY IT IS NOT `getActiveQuestionnaire`.
 *
 * A campaign pins `version_id` at creation. Everything downstream of that pin
 * must read the pin — not "the active version", which is a fact about the
 * clock rather than about the campaign somebody joined.
 *
 * The assessment runner already CLAIMED to do this. Its comment read "the
 * questionnaire is the one THIS session was started with — never a freshly
 * resolved active one, which could differ if a facilitator changed the
 * campaign mid-flight", and directly beneath it the code called
 * `getActiveQuestionnaire(context, instrumentKey)`. The comment described the
 * intended behaviour; the call resolved by `is_active` and ignored
 * `session.version_id` entirely. Activate a second version while somebody is
 * part-way through and their remaining items come from the new wording, silently.
 *
 * So the pinned read is a function of its own, and it takes the version id
 * rather than an instrument key — there is no argument in which to pass "the
 * active one" by accident.
 *
 * The instrument is verified against the version rather than trusted from the
 * caller: a session's `instrument_key` and `version_id` must agree, and if
 * they do not this returns null rather than rendering one instrument's items
 * under another's scoring.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function getQuestionnaireByVersion(
  context: AuthContext,
  versionId: string,
): Promise<WellbeingQuestionnaire | null> {
  const { data: version } = await context.supabase
    .from("wellbeing_versions")
    .select("id, name, version, content_status, is_active, instrument_key")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) return null;

  const instrumentKey = version.instrument_key as string;
  if (!isInstrumentKey(instrumentKey)) return null;

  // A version that is not licensed carries no wording that may be served.
  // `is_active` is deliberately NOT required: a campaign's pinned version must
  // keep serving its own participants after a newer version is activated,
  // which is the entire point of pinning it.
  if (version.content_status !== "licensed") return null;

  return loadQuestionnaire(context, version, instrumentKey);
}

/** Shared body: the items, options and completeness check for one version. */
async function loadQuestionnaire(
  context: AuthContext,
  version: { id: string; name: string; version: number },
  instrumentKey: InstrumentKey,
): Promise<WellbeingQuestionnaire | null> {

  const { data: items } = await context.supabase
    .from("wellbeing_items")
    .select(
      "id, external_id, position, prompt, facet, dimension_key, wellbeing_item_options (position, label)",
    )
    .eq("version_id", version.id)
    .order("position");

  const view: WellbeingItemView[] = (items ?? [])
    .map((item) => ({
      id: item.id as string,
      externalId: item.external_id as string,
      position: item.position as number,
      prompt: (item.prompt as string | null) ?? "",
      facet: (item.facet as string | null) ?? null,
      dimensionKey: (item.dimension_key as DimensionKey | null) ?? null,
      options: ((item.wellbeing_item_options ?? []) as { position: number; label: string | null }[])
        .map((option) => ({ position: option.position, label: option.label ?? "" }))
        .sort((a, b) => a.position - b.position),
    }))
    .sort((a, b) => a.position - b.position);

  // An active version with missing wording would be a seeding fault. Treat it
  // as "no questionnaire" rather than showing blank items to a participant.
  // Counts come from the instrument, so GHQ's 12x4 and DISC360 Wellbeing's
  // 12x5 are each checked against their own shape rather than a shared guess.
  const instrument = INSTRUMENTS[instrumentKey];
  const complete =
    view.length === instrument.itemCount &&
    view.every(
      (item) =>
        item.prompt.length > 0 && item.options.length === instrument.responseOptionCount,
    ) &&
    view.every((item) => item.options.every((option) => option.label.length > 0));
  if (!complete) return null;

  return {
    versionId: version.id as string,
    versionNumber: version.version as number,
    name: version.name as string,
    instrumentKey,
    instrument,
    instruction: INSTRUMENT_INSTRUCTION[instrumentKey] ?? "",
    items: view,
  };
}

/**
 * The instruction shown above the items.
 *
 * Instrument-owned rather than a shared string: GHQ's items are asked against
 * "recently, compared with usual" and DISC360 Wellbeing's against "the past
 * two weeks", and blurring the two would change what people are answering.
 */
const INSTRUMENT_INSTRUCTION: Record<InstrumentKey, string> = {
  ghq12: "",
  ghq28: "",
  who5: "",
  disc360_wellbeing_v1: DISC360_WELLBEING_INSTRUCTION,
};

export interface InstrumentAvailability {
  key: InstrumentKey;
  instrument: InstrumentMetadata;
  /** True when a licensed, active version exists for participants. */
  available: boolean;
  /** Why not, for the facilitator's picker. */
  unavailableReason: string | null;
}

/**
 * Which instruments a facilitator may actually run right now.
 *
 * An instrument with no live version is returned as unavailable WITH its
 * reason rather than omitted, so the picker can show GHQ-12 greyed out and
 * explain itself. Silently dropping it would look like the feature does not
 * exist; silently substituting the other instrument would be worse.
 */
export async function getInstrumentAvailability(
  context: AuthContext,
): Promise<InstrumentAvailability[]> {
  const { data: versions } = await context.supabase
    .from("wellbeing_versions")
    .select("instrument_key, is_active, content_status")
    .eq("is_active", true);

  const live = new Set((versions ?? []).map((row) => row.instrument_key as string));

  return (Object.keys(INSTRUMENTS) as InstrumentKey[]).map((key) => {
    const available = live.has(key);
    return {
      key,
      instrument: INSTRUMENTS[key],
      available,
      unavailableReason: available
        ? null
        : INSTRUMENTS[key].licensing === "external_rights_required"
          ? "Not available — questionnaire content awaiting licence confirmation"
          : "Not available — no active questionnaire version",
    };
  });
}

/** The instrument a team's Wellbeing Pulse session runs, if one is chosen. */
export async function getTeamInstrument(
  context: AuthContext,
  teamId: string,
): Promise<InstrumentKey | null> {
  const { data: team } = await context.supabase
    .from("teams")
    .select("wellbeing_instrument_key")
    .eq("id", teamId)
    .maybeSingle();
  const key = team?.wellbeing_instrument_key as string | null;
  return key && isInstrumentKey(key) ? key : null;
}


/** A campaign a participant belongs to, reduced to what the pulse page needs. */
export interface ParticipantCampaign {
  campaignId: string;
  instrumentKey: InstrumentKey;
  versionId: string;
}

/**
 * Every ACTIVE wellbeing campaign this participant is on the roster of.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS RETURNS A LIST, AND WHY THE LIST IS THE PARTICIPANT'S OWN.
 *
 * The predecessor answered "which wellbeing TEAM am I on", returned null for
 * anyone on more than one, and left the caller to ask that team for its
 * instrument — which the team knew, while the VERSION had to be filled in by
 * `getActiveQuestionnaire()`. That is the clock-derived resolution this whole
 * refactor exists to remove.
 *
 * Returning a list rather than an optional single campaign matters as much.
 * Collapsing to null the moment somebody belonged to two campaigns meant a
 * real participant — anyone in a pilot and a follow-up, or anyone in the demo
 * organisation — was told the check-in was not open, with no way to say which
 * one they meant. The campaign id in the link is how they say it; this list is
 * what that id is checked AGAINST.
 *
 * The membership is read through the participant's OWN client, so the list can
 * only ever contain campaigns they are genuinely on. A campaign id from a URL
 * can therefore narrow this list but never extend it.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function getMyWellbeingCampaigns(
  context: AuthContext,
): Promise<ParticipantCampaign[]> {
  const { data: memberships } = await context.supabase
    .from("team_members")
    .select("team_id")
    .eq("profile_id", context.user.id);

  const teamIds = [...new Set((memberships ?? []).map((row) => row.team_id as string))];
  if (teamIds.length === 0) return [];

  const { data } = await context.supabase
    .from("wellbeing_campaigns")
    .select("id, instrument_key, version_id, status")
    .in("team_id", teamIds)
    .eq("status", "active");

  return (data ?? [])
    .filter((row) => isInstrumentKey(row.instrument_key as string))
    .map((row) => ({
      campaignId: row.id as string,
      instrumentKey: row.instrument_key as InstrumentKey,
      versionId: row.version_id as string,
    }));
}

/**
 * Which campaign this participant is about to answer.
 *
 * The id from the link when it names one of THEIR campaigns; otherwise the
 * single campaign they belong to; otherwise null. Never a guess between two —
 * somebody offered the wrong questionnaire cannot tell that it was a guess.
 */
export function resolveParticipantCampaign(
  campaigns: ParticipantCampaign[],
  requestedId: string | undefined,
): ParticipantCampaign | null {
  if (requestedId) {
    return campaigns.find((campaign) => campaign.campaignId === requestedId) ?? null;
  }
  return campaigns.length === 1 ? campaigns[0]! : null;
}

/* ── form taxonomy ──────────────────────────────────────────────────── */

export interface WellbeingSubUnitOption {
  id: string;
  name: string;
  /**
   * The Department / Function this sub-unit belongs to, where it has one.
   *
   * Null means "offered under any department" — correct for a cross-functional
   * unit, and the reason the form falls back to showing everything rather than
   * an empty list when a participant picks a department nothing hangs from.
   */
  departmentId: string | null;
}

export interface WellbeingFormOptions {
  departments: { id: string; name: string }[];
  subUnits: WellbeingSubUnitOption[];
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
  // Sub-units are always tenant-owned — there is no platform catalogue of
  // them — so this needs no platform-row union. Retired units are excluded by
  // `is_active` rather than deleted, so results that name one still read.
  const subUnitQuery = context.supabase
    .from("wellbeing_sub_units")
    .select("id, name, department_id, organization_id, sort_order")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  // With a known organisation, show its taxonomy plus the platform defaults.
  //
  // Without one — a participant taking a pulse outside any team — do NOT
  // narrow to platform rows only. That produced an empty Department /
  // Function list and an unusable form for anyone whose organisation had
  // customised the taxonomy. Leaving the filter off lets RLS decide, and
  // `can_read_wellbeing_lookup` already scopes it to organisations the person
  // genuinely belongs to.
  const [{ data: departments }, { data: offices }, { data: subUnits }] = await Promise.all([
    organizationId
      ? departmentQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`)
      : departmentQuery,
    organizationId
      ? officeQuery.or(`organization_id.eq.${organizationId},organization_id.is.null`)
      : officeQuery,
    organizationId ? subUnitQuery.eq("organization_id", organizationId) : subUnitQuery,
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
    // No dedupe: the unique index already guarantees one name per
    // organisation, and there is no platform layer to override.
    subUnits: (subUnits ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      departmentId: (row.department_id as string | null) ?? null,
    })),
  };
}

/* ── the participant's own results ──────────────────────────────────── */

export interface WellbeingDimensionScore {
  key: DimensionKey;
  raw: number;
  index: number;
}

export interface WellbeingHistoryRecord {
  id: string;
  instrumentKey: InstrumentKey;
  completedAt: string;
  /** The instrument's RAW score: 0–12 for GHQ, 0–48 for DISC360 Wellbeing. */
  totalScore: number;
  /** 0–100. Null for GHQ, which normalises nothing. */
  indexScore: number | null;
  /** Null for instruments without a threshold — DISC360 Wellbeing V1 has none. */
  threshold: number | null;
  atOrAboveThreshold: boolean | null;
  /**
   * The participant's own response positions, in administration order.
   *
   * Loaded ONLY by the own-result query, which is scoped to
   * `profile_id = <the caller>`. It exists so a participant's own GHQ-28
   * result can show support information when Section D was answered
   * positively. It must never be added to a facilitator, analytics or
   * reporting query — a test asserts that.
   */
  itemPositions: number[] | null;
  /** Empty for GHQ. Six entries, in display order, for DISC360 Wellbeing. */
  dimensions: WellbeingDimensionScore[];
  /** Movement of the 0–100 index against the previous pulse of the SAME instrument. */
  indexComparison: IndexComparison | null;
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

/**
 * A participant's history, split by instrument.
 *
 * Never merged. The two instruments measure different things on different
 * scales running in opposite directions, so a single combined series would be
 * meaningless at best. Each instrument gets its own chart, its own movement
 * and its own trend.
 */
export type WellbeingHistoryByInstrument = Record<InstrumentKey, WellbeingHistory> & {
  /** Instruments this participant has actually completed at least once. */
  completedInstruments: InstrumentKey[];
};

// One string literal, not a concatenation: supabase-js infers the row shape
// from the literal type, and `"a" + "b"` widens to `string`.
// One string literal, not a concatenation: supabase-js infers the row shape
// from the literal type, and `"a" + "b"` widens to `string`.
const RESULT_COLUMNS =
  "id, profile_id, session_id, instrument_key, total_score, index_score, likert_score, item_positions, threshold_at_completion, at_or_above_threshold, attempt_number, completed_at, questionnaire_version, scoring_version, department_at_completion, work_location_at_completion, office_location_at_completion, job_title_at_completion, team_name_at_completion, organization_name_at_completion, wellbeing_result_dimensions (dimension_key, raw_score, index_score)";

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
  history: WellbeingHistoryByInstrument;
}> {
  const context = await requireOnboarded();

  const { data } = await context.supabase
    .from("wellbeing_results")
    .select(RESULT_COLUMNS)
    .eq("profile_id", context.user.id)
    .order("completed_at", { ascending: true });

  const rows = (data ?? []) as unknown as ResultRow[];

  // Split FIRST, then compare within each instrument. Comparing a GHQ result
  // against a DISC360 Wellbeing result would produce a movement figure from
  // two different scales pointing in opposite directions.
  const byInstrument = Object.fromEntries(
    INSTRUMENT_KEYS.map((key) => [key, [] as ResultRow[]]),
  ) as Record<InstrumentKey, ResultRow[]>;
  for (const row of rows) {
    const key = row.instrument_key;
    if (isInstrumentKey(key)) byInstrument[key].push(row);
  }

  const build = (instrumentRows: ResultRow[]): WellbeingHistory => {
    const chronological = instrumentRows.map((row, index, all) =>
      toHistoryRecord(row, index > 0 ? all[index - 1]! : null),
    );
    const thresholds = new Set(
      chronological
        .map((record) => record.threshold)
        .filter((value): value is number => value !== null),
    );
    return {
      chronological,
      records: [...chronological].reverse(),
      count: chronological.length,
      thresholdChanged: thresholds.size > 1,
    };
  };

  const history = {
    ...(Object.fromEntries(
      INSTRUMENT_KEYS.map((key) => [key, build(byInstrument[key])]),
    ) as Record<InstrumentKey, WellbeingHistory>),
    completedInstruments: INSTRUMENT_KEYS.filter((key) => byInstrument[key].length > 0),
  } satisfies WellbeingHistoryByInstrument;

  return { context, history };
}

interface ResultRow {
  id: string;
  profile_id: string;
  session_id: string;
  instrument_key: string;
  total_score: number;
  index_score: number | null;
  likert_score: number | null;
  threshold_at_completion: number | null;
  at_or_above_threshold: boolean | null;
  attempt_number: number | null;
  completed_at: string;
  questionnaire_version: number;
  scoring_version: string;
  item_positions: number[] | null;
  department_at_completion: string | null;
  work_location_at_completion: WorkLocation | null;
  office_location_at_completion: string | null;
  job_title_at_completion: string | null;
  team_name_at_completion: string | null;
  organization_name_at_completion: string | null;
  wellbeing_result_dimensions: {
    dimension_key: string;
    raw_score: number;
    index_score: number;
  }[] | null;
}

function toHistoryRecord(row: ResultRow, previous: ResultRow | null): WellbeingHistoryRecord {
  const dimensions: WellbeingDimensionScore[] = (row.wellbeing_result_dimensions ?? [])
    .map((dimension) => ({
      key: dimension.dimension_key as DimensionKey,
      raw: dimension.raw_score,
      index: dimension.index_score,
    }))
    .sort(
      (a, b) => DIMENSION_DISPLAY_ORDER.indexOf(a.key) - DIMENSION_DISPLAY_ORDER.indexOf(b.key),
    );

  return {
    id: row.id,
    instrumentKey: row.instrument_key as InstrumentKey,
    completedAt: row.completed_at,
    totalScore: row.total_score,
    indexScore: row.index_score,
    threshold: row.threshold_at_completion,
    atOrAboveThreshold: row.at_or_above_threshold,
    dimensions,
    attemptNumber: row.attempt_number,
    itemPositions: (row.item_positions as number[] | null) ?? null,
    departmentAtCompletion: row.department_at_completion,
    workLocationAtCompletion: row.work_location_at_completion,
    officeLocationAtCompletion: row.office_location_at_completion,
    jobTitleAtCompletion: row.job_title_at_completion,
    teamNameAtCompletion: row.team_name_at_completion,
    organizationNameAtCompletion: row.organization_name_at_completion,
    questionnaireVersion: row.questionnaire_version,
    scoringVersion: row.scoring_version,
    comparison:
      previous !== null ? compareToPrevious(row.total_score, previous.total_score) : null,
    indexComparison:
      previous !== null && row.index_score !== null && previous.index_score !== null
        ? compareIndex(row.index_score, previous.index_score)
        : null,
  };
}

const DIMENSION_DISPLAY_ORDER: DimensionKey[] = [
  "capacity",
  "recovery_demand",
  "emotional_resilience",
  "connection_safety",
  "purpose_confidence",
  "everyday_wellbeing",
];

export interface OwnWellbeingResult {
  context: AuthContext;
  record: WellbeingHistoryRecord;
  /** This participant's history FOR THIS INSTRUMENT ONLY. */
  history: WellbeingHistory;
  instrument: InstrumentMetadata;
  /** Only meaningful for instruments that carry a threshold. */
  policy: WellbeingPolicy;
}

/**
 * One of the participant's own results, by id.
 *
 * The redundant `profile_id === user.id` comparison on top of RLS is
 * deliberate: it means a future policy edit cannot silently widen this path.
 *
 * The history returned alongside is scoped to the SAME instrument as the
 * result, so a DISC360 Wellbeing result never draws a trend line through GHQ
 * pulses, or the reverse.
 */
export async function loadOwnWellbeingResult(
  resultId: string,
): Promise<OwnWellbeingResult | null> {
  if (!z.uuid().safeParse(resultId).success) return null;

  const { context, history } = await getMyWellbeingHistory();

  const found = (Object.keys(INSTRUMENTS) as InstrumentKey[])
    .map((key) => ({
      key,
      record: history[key].chronological.find((entry) => entry.id === resultId) ?? null,
    }))
    .find((entry) => entry.record !== null);
  if (!found?.record) return null;

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

  return {
    context,
    record: found.record,
    history: history[found.key],
    instrument: INSTRUMENTS[found.key],
    policy,
  };
}
