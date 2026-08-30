import { PulseTrend } from "@/components/wellbeing/PulseTrend";
import { ChartReveal } from "@/components/wellbeing/analytics/ChartReveal";
import type { PersonalTrend, SubscaleSeries } from "@/lib/wellbeing/personal-trends";

/**
 * My Wellbeing Trends — one person's own longitudinal reading.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ONE QUESTIONNAIRE AT A TIME, WITH ITS OWN VOCABULARY.
 *
 * Everything on this panel comes from a `PersonalTrend`, which is built for a
 * single questionnaire and carries that questionnaire's scale, direction,
 * metric name and threshold wording. Switching questionnaire replaces the
 * axis, the legend and the explanatory sentence together — the reader is never
 * left with a WHO-5 line under a GHQ explanation.
 *
 * The direction sentence is not decoration and is not optional. A rising line
 * means more reported difficulty on GHQ and better reported wellbeing on
 * WHO-5, and nothing about the picture distinguishes the two. It is stated in
 * words, above the chart, every time.
 *
 * NOTHING ORGANISATIONAL APPEARS HERE.
 *
 * No cohort median, no departmental average, no percentile, no colleague. The
 * module behind this panel has no parameter in which one could be passed.
 * ─────────────────────────────────────────────────────────────────────
 */
export function PersonalTrends({ trend }: { trend: PersonalTrend }) {
  if (!trend.current) return null;

  const monthLabel = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

  return (
    <section className="pulse-card mt-8 flex flex-col gap-7 p-6 sm:p-9">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-h3 font-semibold tracking-tight text-ink">
          My {trend.questionnaireName} trends
        </h2>
        <p className="text-sm leading-relaxed text-slate">{trend.directionSentence}</p>
      </div>

      {/* ── the current reading ───────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
        <div>
          <p className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
            Most recent
          </p>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="font-display text-[clamp(2.6rem,7vw,3.6rem)] leading-none font-semibold text-ink tabular-nums">
              {trend.current.value}
            </span>
            <span className="font-mono text-sm text-slate">/ {trend.max}</span>
          </p>
          <p className="mt-1.5 text-sm text-slate">{trend.metricName}</p>
          {trend.current.raw !== null && (
            <p className="mt-0.5 font-mono text-xs text-faint">
              raw score {trend.current.raw}
            </p>
          )}
        </div>

        {trend.movement && (
          <div>
            <p className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
              Since your previous check-in
            </p>
            <p className="mt-1.5 flex items-center gap-2">
              <MovementGlyph direction={trend.movement.direction} />
              <span className="font-display text-[1.7rem] leading-none font-semibold text-ink tabular-nums">
                {trend.movement.delta > 0 ? "+" : ""}
                {trend.movement.delta}
              </span>
            </p>
            <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-slate">
              {trend.movement.sentence}
            </p>
          </div>
        )}

        <div>
          <p className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
            Check-ins so far
          </p>
          <p className="mt-1.5 font-display text-[1.7rem] leading-none font-semibold text-ink tabular-nums">
            {trend.points.length}
          </p>
        </div>
      </div>

      {/* ── the series ────────────────────────────────────────────── */}
      {trend.points.length > 1 ? (
        <PulseTrend
          max={trend.max}
          points={trend.points.map((point) => ({
            label: monthLabel(point.at),
            score: point.value,
            threshold: point.threshold,
            // Highlighting is the GHQ direction's idea of noteworthy. A
            // questionnaire that counts upward toward wellbeing has its
            // noteworthy side BELOW its cut-off, so it marks nothing here and
            // the reference line carries the meaning instead.
            atOrAbove:
              trend.direction === "higher_is_more_distress" &&
              point.threshold !== null &&
              point.value >= point.threshold,
          }))}
        />
      ) : (
        <p className="rounded-2xl bg-pulse-mist px-5 py-4 text-sm leading-relaxed text-slate">
          This is your first {trend.questionnaireName} check-in. When you complete another one,
          the two will be plotted here so you can see how they compare.
        </p>
      )}

      {trend.thresholdNote && (
        <p className="text-sm leading-relaxed text-slate">{trend.thresholdNote}</p>
      )}

      {trend.thresholdChanged && (
        <p className="rounded-2xl border border-[rgba(138,106,47,0.32)] bg-pulse-watch-soft/50 px-5 py-4 text-sm leading-relaxed text-ink">
          The threshold has not been the same across all of these check-ins. Each one is shown
          with the threshold that applied on the day it was completed, so an older result is
          still read the way it was originally.
        </p>
      )}

      {trend.subscales.length > 0 && <SubscaleTrends subscales={trend.subscales} />}
    </section>
  );
}

/**
 * The four GHQ-28 subscales, as small multiples.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY FOUR SMALL CHARTS AND NOT ONE WITH FOUR LINES.
 *
 * Four lines on one axis invite the reader to rank them — "my anxiety score is
 * higher than my somatic score" — which is not a comparison the instrument
 * supports. Each subscale is seven items and its own dimension; they are drawn
 * separately, at the same size, in published order, with no total and no
 * winner.
 *
 * AND NO THRESHOLD.
 *
 * A subscale is a profile dimension. It carries no cut-off in the published
 * instrument, and this product does not invent one — there is nothing to draw
 * a reference line at, so none is drawn.
 * ─────────────────────────────────────────────────────────────────────
 */
function SubscaleTrends({ subscales }: { subscales: SubscaleSeries[] }) {
  const plotted = subscales.filter((subscale) => subscale.points.length > 0);
  if (plotted.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 border-t border-[rgba(31,78,95,0.14)] pt-7">
      <div>
        <h3 className="font-display text-[1.05rem] font-semibold text-ink">
          The four sections, over time
        </h3>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate">
          GHQ-28 groups its questions into four sections of seven. Each is a part of the
          picture, not a separate finding, and none of them names a condition or carries a
          threshold of its own.
        </p>
      </div>

      <ChartReveal>
        <ul className="grid gap-4 sm:grid-cols-2">
          {plotted.map((subscale, index) => (
            <li
              key={subscale.key}
              className="rounded-2xl border border-hairline bg-paper p-4 sm:p-5"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-medium text-ink">{subscale.label}</span>
                <span className="font-mono text-xs text-slate tabular-nums">
                  {subscale.points.at(-1)!.value} / {subscale.max}
                </span>
              </div>
              <Sparkline
                points={subscale.points}
                max={subscale.max}
                index={index}
                label={subscale.label}
              />
            </li>
          ))}
        </ul>
      </ChartReveal>
    </div>
  );
}

/**
 * One subscale's series, small.
 *
 * A single point renders as a point rather than as nothing: "you have answered
 * this once" is information, and an empty box is not.
 */
function Sparkline({
  points,
  max,
  index,
  label,
}: {
  points: { at: string; value: number }[];
  max: number;
  index: number;
  label: string;
}) {
  const width = 260;
  const height = 64;
  const pad = 8;

  const x = (position: number) =>
    points.length === 1
      ? width / 2
      : pad + (position / (points.length - 1)) * (width - pad * 2);
  const y = (value: number) => pad + (1 - value / max) * (height - pad * 2);

  const path = points.map((point, position) => `${x(position)},${y(point.value)}`).join(" ");
  const length = points.reduce((total, point, position) => {
    if (position === 0) return total;
    return (
      total +
      Math.hypot(
        x(position) - x(position - 1),
        y(point.value) - y(points[position - 1]!.value),
      )
    );
  }, 0);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-3 h-auto w-full"
      role="img"
      aria-label={`${label}: ${points.map((point) => `${point.value} out of ${max}`).join(", then ")}.`}
    >
      <line
        x1={pad}
        x2={width - pad}
        y1={y(0)}
        y2={y(0)}
        stroke="rgba(31,78,95,0.14)"
        strokeWidth="1"
      />
      {points.length > 1 && (
        <polyline
          points={path}
          fill="none"
          stroke="var(--color-pulse-teal)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="chart-draw"
          style={
            { "--chart-length": length, "--chart-index": index } as React.CSSProperties
          }
        />
      )}
      {points.map((point, position) => (
        <circle
          key={point.at}
          cx={x(position)}
          cy={y(point.value)}
          r={position === points.length - 1 ? 4 : 2.5}
          fill={position === points.length - 1 ? "var(--color-pulse)" : "var(--color-pulse-teal)"}
        />
      ))}
    </svg>
  );
}

/**
 * An arrow for the direction of the NUMBER.
 *
 * Never coloured by whether the movement is welcome: that depends on the
 * questionnaire, and the sentence beside this glyph is what carries it. A
 * green down-arrow on GHQ and a green up-arrow on WHO-5 would be the same
 * claim made two different ways, and both of them would be this product
 * telling somebody how to feel about their own week.
 */
function MovementGlyph({ direction }: { direction: "up" | "down" | "level" }) {
  const rotation = direction === "up" ? -90 : direction === "down" ? 90 : 0;
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-pulse-teal"
      fill="none"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path
        d="M2.5 8h10M9 4.5 12.5 8 9 11.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
