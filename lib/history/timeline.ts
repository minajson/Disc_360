import {
  DIMENSION_KEY,
  DIMENSIONS,
  type ArchetypeCode,
  type Dimension,
  type DiscScores,
} from "../types/index.ts";
import { dimensionMeta } from "../../data/dimension-meta.ts";

/**
 * Longitudinal history mathematics — pure, deterministic, unit-tested.
 *
 * Two rules govern everything here, and both are enforced by test:
 *
 *  1. **A movement is not a change until it clears a threshold.** Response
 *     variation, a different room, a different week and a different role all
 *     move scores by a few points. Reporting every wobble as development would
 *     be noise dressed as insight.
 *
 *  2. **DISC describes expressed behaviour in a context, not a fixed trait.**
 *     Language here says a pattern "changed in this context" — never that a
 *     personality changed. No causal claim is ever made about why.
 */

/**
 * Smallest per-dimension movement reported as a real change.
 *
 * Below this the delta still renders (participants can see the number) but is
 * labelled as within normal variation rather than as movement.
 */
export const MEANINGFUL_MOVEMENT = 8;

/** At or above this, a movement is called substantial rather than slight. */
export const SUBSTANTIAL_MOVEMENT = 20;

export type MovementSize = "none" | "slight" | "moderate" | "substantial";

export const MOVEMENT_LABEL: Record<MovementSize, string> = {
  none: "Within normal variation",
  slight: "Slight movement",
  moderate: "Moderate movement",
  substantial: "Substantial movement",
};

/**
 * The single caveat shown wherever a delta appears. Kept as a constant so it
 * cannot drift between the timeline, the trend chart and an export.
 */
export const VARIATION_NOTE =
  "Small score movements may reflect context, role expectations or normal response variation.";

export function movementSize(delta: number): MovementSize {
  const magnitude = Math.abs(delta);
  if (magnitude < MEANINGFUL_MOVEMENT) return "none";
  if (magnitude >= SUBSTANTIAL_MOVEMENT) return "substantial";
  if (magnitude >= MEANINGFUL_MOVEMENT * 2) return "moderate";
  return "slight";
}

/* ── records ────────────────────────────────────────────────────────── */

export type AssessmentKind = "disc" | "focus";

/**
 * One completed assessment as it is read back from history, carrying the
 * context that existed at completion rather than today's values.
 */
export interface HistoryRecord {
  id: string;
  kind: AssessmentKind;
  completedAt: string;
  scores: DiscScores;
  archetypeCode: ArchetypeCode;
  archetypeName: string;
  primary: Dimension;
  secondary: Dimension | null;
  /** Null for an individual attempt taken outside any team. */
  teamId: string | null;
  teamSeriesId: string | null;
  /** Snapshot fields — null on rows completed before snapshots existed. */
  teamNameAtCompletion: string | null;
  departmentAtCompletion: string | null;
  roleAtCompletion: string | null;
  organizationNameAtCompletion: string | null;
  retakeReason: string | null;
  retakeNote: string | null;
  assessmentVersion: number | null;
  scoringVersion: string | null;
  attemptNumber: number | null;
}

export const RETAKE_REASON_LABEL: Record<string, string> = {
  first_attempt: "First assessment",
  new_role: "New role",
  new_team: "New team",
  annual_reassessment: "Annual reassessment",
  leadership_programme: "Leadership programme",
  personal_review: "Personal review",
  other: "Other",
};

/** Human context line for a record, degrading honestly when unrecorded. */
export function contextLabel(record: HistoryRecord): string {
  const parts = [
    record.teamNameAtCompletion ?? (record.teamId ? "Team assessment" : "Individual assessment"),
    record.departmentAtCompletion,
    record.roleAtCompletion,
  ].filter((part): part is string => Boolean(part));
  return parts.join(" · ");
}

/* ── ordering and current resolution ────────────────────────────────── */

/** Newest first. Ties break on id so the order is total and stable. */
export function newestFirst(records: readonly HistoryRecord[]): HistoryRecord[] {
  return [...records].sort(
    (a, b) =>
      Date.parse(b.completedAt) - Date.parse(a.completedAt) || a.id.localeCompare(b.id),
  );
}

export function oldestFirst(records: readonly HistoryRecord[]): HistoryRecord[] {
  return newestFirst(records).reverse();
}

export interface CurrentContext {
  kind: AssessmentKind;
  /**
   * `undefined` means "any context" (the participant's own overall latest).
   * `null` means the individual context specifically — attempts with no team.
   * A string selects one team.
   */
  teamId?: string | null;
}

/**
 * The current profile for a context.
 *
 * Never "the participant's latest result" on a team surface: a member who
 * assessed for another team last month must not appear as completed here.
 * When a teamId is supplied, only attempts attached to that team qualify.
 */
export function currentResult(
  records: readonly HistoryRecord[],
  context: CurrentContext,
): HistoryRecord | null {
  const eligible = newestFirst(records).filter((record) => {
    if (record.kind !== context.kind) return false;
    if (context.teamId === undefined) return true;
    return record.teamId === context.teamId;
  });
  return eligible[0] ?? null;
}

/** Everything that is not the current result for the context, newest first. */
export function priorResults(
  records: readonly HistoryRecord[],
  context: CurrentContext,
): HistoryRecord[] {
  const current = currentResult(records, context);
  if (!current) return [];
  return newestFirst(records).filter(
    (record) => record.kind === context.kind && record.id !== current.id,
  );
}

/* ── deltas ─────────────────────────────────────────────────────────── */

export interface DimensionDelta {
  dimension: Dimension;
  from: number;
  to: number;
  delta: number;
  size: MovementSize;
}

export interface RecordComparison {
  from: HistoryRecord;
  to: HistoryRecord;
  /** Days between the two completions. */
  daysApart: number;
  deltas: DimensionDelta[];
  /** Movements that cleared the threshold, largest first. */
  notable: DimensionDelta[];
  primaryChanged: boolean;
  secondaryChanged: boolean;
  archetypeChanged: boolean;
  /** Cautious, non-causal summary. */
  summary: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function compareRecords(
  from: HistoryRecord,
  to: HistoryRecord,
): RecordComparison {
  const deltas: DimensionDelta[] = DIMENSIONS.map((dimension) => {
    const key = DIMENSION_KEY[dimension];
    const delta = to.scores[key] - from.scores[key];
    return {
      dimension,
      from: from.scores[key],
      to: to.scores[key],
      delta,
      size: movementSize(delta),
    };
  });

  const notable = deltas
    .filter((entry) => entry.size !== "none")
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const primaryChanged = from.primary !== to.primary;
  const secondaryChanged = from.secondary !== to.secondary;
  const archetypeChanged = from.archetypeCode !== to.archetypeCode;
  const daysApart = Math.max(
    0,
    Math.round((Date.parse(to.completedAt) - Date.parse(from.completedAt)) / DAY_MS),
  );

  return {
    from,
    to,
    daysApart,
    deltas,
    notable,
    primaryChanged,
    secondaryChanged,
    archetypeChanged,
    summary: comparisonSummary({
      notable,
      primaryChanged,
      archetypeChanged,
      from,
      to,
      daysApart,
    }),
  };
}

function comparisonSummary(input: {
  notable: DimensionDelta[];
  primaryChanged: boolean;
  archetypeChanged: boolean;
  from: HistoryRecord;
  to: HistoryRecord;
  daysApart: number;
}): string {
  const { notable, primaryChanged, archetypeChanged, from, to, daysApart } = input;
  const span =
    daysApart >= 60
      ? `${Math.round(daysApart / 30)} months apart`
      : `${daysApart} day${daysApart === 1 ? "" : "s"} apart`;

  if (notable.length === 0) {
    return `Across these two assessments (${span}), no dimension moved by ${MEANINGFUL_MOVEMENT} points or more. Your expressed pattern reads as consistent between these two contexts.`;
  }

  const movements = notable
    .slice(0, 2)
    .map(
      (entry) =>
        `${dimensionMeta[entry.dimension].label} ${entry.delta > 0 ? "up" : "down"} ${Math.abs(entry.delta)}`,
    )
    .join(" and ");

  const styleLine = primaryChanged
    ? ` Your leading style reads as ${dimensionMeta[to.primary].label} in the later context, where it read as ${dimensionMeta[from.primary].label} before.`
    : archetypeChanged
      ? " Your profile blend reads differently, while the leading style is unchanged."
      : " Your leading style is unchanged.";

  return `Across these two assessments (${span}), ${movements}.${styleLine} Your expressed behavioural pattern changed in this context — DISC describes how you showed up in each setting, not a fixed trait.`;
}

/* ── series ─────────────────────────────────────────────────────────── */

export interface TrendPoint {
  id: string;
  completedAt: string;
  /** Short display label, e.g. "Jul 2026". */
  label: string;
  scores: DiscScores;
  primary: Dimension;
  context: string;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Chronological trend series for one participant, one assessment kind. */
export function trendSeries(
  records: readonly HistoryRecord[],
  kind: AssessmentKind,
): TrendPoint[] {
  return oldestFirst(records)
    .filter((record) => record.kind === kind)
    .map((record) => {
      const date = new Date(record.completedAt);
      const valid = !Number.isNaN(date.getTime());
      return {
        id: record.id,
        completedAt: record.completedAt,
        label: valid
          ? `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
          : "Unknown date",
        scores: record.scores,
        primary: record.primary,
        context: contextLabel(record),
      };
    });
}

/**
 * The default history view: the most recent `limit` records, newest first,
 * plus whether more exist behind an expand control.
 */
export function defaultView(
  records: readonly HistoryRecord[],
  limit = 3,
): { visible: HistoryRecord[]; hiddenCount: number } {
  const ordered = newestFirst(records);
  return {
    visible: ordered.slice(0, limit),
    hiddenCount: Math.max(0, ordered.length - limit),
  };
}

/* ── team history ───────────────────────────────────────────────────── */

export interface TeamPeriod {
  teamId: string;
  teamName: string;
  /** Series the period belongs to, or null for a standalone team. */
  teamSeriesId: string | null;
  completedAt: string;
  memberCount: number;
  completedCount: number;
  averages: DiscScores;
  composition: Record<Dimension, number>;
  departments: string[];
}

export interface TeamPeriodComparison {
  from: TeamPeriod;
  to: TeamPeriod;
  deltas: DimensionDelta[];
  notable: DimensionDelta[];
  completionDelta: number;
  headcountDelta: number;
  summary: string;
}

/**
 * Periods belonging to one lineage, oldest first.
 *
 * Membership is explicit — a shared `teamSeriesId`, or the team itself. Names
 * are never matched: two unrelated teams can share a name, and a continuing
 * team is usually renamed precisely because something changed.
 */
export function periodsInSeries(
  periods: readonly TeamPeriod[],
  seriesId: string | null,
  teamId: string,
): TeamPeriod[] {
  const inSeries = seriesId
    ? periods.filter((period) => period.teamSeriesId === seriesId)
    : periods.filter((period) => period.teamId === teamId);
  return [...inSeries].sort(
    (a, b) =>
      Date.parse(a.completedAt) - Date.parse(b.completedAt) ||
      a.teamId.localeCompare(b.teamId),
  );
}

export function compareTeamPeriods(
  from: TeamPeriod,
  to: TeamPeriod,
): TeamPeriodComparison {
  const deltas: DimensionDelta[] = DIMENSIONS.map((dimension) => {
    const key = DIMENSION_KEY[dimension];
    const delta = to.averages[key] - from.averages[key];
    return {
      dimension,
      from: from.averages[key],
      to: to.averages[key],
      delta,
      size: movementSize(delta),
    };
  });
  const notable = deltas
    .filter((entry) => entry.size !== "none")
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const rate = (period: TeamPeriod) =>
    period.memberCount > 0
      ? Math.round((period.completedCount / period.memberCount) * 100)
      : 0;
  const completionDelta = rate(to) - rate(from);
  const headcountDelta = to.memberCount - from.memberCount;

  const movement =
    notable.length === 0
      ? `no dimension average moved by ${MEANINGFUL_MOVEMENT} points or more`
      : notable
          .slice(0, 2)
          .map(
            (entry) =>
              `${dimensionMeta[entry.dimension].label} ${entry.delta > 0 ? "up" : "down"} ${Math.abs(entry.delta)}`,
          )
          .join(" and ");

  return {
    from,
    to,
    deltas,
    notable,
    completionDelta,
    headcountDelta,
    summary: `Between ${from.teamName} and ${to.teamName}, ${movement}. Headcount ${headcountDelta === 0 ? "is unchanged" : headcountDelta > 0 ? `rose by ${headcountDelta}` : `fell by ${Math.abs(headcountDelta)}`}, and completion ${completionDelta === 0 ? "held steady" : completionDelta > 0 ? `rose ${completionDelta} points` : `fell ${Math.abs(completionDelta)} points`}. Composition differences may reflect who took part in each period as much as any change in the team.`,
  };
}
