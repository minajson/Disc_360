import { SUPPRESSION_MESSAGE } from "@/lib/wellbeing/suppression";

/**
 * A two-cohort executive comparison — used for Field Based vs Office Based.
 *
 * Deliberately symmetrical. A two-group comparison drawn as a ranked list
 * invites the reader to see a winner and a loser; setting the two side by side
 * with identical treatment says only that they differ, which is all the data
 * supports. Neither card is styled as good or bad, and neither is ordered
 * first by score — they appear in the taxonomy's own order.
 *
 * Where either cohort is below the confidentiality floor the whole comparison
 * is withheld rather than showing one side: publishing one of two groups whose
 * total is known is arithmetic away from publishing the other.
 */
export function TwoCohortCompare({
  cohorts,
  scoreLabel,
  scoreMax,
  threshold,
  minCohort,
}: {
  cohorts: {
    label: string;
    suppressed: boolean;
    stats: { completed: number; median: number; mean: number; atOrAboveThresholdShare: number } | null;
  }[];
  scoreLabel: string;
  scoreMax: number;
  threshold: number | null;
  minCohort: number;
}) {
  const published = cohorts.filter((cohort) => !cohort.suppressed && cohort.stats);

  if (published.length < 2) {
    return (
      <div className="rounded-2xl border border-hairline bg-canvas px-5 py-4">
        <p className="text-sm leading-relaxed text-slate">
          {SUPPRESSION_MESSAGE}. A comparison needs both groups to reach the minimum of {minCohort}{" "}
          people. Where only one qualifies it is withheld too — with two groups whose total is
          known, publishing one publishes the other.
        </p>
      </div>
    );
  }

  const lowest = [...published].sort((a, b) => a.stats!.median - b.stats!.median)[0]!;
  const highest = [...published].sort((a, b) => b.stats!.median - a.stats!.median)[0]!;
  const gap = Math.round((highest.stats!.median - lowest.stats!.median) * 10) / 10;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {published.map((cohort) => {
          const pct = Math.round((cohort.stats!.median / scoreMax) * 100);
          return (
            <div
              key={cohort.label}
              className="flex flex-col gap-4 rounded-2xl border border-[rgba(31,78,95,0.16)] bg-paper p-5 sm:p-6"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-base font-semibold text-ink">{cohort.label}</h3>
                <span className="font-mono text-xs text-faint">n = {cohort.stats!.completed}</span>
              </div>

              <div>
                <p className="font-display text-[clamp(2rem,5vw,2.6rem)] leading-none font-semibold text-ink tabular-nums">
                  {cohort.stats!.median}
                </p>
                <p className="mt-1.5 text-[11px] tracking-[0.12em] text-faint uppercase">
                  Median {scoreLabel}
                </p>
              </div>

              <div
                className="h-2 w-full overflow-hidden rounded-full bg-pulse-mist"
                role="img"
                aria-label={`Median ${cohort.stats!.median} of ${scoreMax}`}
              >
                <div className="h-full rounded-full bg-pulse-deep" style={{ width: `${pct}%` }} />
              </div>

              <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate">
                <div className="flex gap-1.5">
                  <dt className="text-faint">Mean</dt>
                  <dd className="font-mono tabular-nums">{cohort.stats!.mean}</dd>
                </div>
                {threshold !== null && (
                  <div className="flex gap-1.5">
                    <dt className="text-faint">At or above {threshold}</dt>
                    <dd className="font-mono tabular-nums">
                      {cohort.stats!.atOrAboveThresholdShare}%
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          );
        })}
      </div>

      <p className="text-sm leading-relaxed text-slate">
        {gap === 0 ? (
          <>Both groups recorded the same median this wave.</>
        ) : (
          <>
            <strong className="font-medium text-ink">{lowest.label}</strong> recorded a median{" "}
            {gap} {gap === 1 ? "point" : "points"} lower than{" "}
            <strong className="font-medium text-ink">{highest.label}</strong> this wave. The two
            groups differ in size, role and circumstance — this describes a difference in what was
            reported, not a judgement about either group or a cause for it.
          </>
        )}
      </p>
    </div>
  );
}
