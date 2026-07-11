"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSION_KEY, DIMENSIONS, type Dimension, type DiscScores } from "@/lib/types";

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 96;
const GRID_LEVELS = [0.25, 0.5, 0.75, 1];

/** Axis unit vectors: D top, I right, S bottom, C left. */
const AXIS: Record<Dimension, { x: number; y: number }> = {
  D: { x: 0, y: -1 },
  I: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  C: { x: -1, y: 0 },
};

function pointFor(dim: Dimension, magnitude: number): [number, number] {
  const unit = AXIS[dim];
  return [CENTER + unit.x * RADIUS * magnitude, CENTER + unit.y * RADIUS * magnitude];
}

function polygonPoints(scores: DiscScores): string {
  return DIMENSIONS.map((dim) => {
    const value = scores[DIMENSION_KEY[dim]] / 100;
    return pointFor(dim, Math.max(0.04, value)).join(",");
  }).join(" ");
}

interface DiscRadarChartProps {
  scores: DiscScores;
  /** Show numeric scores beside axis labels. */
  showScores?: boolean;
  className?: string;
}

/**
 * Four-axis DISC kite. Motion-ready swap point: prop contract (scores in
 * 0–100 per dimension) stays stable if internals become a 3D scene.
 */
export function DiscRadarChart({
  scores,
  showScores = true,
  className,
}: DiscRadarChartProps) {
  const reduceMotion = useReducedMotion();

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`DISC profile — Dominant ${scores.d}, Influence ${scores.i}, Stable ${scores.s}, Analytical ${scores.c}`}
      className={cn("w-full", className)}
    >
      <defs>
        <linearGradient id="disc-kite-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" />
          <stop offset="100%" stopColor="var(--color-accent-alt)" />
        </linearGradient>
      </defs>

      {/* grid kites */}
      {GRID_LEVELS.map((level) => (
        <polygon
          key={level}
          points={DIMENSIONS.map((d) => pointFor(d, level).join(",")).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={level === 1 ? 1.25 : 1}
          strokeDasharray={level === 1 ? undefined : "3 4"}
        />
      ))}

      {/* axes */}
      {DIMENSIONS.map((dim) => {
        const [x, y] = pointFor(dim, 1);
        return (
          <line
            key={dim}
            x1={CENTER}
            y1={CENTER}
            x2={x}
            y2={y}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
        );
      })}

      {/* data kite */}
      <motion.polygon
        points={polygonPoints(scores)}
        fill="url(#disc-kite-fill)"
        fillOpacity={0.22}
        stroke="url(#disc-kite-fill)"
        strokeWidth={1.75}
        strokeLinejoin="round"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.82 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
      />

      {/* vertex markers in dimension colors */}
      {DIMENSIONS.map((dim) => {
        const value = scores[DIMENSION_KEY[dim]] / 100;
        const [x, y] = pointFor(dim, Math.max(0.04, value));
        return (
          <circle
            key={dim}
            cx={x}
            cy={y}
            r={4}
            fill={`var(--color-disc-${dim.toLowerCase()})`}
            stroke="var(--color-midnight-900)"
            strokeWidth={2}
          />
        );
      })}

      {/* axis labels */}
      {DIMENSIONS.map((dim) => {
        const [x, y] = pointFor(dim, 1.22);
        const score = scores[DIMENSION_KEY[dim]];
        return (
          <text
            key={dim}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="font-mono"
            fontSize={11}
            fill="var(--color-ink-secondary)"
          >
            {dimensionMeta[dim].displayCode}
            {showScores ? (
              <tspan fill="var(--color-ink-muted)"> {score}</tspan>
            ) : null}
          </text>
        );
      })}
    </svg>
  );
}
