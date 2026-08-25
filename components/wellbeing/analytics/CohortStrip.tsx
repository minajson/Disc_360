import type { CohortStats } from "@/lib/wellbeing/analytics";
import type { CohortOutcome } from "@/lib/wellbeing/suppression";
import { WELLBEING_MAX_SCORE } from "@/lib/scoring/wellbeing";
import { SuppressionNotice } from "./SuppressionNotice";

/**
 * Cohort comparison as heat strips rather than a table.
 *
 * Each row shows the cohort's median as a position on the shared 0–12 scale,
 * with the threshold marked in the same place on every row — so cohorts are
 * read against the policy line and against each other at a glance, without a
 * wall of numbers. The figures are still printed, because a strip alone is not
 * a number a facilitator can quote.
 *
 * A suppressed cohort renders as a suppressed cohort: same row, no figures.
 * Removing the row entirely would tell a reader which cohorts are small, which
 * is most of what the suppression was protecting.
 */
export function CohortStrip({
  cohorts,
  threshold,
  minCohort,
  maxScore = WELLBEING_MAX_SCORE,
}: {
  cohorts: CohortOutcome<CohortStats>[];
  /** Null for instruments that carry no threshold — no rule is drawn. */
  threshold: number | null;
  minCohort: number;
  maxScore?: number;
}) {
  const thresholdPercent = threshold === null ? null : (threshold / maxScore) * 100;

  return (
    <ul className="flex flex-col divide-y divide-[rgba(31,78,95,0.12)]">
      {cohorts.map((cohort) => (
        <li key={cohort.key} className="flex flex-col gap-2.5 py-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-sm font-medium text-ink">{cohort.label}</span>
            {cohort.suppressed ? (
              <span className="ml-auto">
                <SuppressionNotice compact />
              </span>
            ) : (
              <span className="ml-auto flex flex-wrap items-baseline gap-x-4 font-mono text-xs text-slate">
                <span>
                  median{" "}
                  <strong className="text-sm text-ink">{cohort.stats!.median}</strong>
                </span>
                {threshold !== null && (
                  <span>
                    ≥{threshold}{" "}
                    <strong className="text-sm text-ink">
                      {cohort.stats!.atOrAboveThresholdShare}%
                    </strong>
                  </span>
                )}
                <span>n = {cohort.completed}</span>
              </span>
            )}
          </div>

          <div className="relative h-2.5 overflow-hidden rounded-full bg-pulse-soft/70">
            {!cohort.suppressed && (
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.max((cohort.stats!.median / maxScore) * 100, 1.5)}%`,
                  background:
                    threshold !== null && cohort.stats!.median >= threshold
                      ? "var(--color-pulse-attention)"
                      : "var(--color-pulse)",
                }}
              />
            )}
            {thresholdPercent !== null && (
              <div
                aria-hidden="true"
                className="absolute inset-y-0 w-px bg-[rgba(20,55,67,0.55)]"
                style={{ left: `${thresholdPercent}%` }}
              />
            )}
          </div>
        </li>
      ))}
      {cohorts.length === 0 && (
        <li className="py-4">
          <SuppressionNotice minCohort={minCohort} detail="No completed responses in this view yet." />
        </li>
      )}
    </ul>
  );
}
