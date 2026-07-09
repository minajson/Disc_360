import { cn } from "@/lib/utils/cn";
import type { ArchetypeCode } from "@/lib/types";

interface ArchetypeBadgeProps {
  code: ArchetypeCode;
  className?: string;
}

/** Monogram seal for an archetype code. */
export function ArchetypeBadge({ code, className }: ArchetypeBadgeProps) {
  return (
    <span
      className={cn(
        "relative inline-flex size-16 items-center justify-center rounded-2xl glass-panel glow-accent",
        className,
      )}
    >
      <span aria-hidden className="absolute inset-0 rounded-2xl accent-gradient opacity-10" />
      <span className="accent-gradient-text font-mono text-xl font-medium tracking-tight">
        {code}
      </span>
    </span>
  );
}
