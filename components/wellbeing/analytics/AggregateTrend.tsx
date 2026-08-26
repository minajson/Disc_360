import type { WellbeingTrend } from "@/lib/wellbeing/aggregate";
import { TREND_CAVEAT } from "@/data/wellbeing-content";

/**
 * Aggregate movement across waves.
 *
 * ─────────────────────────────────────────────────────────────────────
 * TWO SERIES THAT MEAN DIFFERENT THINGS, ON THEIR OWN SCALES.
 *
 * The median runs on the instrument's own range and the threshold share runs
 * on 0–100%. Overlaying them on one axis is the standard dashboard mistake:
 * they are not the same quantity, so a crossing point would mean nothing at
 * all. They share a plot and never an axis.
 *
 * The scale, the label and whether a threshold series exists all come from the
 * instrument. This chart was previously fixed to GHQ-12's 0–12 range and
 * captioned "Median GHQ-12" whatever it was drawing, which plotted a 0–100
 * WHO-5 score against a 0–12 axis — every point pinned to the top of the
 * chart, under another instrument's name.
 *
 * THE THRESHOLD SERIES IS CONDITIONAL, AND THAT IS THE POINT.
 *
 * It is drawn ONLY when every wave used the same cut-off. A policy change
 * makes the series incomparable, and a continuous line across it would report
 * a movement in people that was actually a movement in policy. Historical
 * results are never rescored under a new threshold to make the line join up —
 * each wave keeps the threshold that actually applied to it.
 * ─────────────────────────────────────────────────────────────────────
 */
export function AggregateTrend({
  trend,
  scoreLabel,
  scoreMax,
  hasThreshold,
  showParticipation = false,
}: {
  trend: WellbeingTrend;
  scoreLabel: string;
  scoreMax: number;
  /** False for instruments carrying no governed cut-off. */
  hasThreshold: boolean;
  /** Draws responses per wave beneath the plot as a small bar row. */
  showParticipation?: boolean;
}) {
  const points = trend.points;
  if (points.length === 0) return null;

  const width = 760;
  const height = 240;
  const padX = 52;
  const padTop = 22;
  const padBottom = 44;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padTop - padBottom;

  const x = (index: number) =>
    points.length === 1 ? padX + plotWidth / 2 : padX + (index / (points.length - 1)) * plotWidth;
  const yScore = (value: number) => padTop + plotHeight - (value / scoreMax) * plotHeight;
  const yShare = (value: number) => padTop + plotHeight - (value / 100) * plotHeight;

  // Four gridlines across whatever range the instrument actually uses.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round(scoreMax * fraction));

  const scoreLine = points
    .map((point, index) => `${x(index)},${yScore(point.aggregate.median)}`)
    .join(" ");
  const shareLine = points
    .map((point, index) => `${x(index)},${yShare(point.aggregate.atOrAboveThresholdShare)}`)
    .join(" ");

  const drawShare = hasThreshold && trend.thresholdConsistent;
  const maxResponses = Math.max(...points.map((point) => point.aggregate.completed), 1);

  return (
    <figure className="flex flex-col gap-4">
      {/* Wide plots scroll inside their own box; the page never scrolls. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[520px]"
          role="img"
          aria-label={`Median ${scoreLabel} by wave: ${points
            .map(
              (point) =>
                `${point.label}, median ${point.aggregate.median} from ${point.aggregate.completed} responses`,
            )
            .join("; ")}.`}
        >
          {ticks.map((score) => (
            <g key={score}>
              <line
                x1={padX}
                x2={width - padX}
                y1={yScore(score)}
                y2={yScore(score)}
                stroke="rgba(31,78,95,0.12)"
              />
              <text
                x={padX - 10}
                y={yScore(score) + 4}
                textAnchor="end"
                fontSize="11"
                className="fill-slate font-mono"
              >
                {score}
              </text>
            </g>
          ))}

          {drawShare &&
            [0, 25, 50, 75, 100].map((share) => (
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
            points={scoreLine}
            fill="none"
            stroke="var(--color-pulse)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {drawShare && (
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
                cy={yScore(point.aggregate.median)}
                r="5.5"
                fill="var(--color-paper)"
                stroke="var(--color-pulse)"
                strokeWidth="2.5"
              />
              <text
                x={x(index)}
                y={yScore(point.aggregate.median) - 13}
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
      </div>

      {/*
        Responses per wave, drawn separately rather than as a third line.
        How many people answered is not a measure of wellbeing, and putting it
        on the same plot invites reading a participation dip as a change in the
        workforce's experience — which is exactly the confusion this view has
        to prevent.
      */}
      {showParticipation && (
        <div className="flex flex-col gap-2 border-t border-hairline pt-4">
          <p className="font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
            Responses received per wave
          </p>
          <ul className="flex items-end gap-2">
            {points.map((point) => (
              <li key={point.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="font-mono text-[11px] text-slate tabular-nums">
                  {point.aggregate.completed}
                </span>
                <span
                  className="w-full rounded-t-sm bg-pulse-soft"
                  // Zero-anchored, so the bars are proportional to the counts
                  // rather than to the range between them — a range-anchored
                  // bar row turns a 10% difference into a full-height one.
                  style={{
                    height: `${Math.max(4, (point.aggregate.completed / maxResponses) * 72)}px`,
                  }}
                />
                <span className="truncate font-mono text-[10px] text-faint">{point.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <figcaption className="flex flex-col gap-2 text-xs text-slate">
        <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-0.5 w-5 rounded"
              style={{ background: "var(--color-pulse)" }}
            />
            Median {scoreLabel} (left axis)
          </span>
          {drawShare && (
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

        {hasThreshold && !trend.thresholdConsistent && (
          <span className="text-pulse-attention">
            The screening threshold changed across these waves ({trend.thresholds.join(", ")}), so
            the &ldquo;% at or above threshold&rdquo; series is not comparable and is not drawn.
            Historical waves keep the threshold that applied to them and are never rescored. The
            median remains comparable.
          </span>
        )}

        <span>{TREND_CAVEAT}</span>
      </figcaption>
    </figure>
  );
}
