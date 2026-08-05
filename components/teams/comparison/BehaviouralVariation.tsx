"use client";

import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import {
  VARIATION_LABEL,
  variationBand,
  variationTakeaway,
  type DimensionDivergence,
  type VariationBand,
} from "@/lib/insights/comparison";

/**
 * Behavioural variation — how far apart this set sits on each style.
 *
 * The panel this replaces plotted an offset bar and printed a range beside it,
 * which asked a room to decode a chart before it could ask a question. This
 * says the same measurement in the order a boardroom actually reads it: the
 * style, how different the set is in one word, the span it covers, and one
 * line the facilitator can say out loud.
 *
 * Every figure comes from `dimensionDivergence`, unchanged. The band and the
 * takeaway are pure functions over it, unit-tested, and add a reading rather
 * than a number.
 */

const BAND_TONE: Record<VariationBand, string> = {
  low: "text-slate",
  moderate: "text-teal",
  high: "text-disc-i",
  "very-high": "text-disc-d",
};

/** Widest span the bar is drawn against, so the four rows stay comparable. */
const SCALE = 100;

export function BehaviouralVariation({
  divergences,
  className,
}: {
  divergences: DimensionDivergence[];
  className?: string;
}) {
  if (divergences.length === 0) return null;
  const takeaway = variationTakeaway(divergences);

  return (
    <section
      aria-label="Behavioural variation"
      className={cn("paper-card flex flex-col gap-(--cmp-gap) p-(--cmp-pad)", className)}
    >
      <div className="flex flex-col gap-2">
        <h3 className="cmp-eyebrow font-mono uppercase tracking-[0.2em] text-teal">
          Behavioural variation
        </h3>
        <p className="cmp-mono font-mono uppercase tracking-[0.14em] text-faint">
          Lowest to highest score in this set
        </p>
      </div>

      <ul className="flex flex-col gap-(--cmp-gap)">
        {divergences.map((entry) => {
          const band = variationBand(entry.range);
          const tint = `var(--color-disc-${entry.dimension.toLowerCase()})`;
          return (
            <li key={entry.dimension} className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="cmp-label flex items-center gap-2.5 font-medium text-ink">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: tint }}
                  />
                  {dimensionMeta[entry.dimension].label}
                </span>
                <span
                  className={cn(
                    "cmp-mono font-mono uppercase tracking-[0.14em]",
                    BAND_TONE[band],
                  )}
                >
                  {VARIATION_LABEL[band]} variation
                </span>
              </div>

              {/*
               * The bar spans lowest to highest on a fixed 0–100 scale, so the
               * four rows are read against each other rather than each against
               * itself — which is the comparison a facilitator is making.
               */}
              <div
                className="relative h-3 overflow-hidden rounded-full bg-ink/8"
                role="img"
                aria-label={`${dimensionMeta[entry.dimension].label}: lowest ${entry.low}, highest ${entry.high}, spread ${entry.range} points`}
              >
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    left: `${entry.low}%`,
                    width: `${Math.max(1.5, (entry.range / SCALE) * 100)}%`,
                    background: tint,
                  }}
                />
              </div>

              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="cmp-mono font-mono tabular-nums text-faint">
                  Lowest {entry.low} · Highest {entry.high}
                </span>
                <span className="cmp-mono font-mono tabular-nums text-slate">
                  {entry.range} point spread
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {takeaway ? (
        <p className="cmp-body rule-t pt-(--cmp-gap) text-slate">{takeaway}</p>
      ) : null}
    </section>
  );
}
