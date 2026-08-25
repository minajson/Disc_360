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
import { INSTRUMENTS, type InstrumentKey, type InstrumentMetadata } from "@/data/wellbeing-instruments";
import {
  buildDemoPopulation,
  demoParticipantCounts,
  DEMO_INVITED,
  DEMO_TEAM_NAMES,
  type DemoAnalyticsRow,
} from "@/lib/wellbeing/demo-population";
import {
  buildWellbeingSignals,
  type CohortFigure,
  type DimensionWave,
  type WaveFigure,
  type WellbeingSignal,
} from "@/lib/wellbeing/signals";

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
  "instrument_key, total_score, index_score, threshold_at_completion, at_or_above_threshold, completed_at, team_id, department_at_completion, work_location_at_completion, office_location_at_completion, item_positions, wellbeing_result_dimensions (dimension_key, index_score)";

/** Columns that must never appear in an analytics read. */
export const FORBIDDEN_ANALYTICS_COLUMNS = [
  "profile_id",
  "session_id",
  "contact_email",
  "job_title_at_completion",
  "likert_score",
] as const;

interface AnalyticsRow {
  instrument_key: string;
  /** The instrument's RAW score. */
  total_score: number;
  /** 0–100 where the instrument normalises one; null otherwise. */
  index_score: number | null;
  threshold_at_completion: number | null;
  at_or_above_threshold: boolean | null;
  completed_at: string;
  team_id: string | null;
  department_at_completion: string | null;
  work_location_at_completion: WorkLocation | null;
  office_location_at_completion: string | null;
  item_positions: number[];
  wellbeing_result_dimensions: { dimension_key: string; index_score: number }[] | null;
}

/**
 * The figure a given instrument is reported ON.
 *
 * GHQ-12 and GHQ-28 report their raw screening count; WHO-5 reports its
 * transformed 0–100 score and DISC360 Wellbeing its index. Reading the wrong
 * column would silently plot a 0–48 raw on a 0–100 axis, so the choice is made
 * once, here, from the instrument's own declared scale.
 */
function reportedScore(row: AnalyticsRow, instrument: InstrumentMetadata): number {
  return instrument.primaryScoreMax === 100 ? (row.index_score ?? 0) : row.total_score;
}

/** How a 0–100 scale is bucketed for display; point scales are not bucketed. */
function bucketSizeFor(instrument: InstrumentMetadata): number {
  return instrument.primaryScoreMax === 100 ? 10 : 1;
}

function aggregateOptionsFor(
  instrument: InstrumentMetadata,
  threshold: number | null,
  invited: number | null = null,
) {
  return {
    maxScore: instrument.primaryScoreMax,
    bucketSize: bucketSizeFor(instrument),
    threshold: instrument.hasThreshold ? threshold : null,
    invited,
  };
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
  instrumentKey: InstrumentKey;
  instrument: InstrumentMetadata;
  /** Null for instruments that carry no threshold. */
  threshold: number | null;
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
  /**
   * Distinct PEOPLE who have completed at least one pulse.
   *
   * Separate from `overview.completed`, which counts RESPONSES. With repeat
   * waves the two diverge sharply — fifty-nine people across four waves are
   * two hundred and thirty-six responses — and comparing responses against a
   * headcount roster produced a participation rate above 100%, which is not a
   * participation rate at all. Suppression has always counted people; the
   * headline figures now agree with it.
   */
  participants: number;
  /** People who completed, over the roster. Null when the denominator is unsound. */
  participation: number | null;
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
  instrumentKey: InstrumentKey,
  teamIds?: string[],
): Promise<AnalyticsRow[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("wellbeing_results")
    .select(WELLBEING_ANALYTICS_COLUMNS)
    // Exactly one instrument per read. There is no code path that returns
    // rows from two instruments together, so no aggregate can span them.
    .eq("instrument_key", instrumentKey)
    .eq("organization_id", organizationId)
    .order("completed_at", { ascending: true });
  if (teamIds && teamIds.length > 0) query = query.in("team_id", teamIds);

  const { data } = await query;
  return (data ?? []) as unknown as AnalyticsRow[];
}

/**
 * Distinct PARTICIPANTS per cohort, counted inside the database.
 *
 * Suppression is a statement about how many people are in a reported group.
 * Counting rows gets that wrong the moment an instrument is run more than
 * once: four people across four waves are sixteen rows and still four people.
 *
 * The counting happens in `wellbeing_participant_counts` precisely so the
 * identifiers it needs never reach this module — it returns integers only.
 */
async function readParticipantCounts(
  organizationId: string,
  instrumentKey: InstrumentKey,
): Promise<{ overall: number; byScope: Map<string, Map<string, number>> }> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.rpc("wellbeing_participant_counts", {
    p_organization: organizationId,
    p_instrument: instrumentKey,
  });

  const byScope = new Map<string, Map<string, number>>();
  let overall = 0;
  for (const row of (data ?? []) as { scope: string; cohort: string; participants: number }[]) {
    if (row.scope === "overall") {
      overall = row.participants;
      continue;
    }
    const scope = byScope.get(row.scope) ?? new Map<string, number>();
    scope.set(row.cohort, row.participants);
    byScope.set(row.scope, scope);
  }
  return { overall, byScope };
}

/** Maps a comparison dimension to the scope key the counter returns. */
const SCOPE_FOR_DIMENSION: Record<CompareDimension, string> = {
  department: "department",
  work_location: "work_location",
  office_location: "office_location",
  team: "team",
};

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

async function resolveContext(
  organizationId: string,
  instrumentKey: InstrumentKey,
): Promise<WellbeingAnalyticsContext> {
  const access = await requireWellbeingAnalyst(organizationId);
  const policy = await getWellbeingPolicy(access.supabase, organizationId);
  const instrument = INSTRUMENTS[instrumentKey];

  const { data: organization } = await access.supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();

  return {
    organizationId,
    organizationName: (organization?.name as string | null) ?? "Organisation",
    role: access.role,
    instrumentKey,
    instrument,
    // An instrument without a threshold gets null, not the GHQ policy value —
    // otherwise a governed GHQ cut-off would leak onto an unvalidated scale.
    threshold: instrument.hasThreshold
      ? (instrument.key === "ghq28"
          ? (instrument.defaultThreshold ?? policy.screeningThreshold)
          : policy.screeningThreshold)
      : null,
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


/* ── where the rows come from ───────────────────────────────────────── */

/**
 * LIVE PILOT or ANALYTICS DEMO.
 *
 * These are two data SOURCES behind one computation. Everything downstream —
 * aggregation, wave grouping, suppression, signals — is identical, so the demo
 * demonstrates the product's real behaviour rather than a drawing of it, and a
 * figure can never be produced for the demo that the live path would not also
 * produce.
 *
 * They can never mix. `loadAnalyticsRows` returns one or the other, chosen
 * once per request from an explicit argument; there is no code path that
 * concatenates them and no default that silently falls back from one to the
 * other. The demo path issues no query against a participant table at all.
 */
export type AnalyticsSource = "live" | "demo";

export function parseAnalyticsSource(value: string | undefined): AnalyticsSource {
  return value === "demo" ? "demo" : "live";
}

interface LoadedRows {
  rows: AnalyticsRow[];
  counts: { overall: number; byScope: Map<string, Map<string, number>> };
  invited: number;
  teamNames: Map<string, string>;
}

async function loadAnalyticsRows(
  organizationId: string,
  instrumentKey: InstrumentKey,
  source: AnalyticsSource,
): Promise<LoadedRows> {
  if (source === "demo") {
    // No database read of any kind. The illustrative population is generated,
    // used and discarded, so nothing synthetic can reach a participant table
    // and nothing real can reach a demonstration.
    const rows = buildDemoPopulation(instrumentKey) as unknown as AnalyticsRow[];
    return {
      rows,
      counts: demoParticipantCounts(rows as unknown as DemoAnalyticsRow[]),
      invited: DEMO_INVITED,
      teamNames: DEMO_TEAM_NAMES,
    };
  }

  const [rows, invited, counts] = await Promise.all([
    readOrganizationResults(organizationId, instrumentKey),
    readInvitedCount(organizationId),
    readParticipantCounts(organizationId, instrumentKey),
  ]);

  const teamNames = new Map<string, string>();
  const admin = createSupabaseAdminClient();
  const { data: teams } = await admin
    .from("teams")
    .select("id, name")
    .eq("organization_id", organizationId);
  for (const team of teams ?? []) teamNames.set(team.id as string, team.name as string);

  return { rows, counts, invited, teamNames };
}

export async function getWellbeingWorkspace(
  organizationId: string,
  instrumentKey: InstrumentKey,
  source: AnalyticsSource = "live",
): Promise<WellbeingWorkspace> {
  const context = await resolveContext(organizationId, instrumentKey);
  const { rows, counts, invited } = await loadAnalyticsRows(organizationId, instrumentKey, source);

  const scores = rows.map((row) => reportedScore(row, context.instrument));
  // People, not rows.
  const slice = checkSlice(counts.overall, context.minCohort);

  // Waves below the floor are dropped entirely rather than plotted as a gap —
  // a visible gap with a date on it is itself a disclosure about a small wave.
  const byWave = new Map<
    string,
    { label: string; at: string; scores: number[]; thresholds: number[] }
  >();
  for (const row of rows) {
    const wave = waveKey(row.completed_at);
    const bucket = byWave.get(wave.key) ?? { label: wave.label, at: wave.at, scores: [], thresholds: [] };
    bucket.scores.push(reportedScore(row, context.instrument));
    if (row.threshold_at_completion !== null) bucket.thresholds.push(row.threshold_at_completion);
    byWave.set(wave.key, bucket);
  }

  const points: WavePoint[] = [];
  let trendSuppressedWaves = 0;
  for (const [key, bucket] of byWave) {
    // Within a single wave a person contributes at most one result — the
    // active-attempt indexes enforce it — so rows and people coincide here.
    if (!checkSlice(bucket.scores.length, context.minCohort).publishable) {
      trendSuppressedWaves += 1;
      continue;
    }
    points.push({
      key,
      label: bucket.label,
      at: bucket.at,
      // The threshold that actually applied to this wave, not today's.
      aggregate: aggregateScores(
        bucket.scores,
        aggregateOptionsFor(context.instrument, bucket.thresholds[0] ?? context.threshold),
      ),
    });
  }

  const participants = counts.overall;
  const denominatorIsSound = invited > 0 && participants <= invited;

  return {
    context,
    overview: slice.publishable
      ? aggregateScores(scores, aggregateOptionsFor(context.instrument, context.threshold, invited))
      : null,
    overviewSuppressed: slice.publishable ? null : SUPPRESSION_MESSAGE,
    invited,
    participants,
    participation: denominatorIsSound
      ? Math.round((participants / invited) * 1000) / 10
      : null,
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
  instrumentKey: InstrumentKey,
  dimension: CompareDimension,
  source: AnalyticsSource = "live",
): Promise<{ context: WellbeingAnalyticsContext; view: ComparisonView }> {
  const context = await resolveContext(organizationId, instrumentKey);
  const { rows, counts, teamNames } = await loadAnalyticsRows(
    organizationId,
    instrumentKey,
    source,
  );

  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const key = cohortKeyFor(row, dimension);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), reportedScore(row, context.instrument)]);
  }

  const scopeCounts = counts.byScope.get(SCOPE_FOR_DIMENSION[dimension]) ?? new Map();

  const cohortInputs = await Promise.all(
    [...grouped.entries()].map(async ([key, scores]) => {
      const aggregate = aggregateScores(
        scores,
        aggregateOptionsFor(context.instrument, context.threshold),
      );
      return {
        key,
        label: await labelFor(dimension, key, teamNames),
        // The suppression decision is made on distinct people in this cohort,
        // never on how many times they answered.
        completed: scopeCounts.get(key) ?? 0,
        stats: {
          // The displayed n is people too. Showing "n = 56" for a department
          // of 14 who each answered four times would overstate the cohort and
          // make a suppressed neighbour look inexplicable.
          completed: scopeCounts.get(key) ?? 0,
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
  instrumentKey: InstrumentKey,
  dimension: CompareDimension,
  itemIds: readonly string[],
  source: AnalyticsSource = "live",
): Promise<{ context: WellbeingAnalyticsContext; rows: SignalRow[]; organizationWide: ItemSignal[] | null }> {
  const context = await resolveContext(organizationId, instrumentKey);
  const { rows, counts, teamNames } = await loadAnalyticsRows(
    organizationId,
    instrumentKey,
    source,
  );

  const grouped = new Map<string, number[][]>();
  for (const row of rows) {
    const key = cohortKeyFor(row, dimension);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), row.item_positions]);
  }

  const scopeCounts = counts.byScope.get(SCOPE_FOR_DIMENSION[dimension]) ?? new Map();

  const cohortInputs = await Promise.all(
    [...grouped.entries()].map(async ([key, positions]) => ({
      key,
      label: await labelFor(dimension, key, teamNames),
      completed: scopeCounts.get(key) ?? 0,
      stats: itemSignals(positions, itemIds),
    })),
  );

  const suppressed = suppressPartition(cohortInputs, { minCohort: context.minCohort });

  const allPositions = rows.map((row) => row.item_positions);
  const organizationWide = checkSlice(counts.overall, context.minCohort).publishable
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


/* ── dimension / subscale profile ───────────────────────────────────── */

export interface DimensionAggregate {
  key: string;
  label: string;
  /** Median of this dimension across the cohort, on the dimension's own scale. */
  median: number;
  mean: number;
  completed: number;
}

export interface DimensionProfileView {
  /** Null when the whole scope is below the confidentiality floor. */
  dimensions: DimensionAggregate[] | null;
  suppressed: string | null;
  /** Highest and lowest by median, for the overview headline. */
  highest: DimensionAggregate | null;
  lowest: DimensionAggregate | null;
}

/**
 * The organisation-wide dimension (or subscale) profile.
 *
 * Only instruments that define dimensions produce one — GHQ-12 and WHO-5
 * return an empty profile rather than an invented breakdown.
 *
 * The lowest-scoring dimension is named as an AREA FOR ATTENTION and nothing
 * more. It is not a risk, not a finding, and never attributed to a cause.
 */
export async function getWellbeingDimensionProfile(
  organizationId: string,
  instrumentKey: InstrumentKey,
  source: AnalyticsSource = "live",
): Promise<{ context: WellbeingAnalyticsContext; view: DimensionProfileView }> {
  const context = await resolveContext(organizationId, instrumentKey);

  if (context.instrument.subscales.length === 0 && instrumentKey !== "disc360_wellbeing_v1") {
    return {
      context,
      view: { dimensions: null, suppressed: null, highest: null, lowest: null },
    };
  }

  const { rows, counts } = await loadAnalyticsRows(organizationId, instrumentKey, source);
  const slice = checkSlice(counts.overall, context.minCohort);
  if (!slice.publishable) {
    return {
      context,
      view: { dimensions: null, suppressed: SUPPRESSION_MESSAGE, highest: null, lowest: null },
    };
  }

  const byDimension = new Map<string, number[]>();
  for (const row of rows) {
    for (const dimension of row.wellbeing_result_dimensions ?? []) {
      byDimension.set(dimension.dimension_key, [
        ...(byDimension.get(dimension.dimension_key) ?? []),
        dimension.index_score,
      ]);
    }
  }

  const admin = createSupabaseAdminClient();
  const { data: definitions } = await admin
    .from("wellbeing_dimensions")
    .select("key, label, position")
    .eq("instrument_key", instrumentKey)
    .order("position");

  const dimensions: DimensionAggregate[] = (definitions ?? [])
    .map((definition) => {
      const values = byDimension.get(definition.key as string) ?? [];
      const aggregate = aggregateScores(values, {
        maxScore: 100,
        threshold: null,
        bucketSize: 10,
      });
      return {
        key: definition.key as string,
        label: definition.label as string,
        median: aggregate.median,
        mean: aggregate.mean,
        completed: values.length,
      };
    })
    .filter((dimension) => dimension.completed > 0);

  const ranked = [...dimensions].sort((a, b) => b.median - a.median);

  return {
    context,
    view: {
      dimensions,
      suppressed: null,
      highest: ranked[0] ?? null,
      lowest: ranked[ranked.length - 1] ?? null,
    },
  };
}

/* ── evidence-first signal patterns ─────────────────────────────────── */

/** The width covering the middle of a cohort, used as a spread measure. */
function middleSpread(values: number[]): number {
  if (values.length < 4) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (fraction: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!;
  return at(0.75) - at(0.25);
}

/**
 * Builds the aggregate figures the signal engine describes.
 *
 * Every number handed to `buildWellbeingSignals` is computed here from rows
 * that have already been authorised and already passed suppression — a cohort
 * below the floor never reaches the engine, so no signal can be written about
 * one. The engine itself performs no I/O, which is what keeps "the evidence
 * layer owns every figure" true rather than aspirational.
 */
export async function getWellbeingSignalPatterns(
  organizationId: string,
  instrumentKey: InstrumentKey,
  dimension: CompareDimension,
  source: AnalyticsSource = "live",
): Promise<{ context: WellbeingAnalyticsContext; signals: WellbeingSignal[] }> {
  const context = await resolveContext(organizationId, instrumentKey);
  const { rows, counts, teamNames } = await loadAnalyticsRows(
    organizationId,
    instrumentKey,
    source,
  );

  /* Waves, oldest first, with anything below the floor dropped entirely. */
  const byWave = new Map<string, { label: string; at: string; scores: number[]; thresholds: number[] }>();
  for (const row of rows) {
    const wave = waveKey(row.completed_at);
    const bucket = byWave.get(wave.key) ?? { label: wave.label, at: wave.at, scores: [], thresholds: [] };
    bucket.scores.push(reportedScore(row, context.instrument));
    if (row.threshold_at_completion !== null) bucket.thresholds.push(row.threshold_at_completion);
    byWave.set(wave.key, bucket);
  }

  const waves: WaveFigure[] = [...byWave.values()]
    .sort((a, b) => a.at.localeCompare(b.at))
    .filter((bucket) => checkSlice(bucket.scores.length, context.minCohort).publishable)
    .map((bucket) => {
      const aggregate = aggregateScores(
        bucket.scores,
        aggregateOptionsFor(context.instrument, bucket.thresholds[0] ?? context.threshold),
      );
      return {
        label: bucket.label,
        median: aggregate.median,
        // Within one wave a person contributes at most one result, so rows
        // and people coincide here.
        participants: bucket.scores.length,
        thresholdShare: context.instrument.hasThreshold ? aggregate.atOrAboveThresholdShare : null,
        spread: middleSpread(bucket.scores),
      };
    });

  /* Dimension medians per wave, for instruments that legitimately have them. */
  const dimensions: DimensionWave[] = [];
  if (context.instrument.key === "disc360_wellbeing_v1") {
    const perDimension = new Map<string, Map<string, number[]>>();
    for (const row of rows) {
      const wave = waveKey(row.completed_at);
      for (const entry of row.wellbeing_result_dimensions ?? []) {
        const waveMap = perDimension.get(entry.dimension_key) ?? new Map<string, number[]>();
        waveMap.set(wave.key, [...(waveMap.get(wave.key) ?? []), entry.index_score]);
        perDimension.set(entry.dimension_key, waveMap);
      }
    }
    const orderedWaves = [...byWave.entries()]
      .sort((a, b) => a[1].at.localeCompare(b[1].at))
      .map(([key]) => key);

    const admin = createSupabaseAdminClient();
    const { data: definitions } = await admin
      .from("wellbeing_dimensions")
      .select("key, label, position")
      .eq("instrument_key", instrumentKey)
      .order("position");

    for (const definition of definitions ?? []) {
      const waveMap = perDimension.get(definition.key as string);
      if (!waveMap) continue;
      const medians = orderedWaves
        .map((key) => waveMap.get(key) ?? [])
        // A wave below the floor contributes no dimension median either.
        .filter((scores) => checkSlice(scores.length, context.minCohort).publishable)
        .map((scores) => aggregateScores(scores, aggregateOptionsFor(context.instrument, null)).median);
      if (medians.length > 0) {
        dimensions.push({ key: definition.key as string, label: definition.label as string, medians });
      }
    }
  }

  /* Cohorts, already suppressed by the shared comparison path. */
  const { view } = await getWellbeingComparison(organizationId, instrumentKey, dimension, source);
  const cohorts: CohortFigure[] = view.cohorts
    .filter((cohort) => !cohort.suppressed && cohort.stats)
    .map((cohort) => ({
      label: cohort.label,
      participants: cohort.stats!.completed,
      median: cohort.stats!.median,
      delta: null,
    }));

  void counts;
  void teamNames;

  return {
    context,
    signals: buildWellbeingSignals({
      instrument: context.instrument,
      waves,
      dimensions,
      cohorts,
      cohortLabel: view.label,
    }),
  };
}
