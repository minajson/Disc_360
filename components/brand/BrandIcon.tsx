import { cn } from "@/lib/utils/cn";

export type BrandTone = "default" | "light" | "dark" | "mono";

const toneColors: Record<BrandTone, { fill: string; stroke: string; dot: string }> = {
  default: { fill: "var(--color-sage)", stroke: "var(--color-botanical)", dot: "var(--color-botanical)" },
  light: { fill: "rgba(255,255,255,0.25)", stroke: "#FCFBF8", dot: "#FCFBF8" },
  dark: { fill: "var(--color-sage)", stroke: "#0E3529", dot: "#0E3529" },
  mono: { fill: "none", stroke: "currentColor", dot: "currentColor" },
};

/**
 * TEMPORARY brand icon (registry: MEDIA-BRAND-ICON-01). The final DISC360
 * identity replaces the SVG below — every icon in the app renders through
 * this component, so the swap happens once.
 */
export function BrandIcon({
  tone = "default",
  className,
}: {
  tone?: BrandTone;
  className?: string;
}) {
  const colors = toneColors[tone];
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <polygon
        points="12,3 21,12 12,21 3,12"
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.4" fill={colors.dot} />
    </svg>
  );
}
