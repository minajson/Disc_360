"use client";

import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import type { Dimension } from "@/lib/types";

interface OrbitNode {
  dimension: Dimension;
  angle: number;
  /** Orbit radius as % of container — outer or inner ring. */
  ring: "outer" | "inner";
}

const NODES: OrbitNode[] = [
  { dimension: "D", angle: 0, ring: "outer" },
  { dimension: "I", angle: 90, ring: "inner" },
  { dimension: "S", angle: 180, ring: "outer" },
  { dimension: "C", angle: 270, ring: "inner" },
];

const nodeColor: Record<Dimension, { text: string; border: string; glow: string }> = {
  D: { text: "text-disc-d-glow", border: "border-disc-d/40", glow: "glow-d" },
  I: { text: "text-disc-i-glow", border: "border-disc-i/40", glow: "glow-i" },
  S: { text: "text-disc-s-glow", border: "border-disc-s/40", glow: "glow-s" },
  C: { text: "text-disc-c-glow", border: "border-disc-c/40", glow: "glow-c" },
};

/**
 * Animated dimensional DISC orbit for the hero.
 * Motion-ready swap point: replace internals with a WebGL scene later —
 * the outer contract (a self-sizing decorative field) stays stable.
 */
export function CognitiveOrbit({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("relative aspect-square w-full select-none", className)}
    >
      {/* concentric guide rings */}
      <div className="absolute inset-0 rounded-full border border-line" />
      <div className="absolute inset-[14%] rounded-full border border-line" />
      <div className="absolute inset-[28%] rounded-full border border-dashed border-line" />

      {/* crosshair axes */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-linear-to-r from-transparent via-white/8 to-transparent" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-linear-to-b from-transparent via-white/8 to-transparent" />

      {/* core */}
      <div className="absolute inset-[38%] rounded-full glass-panel-raised glass-panel glow-accent flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="size-3/5 animate-drift">
          <defs>
            <linearGradient id="core-kite" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.85" />
              <stop offset="100%" stopColor="var(--color-accent-alt)" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          <polygon
            points="50,8 88,50 50,78 18,50"
            fill="url(#core-kite)"
            fillOpacity="0.28"
            stroke="url(#core-kite)"
            strokeWidth="1.5"
          />
          <circle cx="50" cy="8" r="3" fill="var(--color-disc-d)" />
          <circle cx="88" cy="50" r="3" fill="var(--color-disc-i)" />
          <circle cx="50" cy="78" r="3" fill="var(--color-disc-s)" />
          <circle cx="18" cy="50" r="3" fill="var(--color-disc-c)" />
        </svg>
      </div>

      {/* outer rotor (spins forward — chips counter-spin in reverse) */}
      <div className="absolute inset-0 animate-orbit-slow">
        {NODES.filter((n) => n.ring === "outer").map((node) => (
          <OrbitNodeChip
            key={node.dimension}
            node={node}
            counter="animate-orbit-slow [animation-direction:reverse]"
          />
        ))}
      </div>

      {/* inner rotor (spins in reverse — chips counter-spin forward) */}
      <div className="absolute inset-[14%] animate-orbit-slower">
        {NODES.filter((n) => n.ring === "inner").map((node) => (
          <OrbitNodeChip
            key={node.dimension}
            node={node}
            counter="animate-orbit-slower [animation-direction:normal]"
          />
        ))}
      </div>
    </div>
  );
}

function OrbitNodeChip({
  node,
  counter,
}: {
  node: OrbitNode;
  counter: string;
}) {
  const color = nodeColor[node.dimension];
  const label = dimensionMeta[node.dimension].label;
  return (
    <div
      className="absolute inset-0"
      style={{ transform: `rotate(${node.angle}deg)` }}
    >
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
        {/* counter-rotation keeps the chip upright */}
        <div className={cn(counter)}>
          <div style={{ transform: `rotate(${-node.angle}deg)` }}>
            <div
              className={cn(
                "glass-panel flex items-center gap-2 rounded-full border px-3.5 py-2",
                color.border,
                color.glow,
              )}
            >
              <span
                className={cn(
                  "font-mono text-sm font-medium leading-none",
                  color.text,
                )}
              >
                {dimensionMeta[node.dimension].displayCode}
              </span>
              <span className="text-xs leading-none text-ink-secondary">
                {label}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
