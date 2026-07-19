"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { arcPath, polarPoint, wrapLabel } from "@/lib/visuals/geometry";

/**
 * Focus Cycle — a circular pathway, never boxes joined by straight arrows.
 *
 * Stages sit on a ring joined by curved arc segments with directional
 * chevrons; the closing arc back to the first stage is dashed, making the
 * repeat explicit. Serves both the autopilot loop (cue → check → reward →
 * repeat) on the deck and the attention cycle (intention → focus →
 * interruption → recovery → re-entry) on result surfaces. An optional
 * emphasis index highlights the stage that matters for this profile.
 */

const VB_W = 640;
const VB_H = 420;
const CX = VB_W / 2;
const CY = 210;
const RING_R = 132;
const NODE_R = 27;

export interface CycleStage {
  label: string;
  note?: string;
}

interface FocusCycleProps {
  stages: CycleStage[];
  /** Index of the stage to emphasise (e.g. recovery), if any. */
  emphasize?: number;
  className?: string;
}

export function FocusCycle({ stages, emphasize, className }: FocusCycleProps) {
  const reduced = useReducedMotion() ?? false;
  const count = Math.max(stages.length, 2);
  const angleFor = (index: number) => (360 / count) * index;
  // Gap either side of each node so arcs never touch the circles.
  const gap = ((NODE_R + 10) / RING_R) * (180 / Math.PI);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={`Cycle: ${stages.map((s) => s.label).join(" → ")}, repeating.`}
      className={cn("h-auto w-full", className)}
    >
      <title>Focus Cycle</title>

      {/* curved connections with direction chevrons */}
      {stages.map((_, index) => {
        const from = angleFor(index) + gap;
        const to = angleFor(index + 1) - gap;
        const isClosing = index === count - 1;
        const mid = polarPoint(CX, CY, RING_R, (from + to) / 2);
        const tangent = (from + to) / 2 + 90;
        const chevA = polarPoint(mid.x, mid.y, 7, tangent + 140);
        const chevB = polarPoint(mid.x, mid.y, 7, tangent - 140);
        return (
          <g key={`arc-${index}`}>
            <motion.path
              d={arcPath(CX, CY, RING_R, from, to)}
              fill="none"
              stroke="var(--color-teal)"
              strokeOpacity={isClosing ? 0.55 : 0.8}
              strokeWidth={3}
              strokeDasharray={isClosing ? "3 8" : undefined}
              strokeLinecap="round"
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: reduced ? 0 : 0.15 + index * 0.14, ease: [0.22, 1, 0.36, 1] }}
            />
            <path
              d={`M ${chevA.x.toFixed(2)} ${chevA.y.toFixed(2)} L ${mid.x.toFixed(2)} ${mid.y.toFixed(2)} L ${chevB.x.toFixed(2)} ${chevB.y.toFixed(2)}`}
              fill="none"
              stroke="var(--color-teal)"
              strokeOpacity={isClosing ? 0.55 : 0.85}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {/* stage nodes + radial labels */}
      {stages.map((stage, index) => {
        const angle = angleFor(index);
        const node = polarPoint(CX, CY, RING_R, angle);
        const isEmphasized = emphasize === index;
        const lines = wrapLabel(stage.label, 14);
        // Side-aware placement: horizontal nodes get start/end-anchored labels
        // clear of the circle; vertical nodes get centred labels above/below.
        const rad = ((angle - 90) * Math.PI) / 180;
        const cos = Math.cos(rad);
        const horizontal = Math.abs(cos) > 0.55;
        const anchor: "start" | "middle" | "end" = horizontal ? (cos > 0 ? "start" : "end") : "middle";
        const label = horizontal
          ? { x: node.x + Math.sign(cos) * (NODE_R + 16), y: node.y + 6 }
          : polarPoint(CX, CY, RING_R + NODE_R + 26, angle);
        const above = !horizontal && label.y < node.y;
        const labelY = above ? label.y - (lines.length - 1) * 15 - (stage.note ? 8 : 0) : label.y;
        return (
          <g key={stage.label}>
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={NODE_R}
              fill={isEmphasized ? "var(--color-botanical)" : "var(--color-paper)"}
              stroke={isEmphasized ? "var(--color-botanical)" : "var(--color-teal)"}
              strokeWidth={2}
              initial={reduced ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: reduced ? 0 : index * 0.14 }}
              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
            />
            <text
              x={node.x}
              y={node.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={16}
              fontWeight={600}
              fill={isEmphasized ? "var(--color-mineral)" : "var(--color-teal)"}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {index + 1}
            </text>
            <text
              x={label.x}
              y={labelY}
              textAnchor={anchor}
              fontSize={17}
              fontWeight={600}
              fill="var(--color-ink)"
            >
              {lines.map((line, lineIndex) => (
                <tspan key={line} x={label.x} dy={lineIndex === 0 ? 0 : 17}>
                  {line}
                </tspan>
              ))}
              {stage.note ? (
                <tspan x={label.x} dy={17} fontSize={13} fontWeight={400} fill="var(--color-slate)">
                  {stage.note}
                </tspan>
              ) : null}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
