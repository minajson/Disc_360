"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSION_KEY, DIMENSIONS, type Dimension, type DiscScores } from "@/lib/types";

/**
 * Multi-series DISC radar — the same kite geometry, axis order and grid as
 * DiscRadarChart, drawn once per series so several profiles (or several
 * departments) can be read against each other on one chart.
 *
 * DiscRadarChart is deliberately untouched: it is the single-profile
 * component used everywhere a personal report appears, and its output must
 * not move. This is the comparison and board-room variant.
 *
 * Swap-point contract: series in, self-sizing SVG out.
 */

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

export interface RadarSeries {
  label: string;
  scores: DiscScores;
  /** CSS colour. Defaults to the botanical brand stroke. */
  color?: string;
  /** Draw as a dashed outline — used for "team average" reference kites. */
  reference?: boolean;
}

interface DiscRadarOverlayProps {
  series: RadarSeries[];
  /** Show numeric axis values. Off when several series would collide. */
  showScores?: boolean;
  /** Render the direct-labelled legend beneath the chart. */
  showLegend?: boolean;
  className?: string;
}

export function DiscRadarOverlay({
  series,
  showScores = false,
  showLegend = true,
  className,
}: DiscRadarOverlayProps) {
  const reduceMotion = useReducedMotion();
  const solo = series.length === 1 ? series[0] : null;

  return (
    <div className={cn("flex w-full flex-col items-center gap-4", className)}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={series
          .map(
            (entry) =>
              `${entry.label} — Dominant ${entry.scores.d}, Influence ${entry.scores.i}, Stable ${entry.scores.s}, Analytical ${entry.scores.c}`,
          )
          .join("; ")}
        className="w-full"
      >
        {GRID_LEVELS.map((level) => (
          <polygon
            key={level}
            points={DIMENSIONS.map((d) => pointFor(d, level).join(",")).join(" ")}
            fill="none"
            stroke="var(--color-hairline)"
            strokeWidth={level === 1 ? 1.25 : 1}
            strokeDasharray={level === 1 ? undefined : "3 4"}
          />
        ))}

        {DIMENSIONS.map((dim) => {
          const [x, y] = pointFor(dim, 1);
          return (
            <line
              key={dim}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              stroke="var(--color-hairline)"
              strokeWidth={1}
            />
          );
        })}

        {series.map((entry, index) => {
          const color = entry.color ?? "var(--color-botanical)";
          return (
            <motion.polygon
              key={`${entry.label}-${index}`}
              points={polygonPoints(entry.scores)}
              fill={entry.reference ? "none" : color}
              fillOpacity={entry.reference ? 0 : series.length > 1 ? 0.1 : 0.16}
              stroke={color}
              strokeWidth={entry.reference ? 1.25 : 1.75}
              strokeDasharray={entry.reference ? "5 5" : undefined}
              strokeLinejoin="round"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.82 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: Math.min(index * 0.06, 0.4),
                ease: [0.32, 0.94, 0.6, 1],
              }}
              style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
            />
          );
        })}

        {/* Vertex markers only make sense for a single kite; with several
            overlaid they turn the chart into confetti. */}
        {solo
          ? DIMENSIONS.map((dim) => {
              const value = solo.scores[DIMENSION_KEY[dim]] / 100;
              const [x, y] = pointFor(dim, Math.max(0.04, value));
              return (
                <circle
                  key={dim}
                  cx={x}
                  cy={y}
                  r={4.5}
                  fill={`var(--color-disc-${dim.toLowerCase()})`}
                  stroke="var(--color-paper)"
                  strokeWidth={2}
                />
              );
            })
          : null}

        {DIMENSIONS.map((dim) => {
          const [x, y] = pointFor(dim, 1.22);
          return (
            <text
              key={dim}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="font-mono"
              fontSize={11}
              fill="var(--color-slate)"
            >
              {dimensionMeta[dim].displayCode}
              {showScores && solo ? (
                <tspan fill="var(--color-faint)"> {solo.scores[DIMENSION_KEY[dim]]}</tspan>
              ) : null}
            </text>
          );
        })}
      </svg>

      {showLegend && series.length > 1 ? (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
          {series.map((entry, index) => (
            <span
              key={`${entry.label}-${index}`}
              className="flex items-center gap-1.5 text-xs text-slate"
            >
              <span
                aria-hidden
                className="h-0.5 w-4 rounded-full"
                style={{
                  background: entry.color ?? "var(--color-botanical)",
                  opacity: entry.reference ? 0.6 : 1,
                }}
              />
              {entry.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
