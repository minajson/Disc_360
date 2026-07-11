"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { DIMENSION_KEY, DIMENSIONS, type Dimension, type DiscScores } from "@/lib/types";

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 120;

/** Star bearings: D top, I right, S bottom, C left (matches the radar). */
const AXIS: Record<Dimension, { x: number; y: number }> = {
  D: { x: 0, y: -1 },
  I: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  C: { x: -1, y: 0 },
};

function starFor(dim: Dimension, scores: DiscScores): { x: number; y: number; r: number; opacity: number } {
  const value = scores[DIMENSION_KEY[dim]] / 100;
  const unit = AXIS[dim];
  const distance = RADIUS * (0.35 + value * 0.65);
  return {
    x: CENTER + unit.x * distance,
    y: CENTER + unit.y * distance,
    r: 2.5 + value * 3.5,
    opacity: 0.35 + value * 0.65,
  };
}

interface TraitConstellationProps {
  scores: DiscScores;
  className?: string;
}

/**
 * Ambient constellation of the four dimensions, scaled by score — a
 * decorative signature behind the result hero. Motion-ready swap point
 * for a future 3D constellation scene.
 */
export function TraitConstellation({ scores, className }: TraitConstellationProps) {
  const reduceMotion = useReducedMotion();
  const stars = DIMENSIONS.map((dim) => ({ dim, ...starFor(dim, scores) }));

  return (
    <motion.svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
      animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
      transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* connective filaments */}
      {stars.map((star, index) => {
        const next = stars[(index + 1) % stars.length];
        if (!next) return null;
        return (
          <line
            key={star.dim}
            x1={star.x}
            y1={star.y}
            x2={next.x}
            y2={next.y}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="0.75"
            strokeDasharray="1 5"
          />
        );
      })}

      {/* stars */}
      {stars.map((star) => (
        <g key={star.dim} opacity={star.opacity}>
          <circle
            cx={star.x}
            cy={star.y}
            r={star.r * 3}
            fill={`var(--color-disc-${star.dim.toLowerCase()})`}
            opacity="0.12"
          />
          <circle
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill={`var(--color-disc-${star.dim.toLowerCase()})`}
          />
        </g>
      ))}
    </motion.svg>
  );
}
