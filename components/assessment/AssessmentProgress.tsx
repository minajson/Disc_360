"use client";

import { cn } from "@/lib/utils/cn";

interface AssessmentProgressProps {
  current: number;
  total: number;
  answeredCount: number;
}

/** Segmented luminous progress bar — one segment per question. */
export function AssessmentProgress({
  current,
  total,
  answeredCount,
}: AssessmentProgressProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between font-mono text-xs text-ink-muted">
        <span>
          Question <span className="text-ink">{current + 1}</span> / {total}
        </span>
        <span>{answeredCount} answered</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={answeredCount}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Assessment progress"
        className="flex gap-1"
      >
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-450 ease-[var(--ease-atlas)]",
              index < answeredCount
                ? "accent-gradient shadow-[0_0_8px_rgba(79,227,193,0.4)]"
                : index === current
                  ? "bg-white/25"
                  : "bg-white/8",
            )}
          />
        ))}
      </div>
    </div>
  );
}
