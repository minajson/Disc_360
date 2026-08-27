import type { CohortStats } from "@/lib/wellbeing/analytics";
import type { CohortOutcome } from "@/lib/wellbeing/suppression";
import { SuppressionNotice } from "./SuppressionNotice";

/**
 * Cohort comparison, built so that it cannot become a league table.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE THREE DESIGN DECISIONS THAT MATTER.
 *
 *  1 · NO RANK ORDER. Rows are alphabetical, never sorted by figure, and there
 *      is no position number, no medal, no colour scale from good to bad. The
 *      moment a wellbeing comparison is ordered by score it becomes a
 *      performance table, and a department reads its position as a verdict on
 *      its manager.
 *
 *  2 · SPREAD, NOT JUST A POINT. Each cohort is drawn as the band covering its
 *      middle, with the median marked inside it. Two cohorts with the same
 *      median and very different spreads are different situations, and a bar
 *      chart of medians says they are identical. It is also the safer figure:
 *      a band says how varied a group is without placing anybody on the scale.
 *
 *  3 · A WITHHELD COHORT KEEPS ITS ROW. Removing it would tell a reader
 *      exactly which parts of the workforce are small, which is most of what
 *      the suppression was protecting.
 * ─────────────────────────────────────────────────────────────────────
 */

export function CohortComparison({
  cohorts,
  scoreLabel,
  scoreMin,
  scoreMax,
  threshold,
  minCohort,
  distress,
}: {
  cohorts: CohortOutcome<CohortStats>[];
  scoreLabel: string;
  scoreMin: number;
  scoreMax: number;
  /** Null for instruments carrying no governed threshold — no rule is drawn. */
  threshold: number | null;
  minCohort: number;
  /** Whether a higher figure means more of what is being screened for. */
  distress: boolean;
}) {
  const span = Math.max(1, scoreMax - scoreMin);
  const at = (value: number) => ((value - scoreMin) / span) * 100;
  const published = cohorts.filter((cohort) => !cohort.suppressed);

  if (cohorts.length === 0) {
    return (
      <SuppressionNotice
        minCohort={minCohort}
        detail="No completed responses have been recorded for this way of dividing the workforce."
      />
    );
  }

  // The shared reference line: the median across every published cohort's
  // median. Drawn so a reader can see which cohorts sit either side of the
  // middle WITHOUT being told which end is good.
  const centre =
    published.length > 0
      ? [...published.map((cohort) => cohort.stats!.median)].sort((a, b) => a - b)[
          Math.floor(published.length / 2)
        ]!
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* axis */}
      <div className="flex items-baseline justify-between font-mono text-[10px] tracking-[0.1em] text-faint tabular-nums">
        <span>{scoreMin}</span>
        <span className="tracking-[0.14em] uppercase">{scoreLabel}</span>
        <span>{scoreMax}</span>
      </div>

      <ul className="flex flex-col divide-y divide-hairline">
        {cohorts.map((cohort) => (
          <li key={cohort.key} className="flex flex-col gap-2.5 py-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-sm font-medium text-ink">{cohort.label}</span>
              {cohort.suppressed ? (
                <span className="ml-auto">
                  <SuppressionNotice compact />
                </span>
              ) : (
                <span className="ml-auto flex flex-wrap items-baseline gap-x-4 font-mono text-xs text-slate tabular-nums">
                  <span>
                    median{" "}
                    <strong className="font-display text-base text-ink">
                      {cohort.stats!.median}
                    </strong>
                  </span>
                  <span className="text-faint">
                    middle {cohort.stats!.p25}–{cohort.stats!.p75}
                  </span>
                  {threshold !== null && (
                    <span>
                      {/* The comparator comes from the aggregate, never
                          hard-coded: WHO-5's noteworthy side is BELOW its
                          cut-off, so a fixed "≥" would label the healthy
                          proportion as the concerning one. */}
                      {cohort.stats!.thresholdLabel ?? `≥ ${threshold}`}{" "}
                      {cohort.stats!.atOrAboveThresholdShare}%
                    </span>
                  )}
                  <span className="text-faint">n = {cohort.completed}</span>
                </span>
              )}
            </div>

            <div className="relative h-6">
              {/* the scale */}
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[rgba(31,78,95,0.14)]" />

              {centre !== null && (
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 w-px bg-[rgba(31,78,95,0.22)]"
                  style={{ left: `${at(centre)}%` }}
                />
              )}

              {threshold !== null && (
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 w-px border-l border-dashed border-[rgba(138,106,47,0.65)]"
                  style={{ left: `${at(threshold)}%` }}
                />
              )}

              {!cohort.suppressed && (
                <>
                  <div
                    className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${at(cohort.stats!.p25)}%`,
                      width: `${Math.max(1, at(cohort.stats!.p75) - at(cohort.stats!.p25))}%`,
                      background: distress
                        ? "var(--color-pulse-attention-soft)"
                        : "var(--color-pulse-soft)",
                    }}
                  />
                  <div
                    className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${at(cohort.stats!.median)}%`,
                      background: distress
                        ? "var(--color-pulse-attention)"
                        : "var(--color-pulse)",
                    }}
                  />
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t border-hairline pt-4 font-mono text-[11px] leading-relaxed text-faint">
        <p>
          Band: the middle of each group. Bar: its median.
          {centre !== null && " Solid line: the middle of the published groups."}
          {threshold !== null && " Dashed line: the configured threshold."}
        </p>
        <p className="text-slate">
          Groups are listed alphabetically and are never ordered by their figures. A difference
          between groups is a difference — not a ranking, not a score for a manager, and not a
          finding about anybody in them.
        </p>
      </div>
    </div>
  );
}
