"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSION_KEY, DIMENSIONS, type Dimension } from "@/lib/types";
import type { TrendPoint } from "@/lib/insights/analytics";

/**
 * Assessment activity over time: a completions area with the four dimension
 * averages drawn over it.
 *
 * Custom SVG in the house idiom (hairline grid, mono axis type, DISC colours
 * for data only) — no chart library, per project rule. Months with no
 * completions break the dimension lines rather than interpolating across
 * them, because a straight line through an empty quarter is a claim the data
 * does not support.
 */

const WIDTH = 720;
const HEIGHT = 260;
const PAD_X = 34;
const PAD_TOP = 16;
const PAD_BOTTOM = 34;

interface TrendChartProps {
  points: TrendPoint[];
  className?: string;
}

export function TrendChart({ points, className }: TrendChartProps) {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState<Record<Dimension, boolean>>({
    D: true,
    I: true,
    S: true,
    C: true,
  });

  if (points.length === 0) {
    return <p className={cn("text-sm text-slate", className)}>No activity to chart yet.</p>;
  }

  const plotWidth = WIDTH - PAD_X * 2;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const x = (index: number) => PAD_X + step * index;
  const y = (value: number) => PAD_TOP + plotHeight - (value / 100) * plotHeight;

  const maxCount = Math.max(1, ...points.map((point) => point.count));
  const countY = (count: number) =>
    PAD_TOP + plotHeight - (count / maxCount) * plotHeight;

  // Completions area, closed along the baseline.
  const areaPath =
    points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${countY(point.count)}`).join(" ") +
    ` L${x(points.length - 1)},${PAD_TOP + plotHeight} L${x(0)},${PAD_TOP + plotHeight} Z`;

  // Dimension lines break at months with no data.
  const linePath = (dim: Dimension) => {
    let path = "";
    let penDown = false;
    points.forEach((point, index) => {
      if (point.count === 0) {
        penDown = false;
        return;
      }
      const command = penDown ? "L" : "M";
      path += `${command}${x(index)},${y(point.averages[DIMENSION_KEY[dim]])} `;
      penDown = true;
    });
    return path.trim();
  };

  const totalCompletions = points.reduce((sum, point) => sum + point.count, 0);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Assessment completions and average DISC intensity over ${points.length} months: ${points
          .map((point) => `${point.label} ${point.count}`)
          .join(", ")}`}
        className="w-full"
      >
        {[0, 25, 50, 75, 100].map((level) => (
          <g key={level}>
            <line
              x1={PAD_X}
              y1={y(level)}
              x2={WIDTH - PAD_X}
              y2={y(level)}
              stroke="var(--color-hairline)"
              strokeWidth={1}
              strokeDasharray={level === 0 ? undefined : "3 5"}
            />
            <text
              x={PAD_X - 8}
              y={y(level) + 3}
              textAnchor="end"
              fontSize={9}
              className="font-mono"
              fill="var(--color-faint)"
            >
              {level}
            </text>
          </g>
        ))}

        <motion.path
          d={areaPath}
          fill="var(--color-sage)"
          fillOpacity={0.35}
          stroke="none"
          initial={reduceMotion ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.32, 0.94, 0.6, 1] }}
        />

        {DIMENSIONS.filter((dim) => visible[dim]).map((dim, index) => (
          <motion.path
            key={dim}
            d={linePath(dim)}
            fill="none"
            stroke={`var(--color-disc-${dim.toLowerCase()})`}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            // pathLength is drawn with stroke-dasharray; print clears it so an
            // unscrolled line is a whole line rather than nothing.
            data-print-reveal="path"
            initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.7,
              delay: index * 0.08,
              ease: [0.32, 0.94, 0.6, 1],
            }}
          />
        ))}

        {points.map((point, index) => (
          <g key={point.key}>
            {point.count > 0 ? (
              <circle
                cx={x(index)}
                cy={countY(point.count)}
                r={3}
                fill="var(--color-botanical)"
                stroke="var(--color-paper)"
                strokeWidth={1.5}
              />
            ) : null}
            <text
              x={x(index)}
              y={HEIGHT - 14}
              textAnchor="middle"
              fontSize={9}
              className="font-mono"
              fill="var(--color-faint)"
            >
              {point.label}
            </text>
            {point.count > 0 ? (
              <text
                x={x(index)}
                y={countY(point.count) - 9}
                textAnchor="middle"
                fontSize={9}
                className="font-mono"
                fill="var(--color-slate)"
              >
                {point.count}
              </text>
            ) : null}
          </g>
        ))}
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-1.5 text-xs text-slate">
          <span aria-hidden className="size-2.5 rounded-full bg-sage" />
          Completions
          <span className="font-mono text-faint">{totalCompletions}</span>
        </span>
        {DIMENSIONS.map((dim) => (
          <button
            key={dim}
            type="button"
            aria-pressed={visible[dim]}
            onClick={() => setVisible((current) => ({ ...current, [dim]: !current[dim] }))}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
              visible[dim]
                ? "border-hairline-strong text-ink"
                : "border-hairline text-faint",
            )}
          >
            <span
              aria-hidden
              className="h-0.5 w-3.5 rounded-full"
              style={{
                background: `var(--color-disc-${dim.toLowerCase()})`,
                opacity: visible[dim] ? 1 : 0.35,
              }}
            />
            {dimensionMeta[dim].label}
          </button>
        ))}
      </div>
    </div>
  );
}
