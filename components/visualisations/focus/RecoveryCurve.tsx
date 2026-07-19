"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { smoothPath, wrapLabel, type Point } from "@/lib/visuals/geometry";

/**
 * Recovery Curve — the true cost of a two-second check.
 *
 * Attention rides high, drops sharply at the interruption, then climbs back
 * along a smooth trajectory whose tail is shaped by recovery readiness. The
 * shaded region between the curve and the attention baseline IS the cost —
 * visible without reading a single number. Smooth curves and a soft area
 * fill; deliberately nothing like a line chart or an ECG.
 */

const VB_W = 640;
const VB_H = 330;
const BASELINE_Y = 84;

interface RecoveryCurveProps {
  /** Four stage labels: focused → interrupted → reorienting → focused again. */
  annotations: string[];
  /** Recovery readiness 0–100 shapes how fully the tail returns. Default 65. */
  recovery?: number;
  className?: string;
}

export function RecoveryCurve({ annotations, recovery = 65, className }: RecoveryCurveProps) {
  const reduced = useReducedMotion() ?? false;

  const endY = BASELINE_Y + 8 + (100 - recovery) * 0.42;
  const points: Point[] = [
    { x: 48, y: BASELINE_Y + 4 },
    { x: 178, y: BASELINE_Y + 2 },
    { x: 216, y: 238 },
    { x: 268, y: 252 },
    { x: 348, y: 212 },
    { x: 448, y: 148 },
    { x: 576, y: endY },
  ];
  const curve = smoothPath(points, 0.5);
  const area = `${curve} L 576 ${BASELINE_Y} L 48 ${BASELINE_Y} Z`;

  const anchors: { point: Point; above: boolean; anchor: "start" | "middle" | "end" }[] = [
    { point: { x: 110, y: BASELINE_Y + 3 }, above: true, anchor: "middle" },
    { point: points[2]!, above: false, anchor: "middle" },
    { point: points[4]!, above: false, anchor: "middle" },
    { point: points[6]!, above: true, anchor: "end" },
  ];

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={`Recovery curve: ${annotations.join(", ")}. The dip below the attention baseline is the recovery cost.`}
      className={cn("h-auto w-full", className)}
    >
      <title>Recovery Curve</title>

      {/* attention baseline */}
      <path
        d={`M 48 ${BASELINE_Y} L 592 ${BASELINE_Y}`}
        stroke="var(--color-hairline)"
        strokeWidth={1.25}
        strokeDasharray="4 6"
        strokeLinecap="round"
      />
      <text
        x={22}
        y={BASELINE_Y + 4}
        fontSize={12}
        fill="var(--color-slate)"
        style={{ fontFamily: "var(--font-mono)" }}
        transform={`rotate(-90 22 ${BASELINE_Y + 4})`}
        textAnchor="end"
      >
        attention
      </text>

      {/* the cost: shaded area between baseline and curve */}
      <motion.path
        d={area}
        fill="var(--color-disc-d)"
        initial={reduced ? false : { fillOpacity: 0 }}
        animate={{ fillOpacity: 0.1 }}
        transition={{ duration: 0.8, delay: reduced ? 0 : 0.5 }}
      />

      {/* the trajectory */}
      <motion.path
        d={curve}
        fill="none"
        stroke="var(--color-botanical)"
        strokeWidth={3}
        strokeLinecap="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* interruption spark */}
      <motion.circle
        cx={points[2]!.x}
        cy={points[2]!.y}
        r={7}
        fill="var(--color-disc-i)"
        stroke="var(--color-paper)"
        strokeWidth={2}
        initial={reduced ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4, delay: reduced ? 0 : 0.45 }}
        style={{ transformOrigin: `${points[2]!.x}px ${points[2]!.y}px` }}
      />

      {/* stage annotations */}
      {annotations.slice(0, 4).map((annotation, index) => {
        const anchor = anchors[index]!;
        const lines = wrapLabel(annotation, 14);
        const baseY = anchor.above
          ? anchor.point.y - 16 - (lines.length - 1) * 16
          : anchor.point.y + 26;
        return (
          <g key={annotation}>
            {index !== 1 ? (
              <circle
                cx={anchor.point.x}
                cy={anchor.point.y}
                r={4.5}
                fill="var(--color-botanical)"
                stroke="var(--color-paper)"
                strokeWidth={2}
              />
            ) : null}
            <text
              x={anchor.point.x}
              y={baseY}
              textAnchor={anchor.anchor}
              fontSize={16}
              fontWeight={600}
              fill="var(--color-ink)"
            >
              {lines.map((line, lineIndex) => (
                <tspan key={line} x={anchor.point.x} dy={lineIndex === 0 ? 0 : 17}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
