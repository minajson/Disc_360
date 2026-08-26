import type { WellbeingCoverage } from "@/lib/wellbeing/analytics";

/**
 * What can and cannot be reported, stated before any figure is read.
 *
 * Each row is one way of dividing the workforce. The bar is the share of
 * participants sitting inside groups large enough to publish — so a reader can
 * see at a glance whether a comparison describes nearly everyone or a
 * fragment, and does not have to infer it from how many rows look empty.
 *
 * Withheld groups are counted, never named and never sized. Naming them would
 * disclose which parts of the workforce are small, which is most of what the
 * suppression was protecting in the first place.
 */
export function CohortCoverage({ coverage }: { coverage: WellbeingCoverage }) {
  const total = Math.max(coverage.participants, 1);

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-4">
        {coverage.dimensions.map((dimension) => {
          const share = Math.round((dimension.covered / total) * 100);
          return (
            <li key={dimension.key} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="text-sm font-medium text-ink">{dimension.label}</span>
                <span className="ml-auto font-mono text-xs text-slate tabular-nums">
                  {dimension.published} group{dimension.published === 1 ? "" : "s"} reportable
                  {dimension.withheld > 0 && (
                    <span className="text-faint">
                      {" "}
                      · {dimension.withheld} withheld
                    </span>
                  )}
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-sand">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-pulse"
                  style={{ width: `${Math.min(100, Math.max(share, dimension.covered > 0 ? 2 : 0))}%` }}
                />
              </div>
              <p className="font-mono text-[11px] text-faint tabular-nums">
                {dimension.covered} of {coverage.participants} participants inside a reportable
                group
              </p>
            </li>
          );
        })}
      </ul>

      <p className="text-xs leading-relaxed text-slate">
        A group is reportable once at least {coverage.minCohort} people in it have completed the
        pulse. Where only one group would fall below that line, a second is withheld alongside it
        — otherwise the first could be recovered by subtracting the rest from the total.
      </p>
    </div>
  );
}
