import type { DistributionBucket, ThresholdDirection } from "@/lib/wellbeing/aggregate";
import { ChartReveal } from "./ChartReveal";

/**
 * The score distribution — the hero analytics visual.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THE SHAPE LEADS, NOT THE AVERAGE.
 *
 * A screening count over a workforce is not normally distributed, and the
 * shape is the management question: a few people reporting a great deal of
 * recent difficulty and many people reporting a little produce similar
 * averages and call for completely different responses.
 *
 * THE NOTEWORTHY SIDE IS THE INSTRUMENT'S, NOT THE CHART'S.
 *
 * `bucket.atOrAboveThreshold` already means "on this questionnaire's
 * noteworthy side" — at or above the line for GHQ, BELOW the cut-off for
 * WHO-5, which counts upward toward wellbeing. The legend takes its wording
 * from `thresholdDirection` rather than assuming, because the old wording
 * ("Below threshold (0–n)") described the healthy WHO-5 majority as the
 * unremarkable half and the flagged minority as the upper one — exactly
 * backwards.
 *
 * THE PREVIOUS WAVE, WHERE COMPARING IS VALID.
 *
 * Drawn as an outline behind the current bars, never as a second colour: two
 * filled series invite reading the difference as a quantity, and the honest
 * claim is "this is the shape it had last time". It is omitted entirely when
 * the two waves were scored against different thresholds — a comparison
 * across a policy change describes the policy, not the workforce.
 *
 * Bars grow once on entering the viewport and never again. Colour is never
 * alone: the axis label under a flagged bucket is bolder and the legend names
 * both sides in words.
 * ─────────────────────────────────────────────────────────────────────
 */
export function DistributionChart({
  distribution,
  threshold,
  completed,
  maxScore = 12,
  bucketSize = 1,
  thresholdDirection = "at_or_above",
  previous = null,
  previousLabel = null,
}: {
  distribution: DistributionBucket[];
  /** Null for instruments that carry no threshold. */
  threshold: number | null;
  completed: number;
  maxScore?: number;
  bucketSize?: number;
  /** Which side `atOrAboveThreshold` marks on this questionnaire. */
  thresholdDirection?: ThresholdDirection;
  /** The comparable previous wave's buckets, or null when not comparable. */
  previous?: DistributionBucket[] | null;
  previousLabel?: string | null;
}) {
  // One peak across both series, so the overlay is drawn on the same axis as
  // the bars rather than to its own convenient scale.
  const peak = Math.max(
    ...distribution.map((bucket) => bucket.count),
    ...(previous ?? []).map((bucket) => bucket.count),
    1,
  );
  const previousBy = new Map((previous ?? []).map((bucket) => [bucket.score, bucket.count]));
  const showOverlay = previous !== null && previous.length > 0;

  const flaggedLabel =
    thresholdDirection === "below"
      ? `Below the cut-off (0–${(threshold ?? 0) - 1})`
      : `At or above the threshold (${threshold}–${maxScore})`;
  const ordinaryLabel =
    thresholdDirection === "below"
      ? `At or above the cut-off (${threshold}–${maxScore})`
      : `Below the threshold (0–${(threshold ?? 0) - 1})`;

  return (
    <ChartReveal>
      <figure className="flex flex-col gap-4">
        <div
          className="flex items-end gap-[3px] sm:gap-1.5"
          style={{ height: "clamp(150px,26vw,230px)" }}
        >
          {distribution.map((bucket, index) => {
            const height = bucket.count === 0 ? 2 : Math.max((bucket.count / peak) * 100, 4);
            const was = previousBy.get(bucket.score) ?? 0;
            const wasHeight = was === 0 ? 0 : Math.max((was / peak) * 100, 4);
            return (
              <div
                key={bucket.score}
                className="group relative flex h-full flex-1 flex-col justify-end"
              >
                {bucket.count > 0 && (
                  <span className="mb-1 text-center font-mono text-[10px] text-slate sm:text-[11px]">
                    {bucket.count}
                  </span>
                )}

                {/* The previous wave, as an outline on the same axis. */}
                {showOverlay && wasHeight > 0 && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 rounded-t-[3px] border border-dashed border-[rgba(31,78,95,0.42)]"
                    style={{ height: `${wasHeight}%` }}
                  />
                )}

                <div
                  className="chart-grow rounded-t-[3px]"
                  style={
                    {
                      height: `${height}%`,
                      background: bucket.atOrAboveThreshold
                        ? "var(--color-pulse-watch)"
                        : "var(--color-pulse)",
                      opacity: bucket.count === 0 ? 0.25 : 1,
                      "--chart-index": index,
                    } as React.CSSProperties
                  }
                />

                {/* Tooltip: fades rather than snapping, and carries the
                    comparison where there is one. */}
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] whitespace-nowrap text-white opacity-0 transition-opacity duration-200 group-hover:block group-hover:opacity-100"
                >
                  {bucket.count} of {completed} scored {bucket.score}
                  {showOverlay ? ` · was ${was}` : ""}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-[3px] border-t border-[rgba(31,78,95,0.2)] pt-2 sm:gap-1.5">
          {distribution.map((bucket) => (
            <div key={bucket.score} className="flex-1 text-center">
              <span
                className={`font-mono text-[10px] sm:text-[11px] ${
                  bucket.atOrAboveThreshold ? "font-semibold text-pulse-watch" : "text-slate"
                }`}
              >
                {bucket.score}
              </span>
            </div>
          ))}
        </div>

        <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate">
          {threshold !== null ? (
            <>
              <Key colour="var(--color-pulse)" label={ordinaryLabel} />
              <Key colour="var(--color-pulse-watch)" label={flaggedLabel} />
            </>
          ) : (
            <Key
              colour="var(--color-pulse)"
              label={
                bucketSize > 1
                  ? `Scores 0–${maxScore}, grouped in ${bucketSize}s`
                  : `Scores 0–${maxScore}`
              }
            />
          )}
          {showOverlay && (
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-[2px] border border-dashed border-[rgba(31,78,95,0.6)]"
              />
              {previousLabel ?? "Previous wave"}
            </span>
          )}
          <span className="font-mono">n = {completed}</span>
        </figcaption>
      </figure>
    </ChartReveal>
  );
}

/** A colour swatch that is never on its own — the label is the carrier. */
function Key({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px]" style={{ background: colour }} />
      {label}
    </span>
  );
}
