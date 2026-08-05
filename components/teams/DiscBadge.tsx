import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import type { Dimension } from "@/lib/types";

/**
 * A person's DISC style as one letter, beside their name.
 *
 * On the pairings screens a facilitator has to hold four names and two style
 * pairings in their head at once. The badge does that work for them: the
 * reason a pairing is complementary or high-friction is visible in the colours
 * before the sentence underneath is read.
 *
 * The letter is always the display code, so Analytical reads "A" — the
 * internal "C" never reaches a screen. Colours are the existing DISC
 * identifier tokens; nothing new is introduced.
 */

interface DiscBadgeProps {
  dimension: Dimension;
  /** Larger on a projected slide. */
  presentation?: boolean;
  className?: string;
}

export function DiscBadge({ dimension, presentation = false, className }: DiscBadgeProps) {
  const key = dimension.toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-mono font-semibold leading-none tabular-nums",
        presentation ? "pres-label size-[1.9em] px-0" : "size-7 text-xs",
        className,
      )}
      style={{
        color: `var(--color-disc-${key})`,
        background: `var(--color-disc-${key}-soft)`,
      }}
      // The colour alone is decorative; the accessible name carries the style.
      title={dimensionMeta[dimension].label}
    >
      <span aria-hidden>{dimensionMeta[dimension].displayCode}</span>
      <span className="sr-only">{dimensionMeta[dimension].label}</span>
    </span>
  );
}
