import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import type { Dimension } from "@/lib/types";

const chipStyles: Record<Dimension, string> = {
  D: "bg-disc-d-soft text-disc-d",
  I: "bg-disc-i-soft text-disc-i",
  S: "bg-disc-s-soft text-disc-s",
  C: "bg-disc-c-soft text-disc-c",
};

interface DimensionMarkProps {
  dimension: Dimension;
  /** Show only the display letter. */
  compact?: boolean;
  className?: string;
}

/** Light DISC identifier chip — data and badges only, never brand chrome. */
export function DimensionMark({
  dimension,
  compact = false,
  className,
}: DimensionMarkProps) {
  const meta = dimensionMeta[dimension];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
        chipStyles[dimension],
        className,
      )}
    >
      <span aria-hidden className="font-mono text-[11px] font-medium">
        {meta.displayCode}
      </span>
      {compact ? null : meta.label}
    </span>
  );
}
