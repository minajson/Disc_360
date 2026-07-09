"use client";

import { cn } from "@/lib/utils/cn";

interface GlowPulseProps {
  className?: string;
  /** CSS color for the radial glow. */
  color?: string;
  /** Diameter in px. */
  size?: number;
}

/** Soft breathing radial glow — ambient dimensional light. */
export function GlowPulse({
  className,
  color = "var(--color-accent)",
  size = 480,
}: GlowPulseProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full blur-3xl animate-pulse-glow",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, color-mix(in oklch, ${color} 22%, transparent) 0%, transparent 70%)`,
      }}
    />
  );
}
