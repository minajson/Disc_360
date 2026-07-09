"use client";

import { cn } from "@/lib/utils/cn";

interface AdjectiveOptionProps {
  label: string;
  isMost: boolean;
  isLeast: boolean;
  onSelectMost: () => void;
  onSelectLeast: () => void;
}

/**
 * One behavior row with MOST / LEAST toggles. The toggle for the opposite
 * pick is disabled on the row that already holds it — the same option can
 * never be both.
 */
export function AdjectiveOption({
  label,
  isMost,
  isLeast,
  onSelectMost,
  onSelectLeast,
}: AdjectiveOptionProps) {
  return (
    <div
      className={cn(
        "glass-panel flex items-center justify-between gap-4 rounded-2xl px-5 py-4 transition-all duration-200 ease-[var(--ease-atlas)]",
        isMost && "glass-panel-raised border-accent/50",
        isLeast && "glass-panel-raised border-disc-d/40",
      )}
    >
      <span className="text-sm font-medium text-ink sm:text-base">{label}</span>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onSelectMost}
          disabled={isLeast}
          aria-pressed={isMost}
          aria-label={`Most like me: ${label}`}
          className={cn(
            "rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all duration-200",
            isMost
              ? "border-transparent accent-gradient text-midnight-950 shadow-[0_4px_16px_-4px_rgba(79,227,193,0.5)]"
              : "border-line text-ink-muted hover:border-accent/50 hover:text-ink",
            isLeast && "cursor-not-allowed opacity-30 hover:border-line hover:text-ink-muted",
          )}
        >
          Most
        </button>
        <button
          type="button"
          onClick={onSelectLeast}
          disabled={isMost}
          aria-pressed={isLeast}
          aria-label={`Least like me: ${label}`}
          className={cn(
            "rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all duration-200",
            isLeast
              ? "border-disc-d/60 bg-disc-d/15 text-disc-d-glow"
              : "border-line text-ink-muted hover:border-disc-d/50 hover:text-ink",
            isMost && "cursor-not-allowed opacity-30 hover:border-line hover:text-ink-muted",
          )}
        >
          Least
        </button>
      </div>
    </div>
  );
}
