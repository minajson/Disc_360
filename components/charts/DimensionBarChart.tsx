"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSION_KEY, DIMENSIONS, type DiscScores } from "@/lib/types";

interface DimensionBarChartProps {
  scores: DiscScores;
  className?: string;
}

/** Horizontal intensity bars, one per dimension, direct-labeled. */
export function DimensionBarChart({ scores, className }: DimensionBarChartProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {DIMENSIONS.map((dim, index) => {
        const meta = dimensionMeta[dim];
        const value = scores[DIMENSION_KEY[dim]];
        return (
          <div key={dim} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-slate sm:w-24 sm:text-sm">
              {meta.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-[4px] bg-ink/8">
              <motion.div
                className="h-full rounded-[4px]"
                style={{ background: `var(--color-${meta.colorVar})` }}
                initial={reduceMotion ? { width: `${value}%` } : { width: 0 }}
                whileInView={{ width: `${value}%` }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.7,
                  delay: index * 0.08,
                  ease: [0.32, 0.94, 0.6, 1],
                }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-xs text-ink">
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
