/**
 * Cohort confidentiality suppression for Wellbeing Pulse analytics.
 *
 * Pure and dependency-free so it can be unit-tested exhaustively, and called
 * from the server aggregation layer BEFORE any figure is placed in a payload.
 * Suppression here means the number never enters the response — not that a
 * chart hides it. A suppressed cohort returns `stats: null` and a reason.
 *
 * Two rules, and the second is the one that is usually missing:
 *
 *  1 · PRIMARY — a cohort with fewer than `minCohort` completed responses is
 *      never reported.
 *
 *  2 · COMPLEMENTARY — a partition that suppresses exactly ONE cell leaks it,
 *      because the reader can subtract the published cells from the parent
 *      total. Production = 8, Office Based = 6 published, Field Based hidden,
 *      and the hidden group is 2. So a partition must suppress zero cells or
 *      at least two; when only one falls below the floor, the next-smallest
 *      cell is suppressed alongside it.
 *
 * Residual risk this does NOT claim to solve: a determined reader combining
 * several different partitions of the same population, over several waves,
 * with outside knowledge of headcount. That is the general statistical
 * disclosure problem and it is not solvable by a cell rule. What is bounded
 * here is trivial reconstruction — subtraction from a published parent — plus
 * the drill-down depth cap applied by the caller.
 */

/** Platform default. Governance may raise it; it is never lowered silently. */
export const DEFAULT_MIN_COHORT = 7;

/** The floor may be configured upward, never below this. */
export const ABSOLUTE_MIN_COHORT = 5;

export type SuppressionReason =
  /** Fewer completed responses than the configured floor. */
  | "below_minimum"
  /** Withheld so a sibling cohort cannot be derived by subtraction. */
  | "complementary"
  /** The whole partition was withheld — too few cohorts to hide one safely. */
  | "partition_unsafe";

export const SUPPRESSION_MESSAGE = "Insufficient responses to protect confidentiality";

export interface CohortInput<TStats> {
  /** Stable key, e.g. a team id or a department id. */
  key: string;
  /** Display label for the cohort. */
  label: string;
  /** Completed Wellbeing Pulse responses in this cohort. */
  completed: number;
  /**
   * Everything derived from those responses. Passed through untouched when
   * published, dropped entirely when suppressed — so a suppressed cohort's
   * figures are never constructed into the payload at all.
   */
  stats: TStats;
}

export interface CohortOutcome<TStats> {
  key: string;
  label: string;
  /**
   * Completed count. Safe to publish for a suppressed cohort ONLY when the
   * caller asks for it; `suppressPartition` withholds it by default because a
   * count is itself a cohort figure. See `revealCounts`.
   */
  completed: number | null;
  stats: TStats | null;
  suppressed: boolean;
  reason: SuppressionReason | null;
  /** Participant/manager-facing text for a suppressed cell. */
  message: string | null;
}

export interface PartitionOptions {
  /** Minimum completed responses per cohort. Defaults to DEFAULT_MIN_COHORT. */
  minCohort?: number;
  /**
   * Publish the completed count for suppressed cohorts so a facilitator can
   * still see coverage. OFF by default: a bare count is the exact figure the
   * complementary rule exists to protect, and revealing it re-opens the
   * subtraction path. Only safe when no parent total is published alongside.
   */
  revealCounts?: boolean;
}

export interface PartitionResult<TStats> {
  cohorts: CohortOutcome<TStats>[];
  /** Cohorts whose figures reached the payload. */
  publishedCount: number;
  /** Cohorts withheld, for either reason. */
  suppressedCount: number;
  /** True when nothing in this partition may be shown. */
  fullySuppressed: boolean;
}

export function resolveMinCohort(configured?: number | null): number {
  if (configured === undefined || configured === null) return DEFAULT_MIN_COHORT;
  if (!Number.isInteger(configured) || configured < ABSOLUTE_MIN_COHORT) {
    throw new RangeError(
      `Minimum cohort size must be an integer of at least ${ABSOLUTE_MIN_COHORT}, received ${configured}`,
    );
  }
  return configured;
}

/** A single cohort, with no siblings to subtract from. */
export function isPublishable(completed: number, minCohort = DEFAULT_MIN_COHORT): boolean {
  return completed >= minCohort;
}

/**
 * Applies both rules to one partition of a population.
 *
 * A "partition" is a set of cohorts that together account for a parent total a
 * reader can also see — departments within an organisation, work locations
 * within a department, teams within an org. Cohorts that do NOT sum to a
 * published parent still pass through this function safely; the complementary
 * rule simply costs nothing there.
 */
export function suppressPartition<TStats>(
  input: CohortInput<TStats>[],
  options: PartitionOptions = {},
): PartitionResult<TStats> {
  const minCohort = resolveMinCohort(options.minCohort);
  const revealCounts = options.revealCounts ?? false;

  // Primary rule.
  const decisions = input.map((cohort) => ({
    cohort,
    suppressed: cohort.completed < minCohort,
    reason: (cohort.completed < minCohort ? "below_minimum" : null) as SuppressionReason | null,
  }));

  const suppressedCount = () => decisions.filter((entry) => entry.suppressed).length;
  const publishedEntries = () => decisions.filter((entry) => !entry.suppressed);

  // Complementary rule. One hidden cell is a subtraction away from being
  // read; keep withholding the smallest published cohort until at least two
  // are hidden, or until nothing is left to publish.
  while (suppressedCount() === 1 && publishedEntries().length > 0) {
    const smallest = publishedEntries().reduce((low, entry) =>
      entry.cohort.completed < low.cohort.completed ? entry : low,
    );
    smallest.suppressed = true;
    smallest.reason = "complementary";
  }

  // A partition of one cell IS the parent: publishing it discloses nothing the
  // parent did not. A partition where the single suppressed cell could not be
  // paired (nothing left to withhold) is marked unsafe rather than published.
  const stillSingle = suppressedCount() === 1 && publishedEntries().length === 0;
  if (stillSingle && decisions.length > 1) {
    for (const entry of decisions) {
      entry.suppressed = true;
      entry.reason = entry.reason ?? "partition_unsafe";
    }
  }

  const cohorts: CohortOutcome<TStats>[] = decisions.map((entry) => ({
    key: entry.cohort.key,
    label: entry.cohort.label,
    completed: entry.suppressed ? (revealCounts ? entry.cohort.completed : null) : entry.cohort.completed,
    stats: entry.suppressed ? null : entry.cohort.stats,
    suppressed: entry.suppressed,
    reason: entry.reason,
    message: entry.suppressed ? SUPPRESSION_MESSAGE : null,
  }));

  const published = cohorts.filter((cohort) => !cohort.suppressed).length;
  return {
    cohorts,
    publishedCount: published,
    suppressedCount: cohorts.length - published,
    fullySuppressed: published === 0,
  };
}

/**
 * Guards a drill-down: every filter dimension must still leave a publishable
 * cohort. Returns the reason to show instead of the figures, or null when the
 * slice may be reported.
 */
export function checkSlice(
  completed: number,
  minCohort = DEFAULT_MIN_COHORT,
): { publishable: boolean; message: string | null } {
  return isPublishable(completed, minCohort)
    ? { publishable: true, message: null }
    : { publishable: false, message: SUPPRESSION_MESSAGE };
}
