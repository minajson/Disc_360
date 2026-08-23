import { DEFAULT_SCREENING_THRESHOLD, WELLBEING_MAX_SCORE } from "../scoring/wellbeing.ts";

/**
 * Aggregate statistics for Wellbeing Pulse analytics — pure, no I/O.
 *
 * Takes completed scores that the caller has ALREADY authorized and already
 * passed through cohort suppression, and turns them into the figures a
 * management surface may show. It knows nothing about who produced a score,
 * by construction: the input is a list of numbers, so there is no identity to
 * leak through this layer even by mistake.
 *
 * Median and distribution lead; the mean is available but secondary. A 0–12
 * screening count over a workforce is not normally distributed and a single
 * mean flattens exactly the shape that matters — whether a few people are
 * reporting a great deal of recent difficulty, or many are reporting a little.
 *
 * There is deliberately no composite "wellbeing index". Inventing a weighted
 * score would imply a validated construct that does not exist.
 */

export interface DistributionBucket {
  /** GHQ-12 total, 0–12. */
  score: number;
  count: number;
  /** Percentage of completed responses, 0–100, rounded to one decimal. */
  share: number;
  /** True when this bucket sits at or above the configured threshold. */
  atOrAboveThreshold: boolean;
}

export interface WellbeingAggregate {
  completed: number;
  /** Invited, where the cohort has a known denominator. */
  invited: number | null;
  /** Percentage 0–100, or null when there is no denominator. */
  participation: number | null;
  /** Primary central measure. Halves are possible on an even count. */
  median: number;
  /** Secondary. Reported alongside the median, never instead of it. */
  mean: number;
  /** Always 13 buckets, 0–12, including empty ones so the axis is stable. */
  distribution: DistributionBucket[];
  /** Count of responses at or above the configured threshold. */
  atOrAboveThreshold: number;
  /** That count as a percentage of completed, 0–100. */
  atOrAboveThresholdShare: number;
  threshold: number;
}

export interface AggregateOptions {
  threshold?: number;
  invited?: number | null;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Median of an unsorted list. Returns 0 for an empty list; callers gate on `completed`. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : round1((sorted[middle - 1]! + sorted[middle]!) / 2);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return round1(values.reduce((total, value) => total + value, 0) / values.length);
}

/**
 * Builds the aggregate for one already-authorized, already-suppressed cohort.
 *
 * Scores outside 0–12 are a programming error rather than a data condition,
 * so they throw instead of being clamped into a plausible-looking figure.
 */
export function aggregateScores(
  scores: number[],
  options: AggregateOptions = {},
): WellbeingAggregate {
  const threshold = options.threshold ?? DEFAULT_SCREENING_THRESHOLD;

  for (const score of scores) {
    if (!Number.isInteger(score) || score < 0 || score > WELLBEING_MAX_SCORE) {
      throw new RangeError(`Wellbeing score out of range: ${score}`);
    }
  }

  const completed = scores.length;
  const counts = new Array<number>(WELLBEING_MAX_SCORE + 1).fill(0);
  for (const score of scores) counts[score] = (counts[score] ?? 0) + 1;

  const distribution: DistributionBucket[] = counts.map((count, score) => ({
    score,
    count,
    share: completed === 0 ? 0 : round1((count / completed) * 100),
    atOrAboveThreshold: score >= threshold,
  }));

  const above = scores.filter((score) => score >= threshold).length;
  const invited = options.invited ?? null;

  // Participation needs a denominator that actually contains the numerator.
  // Completions can exceed the roster — people join through a shared link, or
  // a roster is trimmed after a wave — and a percentage over 100 is not a
  // participation rate, it is evidence the denominator is wrong. Report
  // nothing rather than a figure an executive would have to explain away.
  const denominatorIsSound = invited !== null && invited > 0 && completed <= invited;

  return {
    completed,
    invited,
    participation: denominatorIsSound ? round1((completed / invited!) * 100) : null,
    median: median(scores),
    mean: mean(scores),
    distribution,
    atOrAboveThreshold: above,
    atOrAboveThresholdShare: completed === 0 ? 0 : round1((above / completed) * 100),
    threshold,
  };
}

/* ── movement between comparable pulses ─────────────────────────────── */

export type AggregateMovement = "lower" | "higher" | "unchanged";

export interface AggregateChange {
  movement: AggregateMovement;
  /** current − previous, to one decimal. */
  delta: number;
  current: number;
  previous: number;
}

function change(current: number, previous: number): AggregateChange {
  const delta = round1(current - previous);
  return {
    movement: delta === 0 ? "unchanged" : delta < 0 ? "lower" : "higher",
    delta,
    current,
    previous,
  };
}

export interface WavePoint {
  /** Stable key for the wave — a campaign id, a quarter, a completion month. */
  key: string;
  label: string;
  /** ISO-8601 of the wave, used only for ordering. */
  at: string;
  aggregate: WellbeingAggregate;
}

export interface WellbeingTrend {
  points: WavePoint[];
  medianChange: AggregateChange | null;
  thresholdShareChange: AggregateChange | null;
  participationChange: AggregateChange | null;
  /**
   * False when the waves were not all scored against the same threshold.
   * A "% at or above threshold" line is not comparable across a policy change,
   * so the surface must say so rather than draw a continuous series.
   */
  thresholdConsistent: boolean;
  /** The distinct thresholds present, ascending, when they differ. */
  thresholds: number[];
}

/**
 * Orders waves and reports movement between the two most recent.
 *
 * Movement is direction and magnitude only. Nothing here attributes a change
 * to a cause: two waves either side of a restructure show that scores moved,
 * not that the restructure moved them.
 */
export function buildTrend(points: WavePoint[]): WellbeingTrend {
  const ordered = [...points].sort((a, b) => a.at.localeCompare(b.at));
  const thresholds = [...new Set(ordered.map((point) => point.aggregate.threshold))].sort(
    (a, b) => a - b,
  );

  const latest = ordered[ordered.length - 1];
  const previous = ordered[ordered.length - 2];
  const comparable = Boolean(
    latest && previous && latest.aggregate.threshold === previous.aggregate.threshold,
  );

  return {
    points: ordered,
    medianChange:
      latest && previous ? change(latest.aggregate.median, previous.aggregate.median) : null,
    // Only meaningful when both waves used the same cut-off.
    thresholdShareChange:
      comparable && latest && previous
        ? change(
            latest.aggregate.atOrAboveThresholdShare,
            previous.aggregate.atOrAboveThresholdShare,
          )
        : null,
    participationChange:
      latest?.aggregate.participation != null && previous?.aggregate.participation != null
        ? change(latest.aggregate.participation, previous.aggregate.participation)
        : null,
    thresholdConsistent: thresholds.length <= 1,
    thresholds,
  };
}

/* ── item-level aggregate signal (§19) ──────────────────────────────── */

export interface ItemSignal {
  /** Item external_id — never a diagnostic label. */
  itemId: string;
  position: number;
  /** Responses at position 3 or 4 on this item, as a share of completed. */
  elevatedShare: number;
  elevatedCount: number;
  completed: number;
}

/**
 * Per-item proportion of responses indicating more difficulty than usual.
 *
 * Aggregate only, and deliberately flat: twelve independent proportions with
 * no grouping, no subscale and no derived construct. Naming any subset of GHQ
 * items "depression", "anxiety", "sleep" or "confidence" would assert a
 * factor structure this product has not validated and is not licensed to
 * claim, so the engine cannot express one.
 *
 * `itemPositions` rows are the stored per-result arrays; every row must be the
 * full length of the questionnaire version.
 */
export function itemSignals(itemPositions: number[][], itemIds: readonly string[]): ItemSignal[] {
  const completed = itemPositions.length;

  for (const row of itemPositions) {
    if (row.length !== itemIds.length) {
      throw new RangeError(
        `Item position row has ${row.length} entries, expected ${itemIds.length}`,
      );
    }
  }

  return itemIds.map((itemId, index) => {
    const elevated = itemPositions.filter((row) => row[index]! >= 2).length;
    return {
      itemId,
      position: index,
      elevatedCount: elevated,
      elevatedShare: completed === 0 ? 0 : round1((elevated / completed) * 100),
      completed,
    };
  });
}
