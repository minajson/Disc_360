"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { useMotionTier } from "@/lib/motion/preferences";
import { dimensionMeta } from "@/data/dimension-meta";
import type { Dimension } from "@/lib/types";

const W = 640;
const H = 520;

interface SpectrumNode {
  dim: Dimension;
  x: number;
  y: number;
  labelDx: number;
  labelDy: number;
}

const NODES: SpectrumNode[] = [
  { dim: "D", x: 130, y: 112, labelDx: 26, labelDy: -14 },
  { dim: "I", x: 478, y: 158, labelDx: 26, labelDy: -14 },
  { dim: "S", x: 198, y: 348, labelDx: -26, labelDy: 34 },
  { dim: "C", x: 512, y: 428, labelDx: -30, labelDy: 34 },
];

const SPECTRUM_PATH =
  "M 130 112 C 290 34, 420 74, 478 158 C 536 242, 330 262, 198 348 C 96 416, 372 486, 512 428";

/**
 * The dimensional DISC spectrum — an original interactive personality visual.
 * Four behavioral fields connected by one continuous line; on fine-pointer
 * devices the nearest field responds to the cursor. Swap-point contract:
 * self-sizing decorative scene, replaceable with a rendered 3D spectrum.
 */
export function DiscSpectrumScene({ className }: { className?: string }) {
  const tier = useMotionTier();
  const svgRef = useRef<SVGSVGElement>(null);
  const [nearest, setNearest] = useState<Dimension | null>(null);

  const handleMove = (event: React.MouseEvent) => {
    if (tier !== "full" || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const y = ((event.clientY - rect.top) / rect.height) * H;
    let best: Dimension | null = null;
    let bestDistance = 120;
    for (const node of NODES) {
      const distance = Math.hypot(node.x - x, node.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = node.dim;
      }
    }
    setNearest(best);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="The four DISC dimensions — Dominant, Influence, Stable and Analytical — connected as one behavioral spectrum"
      className={cn("w-full select-none", className)}
      onMouseMove={handleMove}
      onMouseLeave={() => setNearest(null)}
    >
      <defs>
        <filter id="spectrum-soften" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="34" />
        </filter>
      </defs>

      {/* behavioral fields */}
      {NODES.map((node, index) => (
        <motion.ellipse
          key={node.dim}
          cx={node.x}
          cy={node.y}
          rx={116}
          ry={84}
          fill={`var(--color-disc-${node.dim.toLowerCase()}-soft)`}
          filter="url(#spectrum-soften)"
          // Animate transforms, not cx/cy: attribute animation briefly emits
          // undefined on hydration (console errors on every page view).
          animate={tier === "reduced" ? undefined : { y: [0, -10, 0], x: [0, 6, 0] }}
          transition={{
            duration: 9 + index * 1.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* the spectrum line */}
      <motion.path
        d={SPECTRUM_PATH}
        fill="none"
        stroke="var(--color-ink)"
        strokeOpacity={0.28}
        strokeWidth={1.25}
        initial={tier === "reduced" ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.6, ease: [0.32, 0.94, 0.6, 1] }}
      />

      {/* nodes */}
      {NODES.map((node) => {
        const meta = dimensionMeta[node.dim];
        const active = nearest === node.dim;
        return (
          <g key={node.dim}>
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={10}
              fill={`var(--color-disc-${node.dim.toLowerCase()})`}
              stroke="var(--color-paper)"
              strokeWidth={3}
              animate={{ scale: active ? 1.5 : 1 }}
              transition={{ duration: 0.25, ease: [0.32, 0.94, 0.6, 1] }}
              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
            />
            <text
              x={node.x + node.labelDx}
              y={node.y + node.labelDy}
              textAnchor={node.labelDx < 0 ? "end" : "start"}
              className="font-mono"
              fontSize={11}
              fill="var(--color-slate)"
              letterSpacing="0.14em"
            >
              {meta.displayCode} · {meta.label.toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
