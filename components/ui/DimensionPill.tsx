import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import type { Dimension } from "@/lib/types";

const pillStyles: Record<Dimension, string> = {
  D: "border-disc-d/35 bg-disc-d/10 text-disc-d-glow",
  I: "border-disc-i/35 bg-disc-i/10 text-disc-i-glow",
  S: "border-disc-s/35 bg-disc-s/10 text-disc-s-glow",
  C: "border-disc-c/35 bg-disc-c/10 text-disc-c-glow",
};

const dotStyles: Record<Dimension, string> = {
  D: "bg-disc-d",
  I: "bg-disc-i",
  S: "bg-disc-s",
  C: "bg-disc-c",
};

interface DimensionPillProps {
  dimension: Dimension;
  /** Show only the single-letter code. */
  compact?: boolean;
  className?: string;
}

export function DimensionPill({
  dimension,
  compact = false,
  className,
}: DimensionPillProps) {
  const meta = dimensionMeta[dimension];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-wide",
        pillStyles[dimension],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", dotStyles[dimension])}
      />
      {compact ? meta.displayCode : meta.label}
    </span>
  );
}
