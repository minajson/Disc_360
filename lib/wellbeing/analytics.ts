import "server-only";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { requireWellbeingAnalyst, type WellbeingRole } from "@/lib/wellbeing/access";
import { getWellbeingPolicy } from "@/lib/wellbeing/policy";
import {
  aggregateScores,
  buildTrend,
  itemSignals,
  type ItemSignal,
  type WavePoint,
  type WellbeingAggregate,
  type WellbeingTrend,
} from "@/lib/wellbeing/aggregate";
import {
  checkSlice,
  suppressPartition,
  SUPPRESSION_MESSAGE,
  type CohortOutcome,
} from "@/lib/wellbeing/suppression";
import { WORK_LOCATION_LABEL, type WorkLocation } from "@/data/wellbeing-taxonomy";

/**
 * Organisational Wellbeing Pulse analytics.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE THREE THINGS THIS MODULE GUARANTEES.
 *
 *  1 · AUTHORIZE, THEN READ. `requireWellbeingAnalyst` runs before the service
 *      role is created, and every query is constrained to the one organisation
 *      id that guard returned. The service role is never handed a
 *      caller-supplied organisation.
 *
 *  2 · NO IDENTITY IS EVER SELECTED. The result reader below does not request
 *      `profile_id`, `session_id` or `id`. Not "requests it and drops it" —
 *      does not request it. There is therefore no identity in this module's
 *      memory to leak through a payload, a log line or a stack trace, and
 *      `WELLBEING_ANALYTICS_COLUMNS` is asserted in the test suite so a future
 *      edit that adds one fails the build.
 *
 *  3 · SUPPRESSION HAPPENS BEFORE THE PAYLOAD EXISTS. A cohort under the floor
 *      never has its figures computed into a return value. Nothing is
 *      "hidden in the client", because nothing reaches the client.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Exactly the columns aggregate analytics may read.
 *
 * Frozen by lib/wellbeing/analytics.test.ts. Adding an identifying column here
 * is the single edit that would turn group reporting into individual
 * reporting, so it is a test failure rather than a review comment.
 */
export const WELLBEING_ANALYTICS_COLUMNS =
  "total_score, threshold_at_completion, at_or_above_threshold, completed_at, team_id, department_at_completion, work_location_at_completion, office_location_at_completion, item_positions";

/** Columns that must never appear in an analytics read. */
export const FORBIDDEN_ANALYTICS_COLUMNS = [
  "profile_id",
  "session_id",
  "contact_email",
  "job_title_at_completion",
  "likert_score",
] as const;

interface AnalyticsRow {
  total_score: number;
  threshold_at_completion: number;
  at_or_above_threshold: boolean;
  completed_at: string;
  team_id: string | null;
  department_at_completion: string | null;
  work_location_at_completion: WorkLocation | null;
  office_location_at_completion: string | null;
  item_positions: number[];
}

export type CompareDimension = "department" | "work_location" | "office_location" | "team";

export const COMPARE_DIMENSIONS: readonly { key: CompareDimension; label: string }[] = [
  { key: "department", label: "Department / Function" },
  { key: "work_location", label: "Work Location" },
  { key: "office_location", label: "Office Location" },
  { key: "team", label: "Team" },
];

export interface WellbeingAnalyticsContext {
  organizationId: string;
  organizationName: string;
  role: WellbeingRole;
  threshold: number;
  minCohort: number;
  /** True when the shipped defaults are in force rather than a governed row. */
  policyIsDefault: boolean;
}

export interface WellbeingWorkspace {
  context: WellbeingAnalyticsContext;
  /** Null when the whole organisation is below the confidentiality floor. */
  overview: WellbeingAggregate | null;
  overviewSuppressed: string | null;
  invited: number;
  trend: WellbeingTrend;
  trendSuppressedWaves: number;
}

export interface CohortStats {
  completed: number;
  median: number;
  mean: number;
  atOrAboveThresholdShare: number;
  participation: number | null;
}

export interface ComparisonView {
  dimension: CompareDimension;
  label: string;
  cohorts: CohortOutcome<CohortStats>[];
  publishedCount: number;
  suppressedCount: number;
  fullySuppressed: boolean;
}

export interface SignalRow {
  key: string;
  label: string;
  completed: number | null;
  signals: ItemSignal[] | null;
  suppressed: boolean;
  message: string | null;
}

/* ── reading ────────────────────────────────────────────────────────── */

/**
 * Every completed wellbeing result inside one authorised organisation.
 *
 * Service role, because individual results are unreadable under RLS by design
 * — including to the analyst. The bypass is justified and bounded: the query
 * is pinned to the organisation the guard returned, and it selects no column
 * that could identify a person.
 */
async function readOrganizationResults(
  organizationId: string,
  teamIds?: string[],
): Promise<AnalyticsRow[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("wellbeing_results")
    .select(WELLBEING_ANALYTICS_COLUMNS)
    .eq("organization_id", organizationId)
    .order("completed_at", { ascending: true });
  if (teamIds && teamIds.length > 0) query = query.in("team_id", teamIds);

  const { data } = await query;
  return (data ?? []) as unknown as AnalyticsRow[];
}

/** The denominator for participation: people on this organisation's live teams. */
async function readInvitedCount(organizationId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data: teams } = await admin
    .from("teams")
    .select("id")
    .eq("organization_id", organizationId)
    .is("archived_at", null);
  const teamIds = (teams ?? []).map((team) => team.id as string);
  if (teamIds.length === 0) return 0;

  const { count } = await admin
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .in("team_id", teamIds);
  return count ?? 0;
}

async function resolveContext(organizationId: string): Promise<WellbeingAnalyticsContext> {
  const access = await requireWellbeingAnalyst(organizationId);
  const policy = await getWellbeingPolicy(access.supabase, organizationId);

  const { data: organization } = await access.supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();

  return {
    organizationId,
    organizationName: (organization?.name as string | null) ?? "Organisation",
    role: access.role,
    threshold: policy.screeningThreshold,
    minCohort: policy.minCohortSize,
    policyIsDefault: policy.isDefault,
  };
}

/* ── Overview + Trends ──────────────────────────────────────────────── */

/** Groups completions into quarters, so waves compare like with like. */
function waveKey(iso: string): { key: string; label: string; at: string } {
  const date = new Date(iso);
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  const year = date.getUTCFullYear();
  return {
    key: `${year}-Q${quarter}`,
    label: `Q${quarter} ${String(year).slice(2)}`,
    at: new Date(Date.UTC(year, (quarter - 1) * 3, 1)).toISOString(),
  };
}

export async function getWellbeingWorkspace(
  organizationId: string,
): Promise<WellbeingWorkspace> {
  const context = await resolveContext(organizationId);
  const [rows, invited] = await Promise.all([
    readOrganizationResults(organizationId),
    readInvitedCount(organizationId),
  ]);

  const scores = rows.map((row) => row.total_score);
  const slice = checkSlice(scores.length, context.minCohort);

  // Waves below the floor are dropped entirely rather than plotted as a gap —
  // a visible gap with a date on it is itself a disclosure about a small wave.
  const byWave = new Map<string, { label: string; at: string; scores: number[]; thresholds: number[] }>();
  for (const row of rows) {
    const wave = waveKey(row.completed_at);
    const bucket = byWave.get(wave.key) ?? { label: wave.label, at: wave.at, scores: [], thresholds: [] };
    bucket.scores.push(row.total_score);
    bucket.thresholds.push(row.threshold_at_completion);
    byWave.set(wave.key, bucket);
  }

  const points: WavePoint[] = [];
  let trendSuppressedWaves = 0;
  for (const [key, bucket] of byWave) {
    if (!checkSlice(bucket.scores.length, context.minCohort).publishable) {
      trendSuppressedWaves += 1;
      continue;
    }
    points.push({
      key,
      label: bucket.label,
      at: bucket.at,
      // The threshold that actually applied to this wave, not today's.
      aggregate: aggregateScores(bucket.scores, {
        threshold: bucket.thresholds[0] ?? context.threshold,
        invited: null,
      }),
    });
  }

  return {
    context,
    overview: slice.publishable
      ? aggregateScores(scores, { threshold: context.threshold, invited })
      : null,
    overviewSuppressed: slice.publishable ? null : SUPPRESSION_MESSAGE,
    invited,
    trend: buildTrend(points),
    trendSuppressedWaves,
  };
}

/* ── Compare ────────────────────────────────────────────────────────── */

function cohortKeyFor(row: AnalyticsRow, dimension: CompareDimension): string | null {
  switch (dimension) {
    case "department":
      return row.department_at_completion;
    case "work_location":
      return row.work_location_at_completion;
    case "office_location":
      // Field-based respondents have no office and are not a cohort here.
      return row.office_location_at_completion;
    case "team":
      return row.team_id;
  }
}

async function labelFor(
  dimension: CompareDimension,
  key: string,
  teamNames: Map<string, string>,
): Promise<string> {
  if (dimension === "work_location") return WORK_LOCATION_LABEL[key as WorkLocation] ?? key;
  if (dimension === "team") return teamNames.get(key) ?? "Team";
  return key;
}

export async function getWellbeingComparison(
  organizationId: string,
  dimension: CompareDimension,
): Promise<{ context: WellbeingAnalyticsContext; view: ComparisonView }> {
  const context = await resolveContext(organizationId);
  const rows = await readOrganizationResults(organizationId);

  const teamNames = new Map<string, string>();
  if (dimension === "team") {
    const admin = createSupabaseAdminClient();
    const { data: teams } = await admin
      .from("teams")
      .select("id, name")
      .eq("organization_id", organizationId);
    for (const team of teams ?? []) teamNames.set(team.id as string, team.name as string);
  }

  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const key = cohortKeyFor(row, dimension);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), row.total_score]);
  }

  const cohortInputs = await Promise.all(
    [...grouped.entries()].map(async ([key, scores]) => {
      const aggregate = aggregateScores(scores, { threshold: context.threshold });
      return {
        key,
        label: await labelFor(dimension, key, teamNames),
        completed: scores.length,
        stats: {
          completed: scores.length,
          median: aggregate.median,
          mean: aggregate.mean,
          atOrAboveThresholdShare: aggregate.atOrAboveThresholdShare,
          participation: null,
        } satisfies CohortStats,
      };
    }),
  );

  // Both rules run here, before any figure becomes a return value.
  const result = suppressPartition(cohortInputs, { minCohort: context.minCohort });

  return {
    context,
    view: {
      dimension,
      label: COMPARE_DIMENSIONS.find((entry) => entry.key === dimension)?.label ?? dimension,
      cohorts: result.cohorts.sort((a, b) => a.label.localeCompare(b.label)),
      publishedCount: result.publishedCount,
      suppressedCount: result.suppressedCount,
      fullySuppressed: result.fullySuppressed,
    },
  };
}

/* ── Signals ────────────────────────────────────────────────────────── */

/**
 * Per-item aggregate response patterns, by cohort.
 *
 * Twelve independent proportions and no derived construct. The engine cannot
 * express a subscale, so no surface built on it can invent one.
 */
export async function getWellbeingSignals(
  organizationId: string,
  dimension: CompareDimension,
  itemIds: readonly string[],
): Promise<{ context: WellbeingAnalyticsContext; rows: SignalRow[]; organizationWide: ItemSignal[] | null }> {
  const context = await resolveContext(organizationId);
  const rows = await readOrganizationResults(organizationId);

  const teamNames = new Map<string, string>();
  if (dimension === "team") {
    const admin = createSupabaseAdminClient();
    const { data: teams } = await admin
      .from("teams")
      .select("id, name")
      .eq("organization_id", organizationId);
    for (const team of teams ?? []) teamNames.set(team.id as string, team.name as string);
  }

  const grouped = new Map<string, number[][]>();
  for (const row of rows) {
    const key = cohortKeyFor(row, dimension);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), row.item_positions]);
  }

  const cohortInputs = await Promise.all(
    [...grouped.entries()].map(async ([key, positions]) => ({
      key,
      label: await labelFor(dimension, key, teamNames),
      completed: positions.length,
      stats: itemSignals(positions, itemIds),
    })),
  );

  const suppressed = suppressPartition(cohortInputs, { minCohort: context.minCohort });

  const allPositions = rows.map((row) => row.item_positions);
  const organizationWide = checkSlice(allPositions.length, context.minCohort).publishable
    ? itemSignals(allPositions, itemIds)
    : null;

  return {
    context,
    organizationWide,
    rows: suppressed.cohorts
      .map((cohort) => ({
        key: cohort.key,
        label: cohort.label,
        completed: cohort.completed,
        signals: cohort.stats,
        suppressed: cohort.suppressed,
        message: cohort.message,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}
