import { WELLBEING_MAX_SCORE } from "@/lib/scoring/wellbeing";
import { ChartReveal } from "./analytics/ChartReveal";

export interface TrendPoint {
  label: string;
  score: number;
  /** Null for instruments that carry no threshold. */
  threshold: number | null;
  atOrAbove: boolean;
}

/**
 * A participant's own scores over time.
 *
 * One line, their own numbers, and the configured threshold as a reference
 * rule. There is deliberately no organisational average, no cohort band and no
 * peer comparison: a private history is the person's own record, and putting a
 * workforce median beside it would invite exactly the comparison the product
 * should not encourage.
 *
 * Every point is also rendered as text beneath the chart, so the series is
 * readable without seeing the line at all.
 *
 * The line draws itself once, when the chart first comes into view. That is an
 * enhancement of a chart that is already complete: the figures are in the SVG,
 * the accessible description carries the whole series, and under
 * `prefers-reduced-motion` — or if the observer never fires — the finished
 * state is what renders. See `ChartReveal` and the chart-motion block in
 * app/globals.css.
 */
export function PulseTrend({
  points,
  max = WELLBEING_MAX_SCORE,
}: {
  points: TrendPoint[];
  /** The instrument's own maximum, so the axis is never guessed. */
  max?: number;
}) {
  if (points.length < 2) return null;

  const width = 720;
  const height = 260;
  const padX = 44;
  const padTop = 24;
  const padBottom = 46;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padTop - padBottom;

  const x = (index: number) =>
    points.length === 1 ? padX + plotWidth / 2 : padX + (index / (points.length - 1)) * plotWidth;
  const y = (score: number) => padTop + plotHeight - (score / max) * plotHeight;

  const line = points.map((point, index) => `${x(index)},${y(point.score)}`).join(" ");
  // Thresholds can differ across pulses if policy changed; draw the most
  // recent one and let the history table carry the per-pulse value.
  const threshold = points[points.length - 1]!.threshold;
  const gridScores = [0, Math.round(max / 4), Math.round(max / 2), Math.round((max * 3) / 4), max];

  // The dash animation needs a length to count down from. Measuring the real
  // path would need a DOM; the polyline's own segment lengths are known here,
  // and an over-estimate simply starts the draw slightly earlier.
  const pathLength = points.reduce((total, point, index) => {
    if (index === 0) return total;
    const previous = points[index - 1]!;
    const dx = x(index) - x(index - 1);
    const dy = y(point.score) - y(previous.score);
    return total + Math.hypot(dx, dy);
  }, 0);

  return (
    <ChartReveal>
      <figure className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Your Wellbeing Pulse scores over time: ${points
          .map((point) => `${point.label}, ${point.score} out of ${max}`)
          .join("; ")}.`}
      >
        {gridScores.map((score) => (
          <g key={score}>
            <line
              x1={padX}
              x2={width - padX}
              y1={y(score)}
              y2={y(score)}
              stroke="rgba(31,78,95,0.12)"
              strokeWidth="1"
            />
            <text
              x={padX - 10}
              y={y(score) + 4}
              textAnchor="end"
              className="fill-slate font-mono"
              fontSize="11"
            >
              {score}
            </text>
          </g>
        ))}

        {/* Threshold reference — dashed, labelled, never a red zone. Drawn
            only for instruments that have one. */}
        {threshold !== null && (<><line
          x1={padX}
          x2={width - padX}
          y1={y(threshold)}
          y2={y(threshold)}
          stroke="var(--color-pulse-attention)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
        <text
          x={width - padX}
          y={y(threshold) - 8}
          textAnchor="end"
          fontSize="11"
          className="font-mono"
          fill="var(--color-pulse-attention)"
        >
          Threshold {threshold}
        </text></>)}

        <polyline
          points={line}
          fill="none"
          stroke="var(--color-pulse)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="chart-draw"
          style={{ "--chart-length": pathLength } as React.CSSProperties}
        />

        {points.map((point, index) => (
          <g
            key={`${point.label}-${index}`}
            className="chart-appear"
            style={{ "--chart-index": index } as React.CSSProperties}
          >
            <circle
              cx={x(index)}
              cy={y(point.score)}
              r="6"
              fill="var(--color-paper)"
              stroke={point.atOrAbove ? "var(--color-pulse-attention)" : "var(--color-pulse)"}
              strokeWidth="2.5"
            />
            <text
              x={x(index)}
              y={y(point.score) - 15}
              textAnchor="middle"
              fontSize="12"
              className="font-mono"
              fill="var(--color-pulse-deep)"
            >
              {point.score}
            </text>
            <text
              x={x(index)}
              y={height - 18}
              textAnchor="middle"
              fontSize="11"
              className="fill-slate"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      </figure>
    </ChartReveal>
  );
}
