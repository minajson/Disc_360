import type { DimensionAggregate } from "@/lib/wellbeing/analytics";

/**
 * The six-dimension aggregate profile.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY A RADAR HERE, AND ONLY HERE.
 *
 * A radar is the wrong chart most of the time: it makes ordered categories
 * look circular, exaggerates small differences near the centre, and invites
 * the reader to judge "area" as if area meant something. DISC360 Wellbeing is
 * the one case on this platform where it earns its place — six dimensions of
 * equal standing, on one shared 0–100 scale, with no rank order between them
 * and no intended reading direction. The shape IS the finding: a workforce
 * strong on Connection and low on Recovery has a recognisable silhouette that
 * six bars make you reconstruct in your head.
 *
 * It is not used for GHQ-12 (which has no subscales at all), for WHO-5 (five
 * items and one score), or for GHQ-28 (whose four subscales run on a distress
 * direction and a 0–7 range, where a large shape would read as a good result).
 * Those get the form their own structure supports. The radar is here because
 * this instrument's data is shaped like one — not because DISC uses one.
 * ─────────────────────────────────────────────────────────────────────
 */

const SIZE = 320;
const CENTRE = SIZE / 2;
const RADIUS = 108;
const RINGS = [25, 50, 75, 100];

function point(index: number, count: number, value: number, max: number) {
  // Start at twelve o'clock and run clockwise, which is how a reader's eye
  // enters a circular figure.
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const distance = (Math.max(0, Math.min(max, value)) / max) * RADIUS;
  return {
    x: CENTRE + Math.cos(angle) * distance,
    y: CENTRE + Math.sin(angle) * distance,
    angle,
  };
}

export function DimensionRadar({
  dimensions,
  max = 100,
  scoreLabel = "index",
  comparison,
  comparisonLabel,
}: {
  dimensions: DimensionAggregate[];
  max?: number;
  scoreLabel?: string;
  /** An earlier wave, drawn behind as a hairline. Optional. */
  comparison?: { key: string; median: number }[];
  comparisonLabel?: string;
}) {
  if (dimensions.length < 3) return null;

  const count = dimensions.length;
  const path = (values: number[]) =>
    values
      .map((value, index) => {
        const p = point(index, count, value, max);
        return `${index === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  const current = path(dimensions.map((dimension) => dimension.median));
  const previous =
    comparison && comparison.length === count
      ? path(
          dimensions.map(
            (dimension) => comparison.find((entry) => entry.key === dimension.key)?.median ?? 0,
          ),
        )
      : null;

  return (
    <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center">
      {/* The figure scrolls inside its own box rather than forcing the page to. */}
      <div className="w-full max-w-[360px] shrink-0 self-center">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={`Aggregate profile across ${count} dimensions, each on a 0 to ${max} ${scoreLabel}`}
        >
          {RINGS.map((ring) => (
            <polygon
              key={ring}
              points={dimensions
                .map((_, index) => {
                  const p = point(index, count, ring, 100);
                  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                })
                .join(" ")}
              fill="none"
              stroke="rgba(31,78,95,0.14)"
              strokeWidth="1"
            />
          ))}

          {dimensions.map((dimension, index) => {
            const outer = point(index, count, 100, 100);
            return (
              <line
                key={dimension.key}
                x1={CENTRE}
                y1={CENTRE}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(31,78,95,0.14)"
                strokeWidth="1"
              />
            );
          })}

          {previous && (
            <path
              d={previous}
              fill="none"
              stroke="var(--color-pulse-teal)"
              strokeOpacity="0.55"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          )}

          <path
            d={current}
            fill="var(--color-pulse)"
            fillOpacity="0.16"
            stroke="var(--color-pulse)"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {dimensions.map((dimension, index) => {
            const p = point(index, count, dimension.median, max);
            return (
              <circle
                key={dimension.key}
                cx={p.x}
                cy={p.y}
                r="3.5"
                fill="var(--color-pulse)"
              />
            );
          })}
        </svg>
      </div>

      {/*
        The figures are printed beside the shape, always. A radar cannot be
        read to a number, and a facilitator has to be able to quote one.
      */}
      <ol className="flex w-full min-w-0 flex-col divide-y divide-hairline">
        {dimensions.map((dimension) => {
          const before = comparison?.find((entry) => entry.key === dimension.key)?.median ?? null;
          const delta = before === null ? null : dimension.median - before;
          return (
            <li
              key={dimension.key}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5"
            >
              <span className="text-sm font-medium text-ink">{dimension.label}</span>
              <span className="ml-auto flex items-baseline gap-3 font-mono text-xs text-slate tabular-nums">
                {delta !== null && (
                  <span className="text-faint">
                    {delta === 0 ? "no change" : `${delta > 0 ? "+" : ""}${delta}`}
                  </span>
                )}
                <strong className="font-display text-base font-semibold text-ink">
                  {dimension.median}
                </strong>
              </span>
            </li>
          );
        })}
        {comparisonLabel && previous && (
          <li className="pt-3 font-mono text-[11px] text-faint">
            Dashed outline: {comparisonLabel}
          </li>
        )}
      </ol>
    </div>
  );
}
