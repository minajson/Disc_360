"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { useMotionTier } from "@/lib/motion/preferences";
import type { Dimension } from "@/lib/types";

const W = 520;
const H = 400;
const PAD = 48;

interface MapDot {
  dim: Dimension;
  x: number;
  y: number;
}

/** Illustrative roster spread — clusters mirror a real mixed team. */
const DOTS: MapDot[] = [
  { dim: "D", x: 150, y: 110 },
  { dim: "D", x: 190, y: 88 },
  { dim: "I", x: 360, y: 104 },
  { dim: "I", x: 402, y: 140 },
  { dim: "I", x: 330, y: 150 },
  { dim: "S", x: 352, y: 286 },
  { dim: "S", x: 392, y: 258 },
  { dim: "S", x: 318, y: 312 },
  { dim: "C", x: 152, y: 276 },
  { dim: "C", x: 118, y: 306 },
  { dim: "C", x: 190, y: 300 },
  { dim: "S", x: 268, y: 228 },
];

/**
 * Abstract team culture map for marketing previews. Swap-point contract:
 * decorative scene, later replaceable by a rendered 3D culture map.
 */
export function TeamCultureMapScene({ className }: { className?: string }) {
  const tier = useMotionTier();

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="A team plotted across the four DISC quadrants, showing clusters and gaps"
      className={cn("w-full select-none", className)}
    >
      <rect
        x={PAD}
        y={PAD}
        width={W - PAD * 2}
        height={H - PAD * 2}
        rx={20}
        fill="var(--color-paper)"
        stroke="var(--color-hairline)"
      />
      <line
        x1={W / 2}
        y1={PAD}
        x2={W / 2}
        y2={H - PAD}
        stroke="var(--color-hairline)"
        strokeDasharray="3 5"
      />
      <line
        x1={PAD}
        y1={H / 2}
        x2={W - PAD}
        y2={H / 2}
        stroke="var(--color-hairline)"
        strokeDasharray="3 5"
      />

      <text x={W / 2} y={PAD - 14} textAnchor="middle" fontSize={10} className="font-mono" fill="var(--color-faint)" letterSpacing="0.16em">
        FAST-PACED
      </text>
      <text x={W / 2} y={H - PAD + 24} textAnchor="middle" fontSize={10} className="font-mono" fill="var(--color-faint)" letterSpacing="0.16em">
        REFLECTIVE
      </text>

      {DOTS.map((dot, index) => (
        <motion.circle
          key={index}
          cx={dot.x}
          cy={dot.y}
          r={9}
          fill={`var(--color-disc-${dot.dim.toLowerCase()})`}
          fillOpacity={0.85}
          stroke="var(--color-paper)"
          strokeWidth={2}
          animate={tier === "reduced" ? undefined : { y: [0, -5, 0] }}
          transition={{
            duration: 5 + (index % 5),
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.3,
          }}
        />
      ))}
    </svg>
  );
}
