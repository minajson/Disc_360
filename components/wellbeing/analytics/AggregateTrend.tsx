import type { WellbeingTrend } from "@/lib/wellbeing/aggregate";
import { WELLBEING_MAX_SCORE } from "@/lib/scoring/wellbeing";
import { TREND_CAVEAT } from "@/data/wellbeing-content";

/**
 * Aggregate movement across waves.
 *
 * Two series that mean different things, drawn on their own scales: median
 * GHQ-12 (0–12) and the share at or above the threshold (0–100%). Overlaying
 * them on one axis would be the standard dashboard mistake — they are not the
 * same quantity and a crossing point would mean nothing.
 *
 * The "% at or above threshold" series is drawn ONLY when every wave used the
 * same cut-off. A policy change makes that series incomparable, and a
 * continuous line across it would report a movement in people that was
 * actually a movement in policy.
 */
export function AggregateTrend({ trend }: { trend: WellbeingTrend }) {
  const points = trend.points;
  if (points.length === 0) return null;

  const width = 760;
  const height = 240;
  const padX = 46;
  const padTop = 22;
  const padBottom = 44;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padTop - padBottom;

  const x = (index: number) =>
    points.length === 1 ? padX + plotWidth / 2 : padX + (index / (points.length - 1)) * plotWidth;
  const yMedian = (value: number) =>
    padTop + plotHeight - (value / WELLBEING_MAX_SCORE) * plotHeight;
  const yShare = (value: number) => padTop + plotHeight - (value / 100) * plotHeight;

  const medianLine = points.map((point, index) => `${x(index)},${yMedian(point.aggregate.median)}`).join(" ");
  const shareLine = points
    .map((point, index) => `${x(index)},${yShare(point.aggregate.atOrAboveThresholdShare)}`)
    .join(" ");

  return (
    <figure className="flex flex-col gap-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Median GHQ-12 by wave: ${points
          .map((point) => `${point.label}, median ${point.aggregate.median}, ${point.aggregate.atOrAboveThresholdShare}% at or above threshold`)
          .join("; ")}.`}
      >
        {[0, 3, 6, 9, 12].map((score) => (
          <g key={score}>
            <line
              x1={padX}
              x2={width - padX}
              y1={yMedian(score)}
              y2={yMedian(score)}
              stroke="rgba(31,78,95,0.12)"
            />
            <text
              x={padX - 10}
              y={yMedian(score) + 4}
              textAnchor="end"
              fontSize="11"
              className="fill-slate font-mono"
            >
              {score}
            </text>
          </g>
        ))}
        {[0, 25, 50, 75, 100].map((share) => (
          <text
            key={share}
            x={width - padX + 10}
            y={yShare(share) + 4}
            textAnchor="start"
            fontSize="11"
            className="font-mono"
            fill="var(--color-pulse-attention)"
          >
            {share}%
          </text>
        ))}

        <polyline
          points={medianLine}
          fill="none"
          stroke="var(--color-pulse)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {trend.thresholdConsistent && (
          <polyline
            points={shareLine}
            fill="none"
            stroke="var(--color-pulse-attention)"
            strokeWidth="2"
            strokeDasharray="6 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map((point, index) => (
          <g key={point.key}>
            <circle
              cx={x(index)}
              cy={yMedian(point.aggregate.median)}
              r="5.5"
              fill="var(--color-paper)"
              stroke="var(--color-pulse)"
              strokeWidth="2.5"
            />
            <text
              x={x(index)}
              y={yMedian(point.aggregate.median) - 13}
              textAnchor="middle"
              fontSize="12"
              className="font-mono"
              fill="var(--color-pulse-deep)"
            >
              {point.aggregate.median}
            </text>
            <text
              x={x(index)}
              y={height - 16}
              textAnchor="middle"
              fontSize="11"
              className="fill-slate"
            >
              {point.label}
            </text>
            <text
              x={x(index)}
              y={height - 3}
              textAnchor="middle"
              fontSize="10"
              className="fill-faint font-mono"
            >
              n={point.aggregate.completed}
            </text>
          </g>
        ))}
      </svg>

      <figcaption className="flex flex-col gap-2 text-xs text-slate">
        <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-0.5 w-5 rounded"
              style={{ background: "var(--color-pulse)" }}
            />
            Median GHQ-12 (left axis)
          </span>
          {trend.thresholdConsistent && (
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-0.5 w-5 rounded"
                style={{
                  background:
                    "repeating-linear-gradient(90deg, var(--color-pulse-attention) 0 4px, transparent 4px 7px)",
                }}
              />
              % at or above threshold (right axis)
            </span>
          )}
        </span>

        {!trend.thresholdConsistent && (
          <span className="text-pulse-attention">
            The screening threshold changed across these waves (
            {trend.thresholds.join(", ")}), so the &ldquo;% at or above threshold&rdquo; series is
            not comparable and is not drawn. The median remains comparable.
          </span>
        )}

        <span>{TREND_CAVEAT}</span>
      </figcaption>
    </figure>
  );
}
