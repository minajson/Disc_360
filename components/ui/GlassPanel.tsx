import { cn } from "@/lib/utils/cn";
import type { Dimension } from "@/lib/types";

const glowClass: Record<Dimension, string> = {
  D: "glow-d",
  I: "glow-i",
  S: "glow-s",
  C: "glow-c",
};

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional per-dimension luminous halo. */
  glow?: Dimension | "accent";
  /** Raised emphasis variant. */
  raised?: boolean;
}

export function GlassPanel({
  glow,
  raised = false,
  className,
  children,
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        "glass-panel",
        raised && "glass-panel-raised",
        glow === "accent" ? "glow-accent" : glow && glowClass[glow],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
