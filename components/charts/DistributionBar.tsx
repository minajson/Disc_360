"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSIONS } from "@/lib/types";
import type { DistributionSlice } from "@/lib/insights/board";

/**
 * Behaviour distribution as a single stacked rule with a direct legend — the
 * same idiom the team results page already uses for primary styles, promoted
 * to a reusable component so the board deck and the analytics dashboards
 * render it identically.
 *
 * Slices carry shares that total exactly 100 (largest remainder), so the bar
 * always fills its track.
 */

interface DistributionBarProps {
  slices: DistributionSlice[];
  /** Bar height. `lg` is the projector size. */
  size?: "md" | "lg";
  className?: string;
}

export function DistributionBar({
  slices,
  size = "md",
  className,
}: DistributionBarProps) {
  const reduceMotion = useReducedMotion();
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);

  if (total === 0) {
    return (
      <p className={cn("text-sm text-slate", className)}>
        No completed profiles to distribute yet.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        role="img"
        aria-label={slices
          .map(
            (slice) =>
              `${dimensionMeta[slice.dimension].label}: ${slice.count} members, ${slice.share} percent`,
          )
          .join(", ")}
        className={cn(
          "flex w-full overflow-hidden rounded-full",
          size === "lg" ? "h-5" : "h-3",
        )}
      >
        {slices
          .filter((slice) => slice.count > 0)
          .map((slice, index) => (
            <motion.div
              key={slice.dimension}
              className="h-full border-r-2 border-paper last:border-r-0"
              style={{
                background: `var(--color-disc-${slice.dimension.toLowerCase()})`,
              }}
              initial={reduceMotion ? { width: `${slice.share}%` } : { width: 0 }}
              whileInView={{ width: `${slice.share}%` }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: index * 0.07,
                ease: [0.32, 0.94, 0.6, 1],
              }}
            />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {DIMENSIONS.map((dim) => {
          const slice = slices.find((entry) => entry.dimension === dim);
          return (
            <span
              key={dim}
              className={cn(
                "flex items-center gap-1.5",
                size === "lg" ? "text-sm text-slate" : "text-xs text-slate",
              )}
            >
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: `var(--color-disc-${dim.toLowerCase()})` }}
              />
              {dimensionMeta[dim].label}
              <span className="font-mono text-faint">
                {slice?.count ?? 0} · {slice?.share ?? 0}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
