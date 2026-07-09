"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { DimensionBarChart } from "@/components/charts/DimensionBarChart";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSIONS, type Dimension, type DiscScores } from "@/lib/types";

interface CompositionBreakdownProps {
  composition: Record<Dimension, number>;
  averages: DiscScores;
  memberCount: number;
}

/** Primary-style distribution plus team-average dimension bars. */
export function CompositionBreakdown({
  composition,
  averages,
  memberCount,
}: CompositionBreakdownProps) {
  return (
    <GlassPanel className="flex flex-col gap-8 p-6 sm:p-8">
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-base font-semibold text-ink">
          Primary-style distribution
        </h3>
        <div
          className="flex h-3 w-full overflow-hidden rounded-full"
          role="img"
          aria-label={DIMENSIONS.map(
            (dim) => `${dimensionMeta[dim].label}: ${composition[dim]} of ${memberCount}`,
          ).join(", ")}
        >
          {DIMENSIONS.map((dim) =>
            composition[dim] > 0 ? (
              <div
                key={dim}
                className="h-full border-r-2 border-midnight-900 first:rounded-l-full last:rounded-r-full last:border-r-0"
                style={{
                  width: `${(composition[dim] / memberCount) * 100}%`,
                  background: `var(--color-${dimensionMeta[dim].colorVar})`,
                }}
              />
            ) : null,
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          {DIMENSIONS.map((dim) => (
            <span key={dim} className="flex items-center gap-1.5 text-xs text-ink-secondary">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: `var(--color-${dimensionMeta[dim].colorVar})` }}
              />
              {dimensionMeta[dim].label}
              <span className="font-mono text-ink-muted">{composition[dim]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="font-display text-base font-semibold text-ink">
          Team averages
        </h3>
        <DimensionBarChart scores={averages} />
      </div>
    </GlassPanel>
  );
}
