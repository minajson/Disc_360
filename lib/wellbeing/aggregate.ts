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
  /**
   * True when this bucket sits on the instrument's NOTEWORTHY side.
   *
   * For GHQ that is at or above the threshold; for WHO-5 it is below the
   * cut-off, because WHO-5 counts upward toward wellbeing. Kept under the old
   * name so existing GHQ consumers are unaffected — see `thresholdDirection`,
   * which says which side this actually means.
   */
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
  /** Count of responses on the noteworthy side of the threshold. */
  atOrAboveThreshold: number;
  /** That count as a percentage of completed, 0–100. Zero when no threshold. */
  atOrAboveThresholdShare: number;
  /**
   * WHICH SIDE the count above refers to, and how to label it.
   *
   * GHQ counts upward toward distress, so its noteworthy share is at or above
   * the threshold. WHO-5 counts upward toward WELLBEING, so its noteworthy
   * share is BELOW the cut-off — and a facilitator shown "% at or above" for
   * WHO-5 would read the healthy proportion as the concerning one.
   *
   * `thresholdLabel` is the comparator to print ("≥ 4", "< 50") so no display
   * surface has to hard-code one and get it wrong for half the instruments.
   */
  thresholdDirection: ThresholdDirection;
  thresholdLabel: string | null;
  /** Null for instruments that carry no threshold. */
  threshold: number | null;
  /** The instrument's own maximum, so a chart never guesses its axis. */
  maxScore: number;
  /** Points per distribution bucket. */
  bucketSize: number;
}

/**
 * Which side of a threshold is the one worth reporting.
 *
 * Not cosmetic: it decides what the headline percentage COUNTS.
 */
export type ThresholdDirection = "at_or_above" | "below";

export interface AggregateOptions {
  /** Null for an instrument that carries no threshold (DISC360 Wellbeing V1). */
  threshold?: number | null;
  /**
   * Defaults to `at_or_above`, which is right for GHQ-12 and GHQ-28 and wrong
   * for WHO-5. A caller that knows its instrument passes the correct one.
   */
  thresholdDirection?: ThresholdDirection;
  invited?: number | null;
  /**
   * The instrument's own maximum. GHQ-12 is 12, GHQ-28 is 28, WHO-5 and the
   * DISC360 Wellbeing Index are 100. Defaults to GHQ-12's so existing callers
   * are unchanged.
   */
  maxScore?: number;
  /**
   * Bucket width for the distribution. A 0–100 scale drawn as 101 columns is
   * unreadable, so wide scales bucket; 0–12 and 0–28 stay one column per point.
   */
  bucketSize?: number;
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
/**
 * Is this score on the side of the threshold that is worth reporting?
 *
 * The whole reason this is a function rather than `score >= threshold` inline
 * is that the answer depends on the instrument. Writing the comparison at each
 * call site is how a WHO-5 cohort ends up reported as its own opposite.
 */
function onNoteworthySide(
  score: number,
  threshold: number,
  direction: ThresholdDirection,
): boolean {
  return direction === "below" ? score < threshold : score >= threshold;
}

export function aggregateScores(
  scores: number[],
  options: AggregateOptions = {},
): WellbeingAggregate {
  const maxScore = options.maxScore ?? WELLBEING_MAX_SCORE;
  // Null threshold is meaningful: the instrument has none. Undefined falls
  // back to the GHQ default so existing GHQ callers are unchanged.
  const threshold =
    options.threshold === null
      ? null
      : (options.threshold ?? DEFAULT_SCREENING_THRESHOLD);
  const bucketSize = options.bucketSize ?? 1;
  const direction: ThresholdDirection = options.thresholdDirection ?? "at_or_above";

  for (const score of scores) {
    if (!Number.isInteger(score) || score < 0 || score > maxScore) {
      throw new RangeError(`Wellbeing score out of range: ${score}`);
    }
  }

  const completed = scores.length;
  const bucketCount = Math.floor(maxScore / bucketSize) + 1;
  const counts = new Array<number>(bucketCount).fill(0);
  for (const score of scores) {
    const bucket = Math.min(Math.floor(score / bucketSize), bucketCount - 1);
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }

  const distribution: DistributionBucket[] = counts.map((count, bucket) => {
    const score = bucket * bucketSize;
    return {
      score,
      count,
      share: completed === 0 ? 0 : round1((count / completed) * 100),
      // False throughout for an instrument with no threshold — nothing is on
      // the noteworthy side of a line that does not exist.
      atOrAboveThreshold: threshold !== null && onNoteworthySide(score, threshold, direction),
    };
  });

  const above =
    threshold === null
      ? 0
      : scores.filter((score) => onNoteworthySide(score, threshold, direction)).length;
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
    atOrAboveThresholdShare:
      threshold === null || completed === 0 ? 0 : round1((above / completed) * 100),
    thresholdDirection: direction,
    thresholdLabel:
      threshold === null ? null : direction === "below" ? `< ${threshold}` : `≥ ${threshold}`,
    threshold,
    maxScore,
    bucketSize,
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
  const thresholds = [
    ...new Set(
      ordered
        .map((point) => point.aggregate.threshold)
        .filter((value): value is number => value !== null),
    ),
  ].sort((a, b) => a - b);

  const latest = ordered[ordered.length - 1];
  const previous = ordered[ordered.length - 2];
  // An instrument with no threshold has no "% at or above" series to draw at
  // all; one with a threshold needs both waves to share it.
  const comparable = Boolean(
    latest &&
      previous &&
      latest.aggregate.threshold !== null &&
      latest.aggregate.threshold === previous.aggregate.threshold,
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


/**
 * The previous wave's distribution, but ONLY where overlaying it is honest.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THREE CONDITIONS, ALL REQUIRED.
 *
 *  1 · There IS a previous wave. One point is not a comparison.
 *  2 · Both waves used the same threshold. `thresholdConsistent` is false when
 *      the cut-off changed between them, and a shape drawn across a policy
 *      change describes the policy rather than the workforce.
 *  3 · Both share the same bucket layout. A distribution grouped in 10s cannot
 *      be laid over one grouped in 1s; the bars would not line up with the
 *      axis they are drawn against.
 *
 * Returns null rather than a best effort. An overlay that is nearly right is
 * worse than none, because it is read as exact.
 * ─────────────────────────────────────────────────────────────────────
 */
export function comparablePreviousWave(
  trend: WellbeingTrend,
): { label: string; distribution: DistributionBucket[] } | null {
  const current = trend.points.at(-1);
  const previous = trend.points.at(-2);
  if (!current || !previous) return null;
  if (!trend.thresholdConsistent) return null;

  const a = current.aggregate.distribution;
  const b = previous.aggregate.distribution;
  if (a.length !== b.length) return null;
  if (a.some((bucket, index) => bucket.score !== b[index]?.score)) return null;

  return { label: previous.label, distribution: b };
}
