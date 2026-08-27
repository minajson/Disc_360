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
import {
  aggregationNotice,
  bucketWaves,
  waveTitle,
  type PeriodBucket,
  type ReportingPeriod,
  type WellbeingWave,
} from "@/lib/wellbeing/waves";
import { INSTRUMENTS, type InstrumentKey, type InstrumentMetadata } from "@/data/wellbeing-instruments";
import {
  buildDemoPopulation,
  demoParticipantCounts,
  demoWaves,
  DEMO_INVITED,
  DEMO_TEAM_NAMES,
  type DemoAnalyticsRow,
} from "@/lib/wellbeing/demo-population";
import {
  buildLocalFixture,
  localFixtureAllowed,
  localFixtureParticipantCounts,
  localFixtureWaves,
  LOCAL_FIXTURE_INVITED,
  LOCAL_FIXTURE_TEAM_NAMES,
} from "@/lib/wellbeing/local-fixture";
import { isProductionEnvironment } from "@/lib/wellbeing/environment";
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
  "instrument_key, total_score, index_score, threshold_at_completion, at_or_above_threshold, completed_at, team_id, wave_id, department_at_completion, work_location_at_completion, office_location_at_completion, item_positions, wellbeing_result_dimensions (dimension_key, index_score)";

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
  /**
   * The campaign occurrence this result was counted in.
   *
   * Identifies a WAVE, never a person — see 00034. It is here because the
   * alternative is deriving a wave from `completed_at`, which is exactly the
   * calendar-quarter rule that silently merged two pulses in one quarter.
   */
  wave_id: string | null;
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
    // Which side of the threshold is worth reporting depends on which way the
    // instrument counts. GHQ runs upward toward distress, so at-or-above is
    // the noteworthy share. WHO-5 runs upward toward WELLBEING, so its
    // noteworthy share is BELOW the cut-off — and a facilitator shown
    // "% at or above" for WHO-5 would read the healthy proportion as the
    // concerning one. Derived from the instrument's declared direction rather
    // than special-cased by key, so a new instrument inherits the right rule.
    thresholdDirection:
      instrument.scoreDirection === "higher_is_stronger_wellbeing"
        ? ("below" as const)
        : ("at_or_above" as const),
    invited,
  };
}

export type CompareDimension =
  | "department"
  | "work_location"
  | "office_location"
  | "team"
  | "wave";

export const COMPARE_DIMENSIONS: readonly { key: CompareDimension; label: string }[] = [
  { key: "department", label: "Department / Function" },
  { key: "team", label: "Team" },
  { key: "work_location", label: "Work Location" },
  { key: "office_location", label: "Office Location" },
  { key: "wave", label: "Wave / period" },
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
  /**
   * The reporting period the trend was built with, and what that cost.
   *
   * `aggregatedNote` is non-null exactly when a calendar rollup folded two or
   * more waves into one point. It is surfaced rather than logged because a
   * folded point is a legitimate figure that is misleading if the reader
   * believes it is a single measurement.
   */
  period: ReportingPeriod;
  aggregatedNote: string | null;
  /** Waves in scope, oldest first — the axis before suppression. */
  waves: { id: string; title: string; openedAt: string; campaignName: string }[];
  /** Results belonging to no campaign wave at all (solo attempts). */
  outsideAnyWave: number;
}

export interface CohortStats {
  completed: number;
  median: number;
  mean: number;
  /**
   * Share on the instrument's NOTEWORTHY side of the threshold.
   *
   * Read it with `thresholdLabel`, never with a hard-coded "≥": for WHO-5 this
   * counts responses BELOW the cut-off.
   */
  atOrAboveThresholdShare: number;
  /** The comparator to print — "≥ 4" or "< 50". Null when there is none. */
  thresholdLabel: string | null;
  participation: number | null;
  /**
   * The band covering the middle of the cohort.
   *
   * Published instead of a full per-cohort histogram, deliberately. A
   * histogram of a seven-person group has buckets containing one person, and
   * "someone in Finance scored 11" is a disclosure a median is not. A middle
   * band says how spread out the group is — which is the thing a median cannot
   * tell you and the reason cohorts get compared at all — without placing any
   * individual anywhere on the scale.
   */
  p25: number;
  p75: number;
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
  campaignId: string | null = null,
): Promise<{ overall: number; byScope: Map<string, Map<string, number>> }> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.rpc("wellbeing_participant_counts", {
    p_organization: organizationId,
    p_instrument: instrumentKey,
    // Null counts the whole organisation. 00034 applies both scopes inside the
    // function, to every cohort, so no branch of it can be missed.
    p_team: campaignId ?? undefined,
    p_wave: undefined,
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
  // Waves are counted from the rows themselves — see getWellbeingComparison.
  // The entry exists so the record stays exhaustive and a new dimension
  // cannot be added without deciding how its people are counted.
  wave: "wave",
};

/**
 * The denominator for participation.
 *
 * Everyone on this organisation's live teams, or — for a campaign reading —
 * everyone on that one campaign's roster. Getting this wrong in the campaign
 * direction is the more damaging of the two: a campaign of thirty measured
 * against an organisation of four hundred reports a participation rate of 7%
 * for a campaign that is nearly complete.
 */
async function readInvitedCount(
  organizationId: string,
  campaignId: string | null = null,
): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data: teams } = await admin
    .from("teams")
    .select("id")
    .eq("organization_id", organizationId)
    .is("archived_at", null);
  const teamIds = (teams ?? [])
    .map((team) => team.id as string)
    // The campaign must belong to the organisation the caller was authorised
    // for; intersecting rather than trusting the parameter is what makes that
    // true even if a caller passes an id from somewhere else.
    .filter((id) => campaignId === null || id === campaignId);
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

  // The organisation's NAME, read with the service role AFTER
  // `requireWellbeingAnalyst` has authorised this caller for this exact
  // organisation.
  //
  // Read through the caller's own client it comes back empty for most
  // legitimate analysts: a wellbeing role is deliberately NOT organisation
  // membership, so RLS on `organizations` refuses them and every heading and
  // every exported report fell back to the literal word "Organisation".
  // Withholding only the display name from someone already entitled to that
  // organisation's aggregate analytics protects nothing and misnames the
  // document they hand to their board.
  const admin = createSupabaseAdminClient();
  const { data: organization } = await admin
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

/**
 * The waves in scope, read from the wave table.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THIS REPLACED A CALENDAR RULE, AND THAT IS THE WHOLE POINT.
 *
 * Waves used to be computed by rounding `completed_at` to a quarter. That
 * merged a baseline in August with a post-intervention pulse in September —
 * two measurements the programme existed to compare — into one number, with
 * nothing on screen to indicate it had happened.
 *
 * A wave is now a row with an identity, and a result carries its id from the
 * moment it is written. Nothing here infers a period from a date.
 * ─────────────────────────────────────────────────────────────────────
 */
async function readWaves(
  organizationId: string,
  campaignId: string | null,
): Promise<WellbeingWave[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("wellbeing_waves")
    .select("id, team_id, wave_number, label, opened_at, closed_at, teams (name, session_name)")
    .eq("organization_id", organizationId)
    .order("opened_at", { ascending: true });
  if (campaignId) query = query.eq("team_id", campaignId);

  const { data } = await query;
  return (data ?? []).map((row) => {
    const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
    const named = team as { name: string; session_name: string | null } | null;
    return {
      id: row.id as string,
      campaignId: row.team_id as string,
      campaignName: named?.session_name || named?.name || "Campaign",
      number: row.wave_number as number,
      label: (row.label as string) ?? "",
      openedAt: row.opened_at as string,
      closedAt: (row.closed_at as string | null) ?? null,
    };
  });
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
export type AnalyticsSource = "live" | "demo" | "fixture";

/**
 * Resolves the requested source, refusing anything it does not recognise.
 *
 * "live" is the default and the fallback. An unknown value, a missing value,
 * and "fixture" asked for in production all resolve to live — the reader sees
 * their own organisation's real figures or nothing, never synthetic figures
 * they did not ask for.
 */
export function parseAnalyticsSource(value: string | undefined): AnalyticsSource {
  if (value === "demo") return "demo";
  // The fixture is customer-shaped. It exists for local development and
  // review, and the environment decides — no flag, role or parameter widens
  // it. In production this branch is unreachable and the value falls through.
  if (value === "fixture" && localFixtureAllowed({ isProduction: isProductionEnvironment() })) {
    return "fixture";
  }
  return "live";
}

/** True where the local development fixture may be offered at all. */
export function localFixtureOffered(): boolean {
  return localFixtureAllowed({ isProduction: isProductionEnvironment() });
}

interface LoadedRows {
  rows: AnalyticsRow[];
  counts: { overall: number; byScope: Map<string, Map<string, number>> };
  invited: number;
  teamNames: Map<string, string>;
  /** The waves in scope, oldest first. Read, never derived from a date. */
  waves: WellbeingWave[];
}

/**
 * How much of an organisation a reading covers.
 *
 * `null` is the whole organisation — the analytics workspace. A campaign id
 * narrows every read, every participant count and the participation
 * denominator to that one campaign, so the campaign dashboard reports on the
 * campaign it names rather than on everything the organisation has ever run.
 *
 * The narrowing happens in the QUERY and in the counting function, never by
 * filtering a wider result set afterwards. A filter is the kind of thing that
 * gets refactored away; a WHERE clause is not.
 */
export interface AnalyticsScope {
  campaignId: string;
}

async function loadAnalyticsRows(
  organizationId: string,
  instrumentKey: InstrumentKey,
  source: AnalyticsSource,
  scope: AnalyticsScope | null = null,
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
      waves: demoWaves(),
    };
  }

  if (source === "fixture") {
    // Same contract as the demo, and the same absence of any database read.
    // `buildLocalFixture` throws rather than falls back if it is ever reached
    // in production, so a misconfiguration fails loudly instead of quietly
    // publishing customer-shaped synthetic figures.
    const fixture = buildLocalFixture(instrumentKey, {
      isProduction: isProductionEnvironment(),
    });
    return {
      rows: fixture as unknown as AnalyticsRow[],
      counts: localFixtureParticipantCounts(fixture),
      invited: LOCAL_FIXTURE_INVITED,
      teamNames: LOCAL_FIXTURE_TEAM_NAMES,
      waves: localFixtureWaves(),
    };
  }

  const campaignId = scope?.campaignId ?? null;
  const [rows, invited, counts, waves] = await Promise.all([
    readOrganizationResults(organizationId, instrumentKey, campaignId ? [campaignId] : undefined),
    readInvitedCount(organizationId, campaignId),
    readParticipantCounts(organizationId, instrumentKey, campaignId),
    readWaves(organizationId, campaignId),
  ]);

  const teamNames = new Map<string, string>();
  const admin = createSupabaseAdminClient();
  const { data: teams } = await admin
    .from("teams")
    .select("id, name")
    .eq("organization_id", organizationId);
  for (const team of teams ?? []) teamNames.set(team.id as string, team.name as string);

  return { rows, counts, invited, teamNames, waves };
}

/* ── grouping rows into the periods a reader asked for ──────────────── */

interface PeriodSeries {
  buckets: PeriodBucket[];
  /** wave id → the bucket it belongs to. */
  bucketFor: Map<string, PeriodBucket>;
  /** Results that belong to no wave at all — solo attempts outside a campaign. */
  outsideAnyWave: number;
}

/**
 * Builds the period series for a reading.
 *
 * `wave` — the default — gives one bucket per wave, whatever the calendar
 * says. Monthly, quarterly and annual fold waves together, and every folded
 * bucket is MARKED as folded so the surface can say so.
 *
 * Only waves that actually carry a result in this reading appear. A wave
 * belonging to another instrument's campaign is not an empty point on this
 * instrument's axis.
 */
function periodSeries(
  rows: readonly AnalyticsRow[],
  waves: readonly WellbeingWave[],
  period: ReportingPeriod,
): PeriodSeries {
  const present = new Set<string>();
  let outsideAnyWave = 0;
  for (const row of rows) {
    if (row.wave_id) present.add(row.wave_id);
    else outsideAnyWave += 1;
  }

  const buckets = bucketWaves(
    waves.filter((wave) => present.has(wave.id)),
    period,
  );

  const bucketFor = new Map<string, PeriodBucket>();
  for (const bucket of buckets) {
    for (const waveId of bucket.waveIds) bucketFor.set(waveId, bucket);
  }

  return { buckets, bucketFor, outsideAnyWave };
}

export async function getWellbeingWorkspace(
  organizationId: string,
  instrumentKey: InstrumentKey,
  source: AnalyticsSource = "live",
  scope: AnalyticsScope | null = null,
  /**
   * How waves are grouped for the trend. Individual waves unless the reader
   * explicitly asked for a calendar rollup — see lib/wellbeing/waves.ts.
   */
  period: ReportingPeriod = "wave",
): Promise<WellbeingWorkspace> {
  const context = await resolveContext(organizationId, instrumentKey);
  const { rows, counts, invited, waves } = await loadAnalyticsRows(
    organizationId,
    instrumentKey,
    source,
    scope,
  );

  const scores = rows.map((row) => reportedScore(row, context.instrument));
  // People, not rows.
  const slice = checkSlice(counts.overall, context.minCohort);

  // Points come from the WAVE each result was completed in, grouped into the
  // reporting period the reader asked for — individual waves unless they said
  // otherwise. Nothing here rounds a date to a period.
  const series = periodSeries(rows, waves, period);
  const byWave = new Map<
    string,
    { label: string; at: string; scores: number[]; thresholds: number[] }
  >();
  for (const bucket of series.buckets) {
    byWave.set(bucket.key, { label: bucket.label, at: bucket.at, scores: [], thresholds: [] });
  }
  for (const row of rows) {
    const bucket = row.wave_id ? series.bucketFor.get(row.wave_id) : undefined;
    if (!bucket) continue;
    const entry = byWave.get(bucket.key)!;
    entry.scores.push(reportedScore(row, context.instrument));
    if (row.threshold_at_completion !== null) entry.thresholds.push(row.threshold_at_completion);
  }

  // Waves below the floor are dropped entirely rather than plotted as a gap —
  // a visible gap with a date on it is itself a disclosure about a small wave.
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
    period,
    aggregatedNote: aggregationNotice(series.buckets),
    waves: waves.map((wave) => ({
      id: wave.id,
      title: waveTitle(wave),
      openedAt: wave.openedAt,
      campaignName: wave.campaignName,
    })),
    outsideAnyWave: series.outsideAnyWave,
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
    case "wave":
      // The wave the result was completed in, not the period its date falls
      // in. This is the whole difference 00034 introduced.
      return row.wave_id;
  }
}

async function labelFor(
  dimension: CompareDimension,
  key: string,
  teamNames: Map<string, string>,
  waveTitles: Map<string, string>,
): Promise<string> {
  if (dimension === "work_location") return WORK_LOCATION_LABEL[key as WorkLocation] ?? key;
  if (dimension === "team") return teamNames.get(key) ?? "Team";
  // A wave is named by its own row — "Wave 2 — Post-intervention" — never by
  // the period its dates happen to fall in.
  if (dimension === "wave") return waveTitles.get(key) ?? "Wave";
  return key;
}

/** The value at a fraction through a sorted cohort. */
function quantile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!;
}

export async function getWellbeingComparison(
  organizationId: string,
  instrumentKey: InstrumentKey,
  dimension: CompareDimension,
  source: AnalyticsSource = "live",
  scope: AnalyticsScope | null = null,
): Promise<{ context: WellbeingAnalyticsContext; view: ComparisonView }> {
  const context = await resolveContext(organizationId, instrumentKey);
  const { rows, counts, teamNames, waves } = await loadAnalyticsRows(
    organizationId,
    instrumentKey,
    source,
    scope,
  );
  const waveTitles = new Map(waves.map((wave) => [wave.id, waveTitle(wave)]));

  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const key = cohortKeyFor(row, dimension);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), reportedScore(row, context.instrument)]);
  }

  // Within a single wave a person contributes at most one result — the
  // active-attempt indexes enforce it — so for the wave dimension rows and
  // people coincide and the database counter has nothing to add. Every other
  // dimension counts distinct PEOPLE, because a person who answered four
  // times is still one person and suppression is about people.
  const scopeCounts =
    dimension === "wave"
      ? new Map([...grouped.entries()].map(([key, scores]) => [key, scores.length]))
      : (counts.byScope.get(SCOPE_FOR_DIMENSION[dimension]) ?? new Map());

  const cohortInputs = await Promise.all(
    [...grouped.entries()].map(async ([key, scores]) => {
      const aggregate = aggregateScores(
        scores,
        aggregateOptionsFor(context.instrument, context.threshold),
      );
      const sorted = [...scores].sort((a, b) => a - b);
      return {
        key,
        label: await labelFor(dimension, key, teamNames, waveTitles),
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
          thresholdLabel: aggregate.thresholdLabel,
          participation: null,
          p25: quantile(sorted, 0.25),
          p75: quantile(sorted, 0.75),
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
      // Alphabetical by label, or chronological for waves (whose keys sort as
      // `2025-Q4`). NEVER by score: ordering cohorts by their figures turns a
      // comparison into a league table, and a league table is exactly what
      // wellbeing reporting must not produce.
      cohorts: result.cohorts.sort((a, b) => {
        if (dimension !== "wave") return a.label.localeCompare(b.label);
        // Chronological by the wave's own opening. Sorting wave LABELS would
        // put "Wave 10" before "Wave 2".
        const at = (key: string) => waves.find((wave) => wave.id === key)?.openedAt ?? "";
        return at(a.key).localeCompare(at(b.key));
      }),
      publishedCount: result.publishedCount,
      suppressedCount: result.suppressedCount,
      fullySuppressed: result.fullySuppressed,
    },
  };
}

/* ── cohort movement across waves ───────────────────────────────────── */

export interface CohortMovementCell {
  waveKey: string;
  waveLabel: string;
  /** Null where this cohort's responses in this wave fall below the floor. */
  median: number | null;
  responses: number | null;
}

export interface CohortMovementRow {
  key: string;
  label: string;
  cells: CohortMovementCell[];
  suppressed: boolean;
}

export interface CohortMovementView {
  dimension: CompareDimension;
  label: string;
  waves: { key: string; label: string }[];
  rows: CohortMovementRow[];
  scoreMin: number;
  scoreMax: number;
}

/**
 * Each cohort's median, wave by wave.
 *
 * ─────────────────────────────────────────────────────────────────────
 * SUPPRESSION APPLIES TWICE, AND BOTH TIMES MATTER.
 *
 * A cohort large enough to publish overall can still be tiny in one wave —
 * fourteen people across four waves might be three in the first. So the cohort
 * passes the ordinary partition first, and then each of its wave CELLS passes
 * a partition of its own. A cohort withheld at either level contributes no
 * figure at all.
 *
 * The per-cohort cell partition is what stops the subtraction attack inside a
 * row: a cohort with one hidden wave and three visible ones, beside a visible
 * total, discloses the hidden one by arithmetic. Withholding a second cell
 * alongside it is the same complementary rule the cohort comparison uses, and
 * it is applied by the same engine rather than reimplemented here.
 *
 * Within one wave a person contributes at most one result — the active-attempt
 * indexes enforce it — so rows and people coincide at cell level and the
 * database counter has nothing to add.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function getWellbeingCohortMovement(
  organizationId: string,
  instrumentKey: InstrumentKey,
  dimension: CompareDimension,
  source: AnalyticsSource = "live",
  scope: AnalyticsScope | null = null,
  period: ReportingPeriod = "wave",
): Promise<{ context: WellbeingAnalyticsContext; view: CohortMovementView }> {
  const context = await resolveContext(organizationId, instrumentKey);
  const { rows, waves } = await loadAnalyticsRows(organizationId, instrumentKey, source, scope);

  // The cohort-level decision comes from the shared comparison path, so a
  // cohort withheld there is withheld here for the same reason and by the
  // same rule rather than by a second implementation of it.
  const { view: comparison } = await getWellbeingComparison(
    organizationId,
    instrumentKey,
    dimension,
    source,
    scope,
  );

  const series = periodSeries(rows, waves, period);
  const byCohortWave = new Map<string, Map<string, number[]>>();
  for (const row of rows) {
    const cohortKey = cohortKeyFor(row, dimension);
    if (!cohortKey) continue;
    const bucket = row.wave_id ? series.bucketFor.get(row.wave_id) : undefined;
    if (!bucket) continue;
    const perWave = byCohortWave.get(cohortKey) ?? new Map<string, number[]>();
    perWave.set(bucket.key, [
      ...(perWave.get(bucket.key) ?? []),
      reportedScore(row, context.instrument),
    ]);
    byCohortWave.set(cohortKey, perWave);
  }

  const orderedWaves = series.buckets.map((bucket) => ({ key: bucket.key, label: bucket.label }));

  const movementRows: CohortMovementRow[] = comparison.cohorts.map((cohort) => {
    if (cohort.suppressed) {
      return {
        key: cohort.key,
        label: cohort.label,
        suppressed: true,
        cells: orderedWaves.map((wave) => ({
          waveKey: wave.key,
          waveLabel: wave.label,
          median: null,
          responses: null,
        })),
      };
    }

    const perWave = byCohortWave.get(cohort.key) ?? new Map<string, number[]>();
    const cellDecisions = suppressPartition(
      orderedWaves.map((wave) => {
        const scores = perWave.get(wave.key) ?? [];
        // Within ONE wave a person contributes at most one result — the
        // active-attempt indexes enforce it — so this is a count of people,
        // not of rows. Named so, because every other suppression input in this
        // module comes from the database's distinct-participant counter and a
        // bare `scores.length` beside them would read as the bug that counter
        // exists to prevent.
        const participantsInWave = scores.length;
        return {
          key: wave.key,
          label: wave.label,
          completed: participantsInWave,
          stats: scores,
        };
      }),
      { minCohort: context.minCohort },
    );

    return {
      key: cohort.key,
      label: cohort.label,
      suppressed: false,
      cells: cellDecisions.cohorts.map((cell) => ({
        waveKey: cell.key,
        waveLabel: cell.label,
        median:
          cell.suppressed || !cell.stats
            ? null
            : aggregateScores(cell.stats, aggregateOptionsFor(context.instrument, null)).median,
        responses: cell.suppressed ? null : (cell.completed ?? null),
      })),
    };
  });

  return {
    context,
    view: {
      dimension,
      label: comparison.label,
      waves: orderedWaves,
      rows: movementRows,
      scoreMin: context.instrument.primaryScoreMin,
      scoreMax: context.instrument.primaryScoreMax,
    },
  };
}

/* ── cohort coverage ────────────────────────────────────────────────── */

export interface CoverageDimension {
  key: CompareDimension;
  label: string;
  /** Cohorts whose figures may be published. */
  published: number;
  /** Cohorts withheld, for either reason. */
  withheld: number;
  /** People inside the published cohorts. */
  covered: number;
}

export interface WellbeingCoverage {
  dimensions: CoverageDimension[];
  /** Distinct people who have completed at least one pulse in scope. */
  participants: number;
  minCohort: number;
}

/**
 * How much of this workforce can actually be reported on, cohort by cohort.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY MANAGEMENT NEEDS THIS BEFORE THEY NEED ANY FIGURE.
 *
 * Suppression is usually met one cohort at a time — a reader clicks Compare,
 * finds two rows withheld, and has no way to tell whether that is a small
 * detail or most of the workforce. That uncertainty is where people start
 * trying to reconstruct what was withheld.
 *
 * So the coverage is stated up front and honestly: for each way of dividing
 * the workforce, how many groups can be published, how many are withheld, and
 * how many people the published groups actually account for. A reader who can
 * see that Department covers 62 of 73 people has no reason to go hunting, and
 * a reader who can see that it covers 11 knows not to trust the comparison.
 *
 * It reads through the same comparison path the screen uses, so a cohort
 * counted as published here is exactly a cohort the screen will show.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function getWellbeingCoverage(
  organizationId: string,
  instrumentKey: InstrumentKey,
  source: AnalyticsSource = "live",
  scope: AnalyticsScope | null = null,
): Promise<{ context: WellbeingAnalyticsContext; coverage: WellbeingCoverage }> {
  const context = await resolveContext(organizationId, instrumentKey);
  const { counts } = await loadAnalyticsRows(organizationId, instrumentKey, source, scope);

  const dimensions: CoverageDimension[] = [];
  for (const entry of COMPARE_DIMENSIONS) {
    // Coverage is about how the WORKFORCE divides. A wave is a period, not a
    // part of the workforce, and every participant belongs to every wave they
    // answered — including it would report coverage above 100%.
    if (entry.key === "wave") continue;
    const scopeCounts = counts.byScope.get(SCOPE_FOR_DIMENSION[entry.key]) ?? new Map();
    // Suppression is applied by the same engine the comparison uses, on the
    // same distinct-people counts, so this cannot disagree with the screen.
    const result = suppressPartition(
      [...scopeCounts.entries()].map(([key, completed]) => ({
        key,
        label: key,
        completed: completed as number,
        stats: null,
      })),
      { minCohort: context.minCohort },
    );
    dimensions.push({
      key: entry.key,
      label: entry.label,
      published: result.publishedCount,
      withheld: result.suppressedCount,
      covered: result.cohorts
        .filter((cohort) => !cohort.suppressed)
        .reduce((total, cohort) => total + (cohort.completed ?? 0), 0),
    });
  }

  return {
    context,
    coverage: { dimensions, participants: counts.overall, minCohort: context.minCohort },
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
  scope: AnalyticsScope | null = null,
): Promise<{ context: WellbeingAnalyticsContext; rows: SignalRow[]; organizationWide: ItemSignal[] | null }> {
  const context = await resolveContext(organizationId, instrumentKey);
  const { rows, counts, teamNames, waves } = await loadAnalyticsRows(
    organizationId,
    instrumentKey,
    source,
    scope,
  );
  const waveTitles = new Map(waves.map((wave) => [wave.id, waveTitle(wave)]));

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
      label: await labelFor(dimension, key, teamNames, waveTitles),
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
  scope: AnalyticsScope | null = null,
): Promise<{ context: WellbeingAnalyticsContext; view: DimensionProfileView }> {
  const context = await resolveContext(organizationId, instrumentKey);

  if (context.instrument.subscales.length === 0 && instrumentKey !== "disc360_wellbeing_v1") {
    return {
      context,
      view: { dimensions: null, suppressed: null, highest: null, lowest: null },
    };
  }

  const { rows, counts } = await loadAnalyticsRows(organizationId, instrumentKey, source, scope);
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
  scope: AnalyticsScope | null = null,
): Promise<{ context: WellbeingAnalyticsContext; signals: WellbeingSignal[] }> {
  const context = await resolveContext(organizationId, instrumentKey);
  const { rows, counts, teamNames, waves: campaignWaves } = await loadAnalyticsRows(
    organizationId,
    instrumentKey,
    source,
    scope,
  );

  /*
   * Waves, oldest first, with anything below the floor dropped entirely.
   *
   * Always individual waves here, whatever period a screen elsewhere is
   * showing. The signal engine reasons about consecutive MEASUREMENTS — "the
   * median has moved in the same direction three waves running" — and a
   * quarterly rollup that merged two of them would make that sentence false.
   */
  const series = periodSeries(rows, campaignWaves, "wave");
  const byWave = new Map<string, { label: string; at: string; scores: number[]; thresholds: number[] }>();
  for (const bucket of series.buckets) {
    byWave.set(bucket.key, { label: bucket.label, at: bucket.at, scores: [], thresholds: [] });
  }
  for (const row of rows) {
    const bucket = row.wave_id ? series.bucketFor.get(row.wave_id) : undefined;
    if (!bucket) continue;
    const entry = byWave.get(bucket.key)!;
    entry.scores.push(reportedScore(row, context.instrument));
    if (row.threshold_at_completion !== null) entry.thresholds.push(row.threshold_at_completion);
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
      const bucket = row.wave_id ? series.bucketFor.get(row.wave_id) : undefined;
      if (!bucket) continue;
      for (const entry of row.wellbeing_result_dimensions ?? []) {
        const waveMap = perDimension.get(entry.dimension_key) ?? new Map<string, number[]>();
        waveMap.set(bucket.key, [...(waveMap.get(bucket.key) ?? []), entry.index_score]);
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
  const { view } = await getWellbeingComparison(
    organizationId,
    instrumentKey,
    dimension,
    source,
    scope,
  );
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
