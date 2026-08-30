import type { DimensionTrendView } from "@/lib/wellbeing/analytics";
import type { ScoreDirection } from "@/data/wellbeing-instruments";
import { ChartReveal } from "./ChartReveal";

/**
 * Each dimension's median, wave by wave — as small multiples.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY SEPARATE PANELS AND NOT ONE CHART WITH SIX LINES.
 *
 * Six lines on one axis invite the reader to rank them — "Recovery & Demand is
 * below Connection & Safety" — which is a comparison across dimensions the
 * questionnaire does not support. Drawn separately, at the same size, in
 * published order, each panel answers the only question the data supports:
 * has THIS dimension moved?
 *
 * WHAT A GAP MEANS.
 *
 * A wave below the confidentiality floor contributes no point to any panel —
 * the dimensions come from the same responses as the total, so a wave too
 * small to publish a median is too small to publish six of them. The panels
 * therefore all have the same waves, and a missing wave is missing everywhere,
 * which is what stops one panel's gap being filled in from another's.
 *
 * NO THRESHOLD LINE. A dimension carries none in any of these questionnaires,
 * and drawing one would be this product inventing a band.
 * ─────────────────────────────────────────────────────────────────────
 */
export function DimensionTrend({
  view,
  direction,
}: {
  view: DimensionTrendView;
  direction: ScoreDirection;
}) {
  // One point is not a direction.
  if (view.waves.length < 2 || view.series.length === 0) return null;

  const distress = direction === "higher_is_more_distress";
  const stroke = distress ? "var(--color-pulse-watch)" : "var(--color-pulse)";

  return (
    <div className="flex flex-col gap-5">
      <ChartReveal>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {view.series.map((series, index) => (
            <li
              key={series.key}
              className="rounded-2xl border border-hairline bg-paper p-4 sm:p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-ink">{series.label}</span>
                <span className="font-mono text-xs text-slate tabular-nums">
                  {latest(series.medians) ?? "—"}
                  <span className="text-faint"> / {view.max}</span>
                </span>
              </div>
              <Spark
                medians={series.medians}
                waves={view.waves.map((wave) => wave.label)}
                max={view.max}
                stroke={stroke}
                index={index}
                label={series.label}
              />
            </li>
          ))}
        </ul>
      </ChartReveal>

      <p className="font-mono text-[11px] leading-relaxed text-faint">
        {view.waves.map((wave) => wave.label).join(" → ")}
        {view.suppressedWaves > 0 && (
          <>
            {" · "}
            {view.suppressedWaves} wave{view.suppressedWaves === 1 ? "" : "s"} not plotted — too
            few responses to publish
          </>
        )}
      </p>
    </div>
  );
}

function latest(medians: (number | null)[]): number | null {
  for (let index = medians.length - 1; index >= 0; index -= 1) {
    const value = medians[index];
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

/**
 * One dimension's line.
 *
 * A null median leaves a genuine gap: the line is broken rather than
 * interpolated across it, because a drawn segment over a withheld wave is a
 * figure the product does not have.
 */
function Spark({
  medians,
  waves,
  max,
  stroke,
  index,
  label,
}: {
  medians: (number | null)[];
  waves: string[];
  max: number;
  stroke: string;
  index: number;
  label: string;
}) {
  const width = 260;
  const height = 68;
  const pad = 10;

  const x = (position: number) =>
    medians.length === 1
      ? width / 2
      : pad + (position / (medians.length - 1)) * (width - pad * 2);
  const y = (value: number) => pad + (1 - value / max) * (height - pad * 2);

  // Contiguous runs, so a withheld wave breaks the line instead of being
  // drawn through.
  const runs: { position: number; value: number }[][] = [];
  let run: { position: number; value: number }[] = [];
  medians.forEach((value, position) => {
    if (value === null || value === undefined) {
      if (run.length > 0) runs.push(run);
      run = [];
      return;
    }
    run.push({ position, value });
  });
  if (run.length > 0) runs.push(run);

  const length = runs.reduce(
    (total, segment) =>
      total +
      segment.reduce((sum, point, position) => {
        if (position === 0) return sum;
        const before = segment[position - 1]!;
        return sum + Math.hypot(x(point.position) - x(before.position), y(point.value) - y(before.value));
      }, 0),
    0,
  );

  const described = medians
    .map((value, position) =>
      value === null || value === undefined
        ? `${waves[position]}, withheld`
        : `${waves[position]}, ${value} of ${max}`,
    )
    .join("; ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-3 h-auto w-full"
      role="img"
      aria-label={`${label}: ${described}.`}
    >
      <line
        x1={pad}
        x2={width - pad}
        y1={y(0)}
        y2={y(0)}
        stroke="rgba(31,78,95,0.14)"
        strokeWidth="1"
      />
      {runs.map((segment, position) => (
        <polyline
          key={position}
          points={segment.map((point) => `${x(point.position)},${y(point.value)}`).join(" ")}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="chart-draw"
          style={{ "--chart-length": length, "--chart-index": index } as React.CSSProperties}
        />
      ))}
      {runs.flat().map((point) => (
        <circle
          key={point.position}
          cx={x(point.position)}
          cy={y(point.value)}
          r={point.position === medians.length - 1 ? 4 : 2.5}
          fill={stroke}
        />
      ))}
    </svg>
  );
}
