"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { DIMENSION_KEY, DIMENSIONS, type DiscScores } from "@/lib/types";

const SIZE = 360;
const CENTER = SIZE / 2;

/** Arc path for a dimension ring segment. */
function arcPath(radius: number, startDeg: number, endDeg: number): string {
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const sx = CENTER + radius * Math.cos(rad(startDeg));
  const sy = CENTER + radius * Math.sin(rad(startDeg));
  const ex = CENTER + radius * Math.cos(rad(endDeg));
  const ey = CENTER + radius * Math.sin(rad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${radius} ${radius} 0 ${large} 1 ${ex} ${ey}`;
}

interface ResultsRevealSceneProps {
  scores: DiscScores;
  className?: string;
}

/**
 * Radial reveal that opens the results experience: four arcs, one per
 * dimension, sweep proportionally to the profile. Swap-point contract:
 * scores in, ceremonial reveal out — replaceable with a rendered 3D scene.
 */
export function ResultsRevealScene({ scores, className }: ResultsRevealSceneProps) {
  const reduced = useReducedMotion();

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`Profile reveal — Dominant ${scores.d}, Influence ${scores.i}, Stable ${scores.s}, Analytical ${scores.c} of 100`}
      className={cn("w-full select-none", className)}
    >
      {DIMENSIONS.map((dim, index) => {
        const radius = 150 - index * 26;
        const value = scores[DIMENSION_KEY[dim]];
        const sweep = 8 + (value / 100) * 344;
        return (
          <g key={dim}>
            <circle
              cx={CENTER}
              cy={CENTER}
              r={radius}
              fill="none"
              stroke="var(--color-hairline)"
              strokeWidth={1}
            />
            <motion.path
              d={arcPath(radius, 0, sweep)}
              fill="none"
              stroke={`var(--color-disc-${dim.toLowerCase()})`}
              strokeWidth={7}
              strokeLinecap="round"
              initial={reduced ? false : { pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: 1.1,
                delay: index * 0.22,
                ease: [0.32, 0.94, 0.6, 1],
              }}
            />
          </g>
        );
      })}
      <circle cx={CENTER} cy={CENTER} r={30} fill="var(--color-paper)" stroke="var(--color-hairline)" />
      <polygon
        points={`${CENTER},${CENTER - 14} ${CENTER + 14},${CENTER} ${CENTER},${CENTER + 14} ${CENTER - 14},${CENTER}`}
        fill="var(--color-teal)"
        fillOpacity={0.25}
        stroke="var(--color-botanical)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}
