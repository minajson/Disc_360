import type { DistributionBucket } from "@/lib/wellbeing/aggregate";

/**
 * The 0–12 score distribution — the hero analytics visual.
 *
 * The distribution leads rather than a mean because a screening count over a
 * workforce is not normally distributed, and the shape is the management
 * question: a few people reporting a great deal of recent difficulty and many
 * people reporting a little produce similar averages and call for completely
 * different responses.
 *
 * The threshold split is carried by tone AND by the axis labels, so it
 * survives greyscale printing and colour-vision differences alike. No red
 * appears — an at-or-above column is warm, not alarming.
 */
export function DistributionChart({
  distribution,
  threshold,
  completed,
  maxScore = 12,
  bucketSize = 1,
}: {
  distribution: DistributionBucket[];
  /** Null for instruments that carry no threshold. */
  threshold: number | null;
  completed: number;
  maxScore?: number;
  bucketSize?: number;
}) {
  const peak = Math.max(...distribution.map((bucket) => bucket.count), 1);

  return (
    <figure className="flex flex-col gap-4">
      <div
        className="flex items-end gap-[3px] sm:gap-1.5"
        style={{ height: "clamp(140px,26vw,220px)" }}
      >
        {distribution.map((bucket) => {
          const height = bucket.count === 0 ? 2 : Math.max((bucket.count / peak) * 100, 4);
          return (
            <div
              key={bucket.score}
              className="relative flex h-full flex-1 flex-col justify-end"
              title={`${bucket.count} of ${completed} scored ${bucket.score}`}
            >
              {bucket.count > 0 && (
                <span className="mb-1 text-center font-mono text-[10px] text-slate sm:text-[11px]">
                  {bucket.count}
                </span>
              )}
              <div
                className="rounded-t-[3px]"
                style={{
                  height: `${height}%`,
                  background: bucket.atOrAboveThreshold
                    ? "var(--color-pulse-attention)"
                    : "var(--color-pulse)",
                  opacity: bucket.count === 0 ? 0.25 : 1,
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-[3px] border-t border-[rgba(31,78,95,0.2)] pt-2 sm:gap-1.5">
        {distribution.map((bucket) => (
          <div key={bucket.score} className="flex-1 text-center">
            <span
              className={`font-mono text-[10px] sm:text-[11px] ${
                bucket.atOrAboveThreshold ? "font-semibold text-pulse-attention" : "text-slate"
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
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-[2px]"
                style={{ background: "var(--color-pulse)" }}
              />
              Below threshold (0–{threshold - 1})
            </span>
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-[2px]"
                style={{ background: "var(--color-pulse-attention)" }}
              />
              At or above threshold ({threshold}–{maxScore})
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{ background: "var(--color-pulse)" }}
            />
            {bucketSize > 1
              ? `Scores 0–${maxScore}, grouped in ${bucketSize}s`
              : `Scores 0–${maxScore}`}
          </span>
        )}
        <span className="font-mono">n = {completed}</span>
      </figcaption>
    </figure>
  );
}
