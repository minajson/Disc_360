"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import { arcPath, curvedConnector, polarPoint } from "@/lib/visuals/geometry";
import { DIMENSION_KEY, DIMENSIONS, type Dimension, type DiscScores } from "@/lib/types";
import type { FocusScores } from "@/lib/scoring/focus";
import type { DistractionFactor } from "@/lib/visuals/focus-factors";

/**
 * Behaviour–Focus Fusion — the Combined hero visual.
 *
 * One integrated instrument, not two charts beside each other. Three layers:
 *
 *   inner  — the behavioural core: four compass petals, score-scaled, with
 *            the primary style at the hub;
 *   middle — the focus layer: two curved gauge arcs, steady attention
 *            (inverse of distraction) on the right, recovery on the left;
 *   outer  — the pull layer: the strongest attention triggers on a dotted
 *            orbit, sized by strength.
 *
 * Two curved relationship paths tell the story straight-line diagrams can't:
 * one flows from the primary behaviour petal out to the strongest trigger
 * (what this style tends to get pulled by), the other from that trigger back
 * to the recovery arc (the route back). All motion collapses under
 * reduced-motion; an HTML legend keeps the layers readable at any size.
 */

const VB_W = 560;
const VB_H = 552;
const CX = VB_W / 2;
const CY = 270;

/* inner behavioural core */
const CORE_INNER_R = 46;
const PETAL_MIN = 10;
const PETAL_MAX = 36;
const QUADRANT_ANGLE: Record<Dimension, number> = { D: -45, I: 45, S: 135, C: -135 };
const PETAL_SWEEP = 74;

/* middle focus layer */
const GAUGE_R = 118;
const GAUGE_SWEEP_MAX = 150;

/* outer pull layer */
const ORBIT_R = 190;
const TRIGGER_ANGLES = [-45, 115, 175];

function wrapLabel(label: string): string[] {
  const words = label.split(" ");
  if (label.length <= 13 || words.length === 1) return [label];
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    if ((line + " " + word).trim().length > 13 && line) {
      lines.push(line.trim());
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

export interface FusionDiscData {
  scores: DiscScores;
  primary: Dimension;
  secondary?: Dimension | null;
}

interface BehaviourFocusFusionProps {
  disc: FusionDiscData;
  focus: FocusScores;
  /** Strongest attention pulls, strongest first (deriveDistractionFactors). */
  factors: DistractionFactor[];
  className?: string;
}

export function BehaviourFocusFusion({
  disc,
  focus,
  factors,
  className,
}: BehaviourFocusFusionProps) {
  const reduced = useReducedMotion() ?? false;

  const petalFor = (dim: Dimension) => {
    const score = disc.scores[DIMENSION_KEY[dim]];
    const thickness = PETAL_MIN + (score / 100) * (PETAL_MAX - PETAL_MIN);
    return { thickness, rMid: CORE_INNER_R + thickness / 2 };
  };

  const steadySweep = ((100 - focus.distraction) / 100) * GAUGE_SWEEP_MAX;
  const recoverySweep = (focus.recovery / 100) * GAUGE_SWEEP_MAX;
  const triggers = factors.slice(0, TRIGGER_ANGLES.length);

  // Relationship paths: primary petal → strongest trigger → recovery arc.
  const primaryPetal = petalFor(disc.primary);
  const primaryEdge = polarPoint(
    CX,
    CY,
    CORE_INNER_R + primaryPetal.thickness + 8,
    QUADRANT_ANGLE[disc.primary],
  );
  const strongestMarker = polarPoint(CX, CY, ORBIT_R, TRIGGER_ANGLES[0]!);
  const recoveryMid = polarPoint(CX, CY, GAUGE_R, 195 + recoverySweep / 2);

  const summary = `Behaviour and focus fusion map. Primary behavioural style ${dimensionMeta[disc.primary].label}. Steady attention ${Math.round(100 - focus.distraction)} of 100, recovery readiness ${focus.recovery}. Strongest attention pulls: ${triggers.map((t) => t.label).join(", ")}.`;

  return (
    <div className={cn("flex w-full flex-col items-center gap-3", className)}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label={summary}
        className="h-auto w-full"
      >
        <title>Behaviour–Focus Fusion</title>

        {/* outer pull orbit */}
        <circle
          cx={CX}
          cy={CY}
          r={ORBIT_R}
          fill="none"
          stroke="var(--color-disc-i)"
          strokeOpacity={0.3}
          strokeWidth={1.4}
          strokeDasharray="1.5 8"
          strokeLinecap="round"
        />

        {/* middle focus layer: faint track + the two gauge arcs */}
        <circle
          cx={CX}
          cy={CY}
          r={GAUGE_R}
          fill="none"
          stroke="var(--color-hairline)"
          strokeWidth={1.25}
        />
        <motion.path
          d={arcPath(CX, CY, GAUGE_R, 15, 15 + Math.max(6, steadySweep))}
          fill="none"
          stroke="var(--color-botanical)"
          strokeWidth={10}
          strokeLinecap="round"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: reduced ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.path
          d={arcPath(CX, CY, GAUGE_R, 195, 195 + Math.max(6, recoverySweep))}
          fill="none"
          stroke="var(--color-teal)"
          strokeWidth={10}
          strokeLinecap="round"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: reduced ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* fixed-anchor gauge labels (never collide with dynamic sweeps) */}
        <text
          x={polarPoint(CX, CY, GAUGE_R + 22, 8).x}
          y={polarPoint(CX, CY, GAUGE_R + 22, 8).y}
          textAnchor="start"
          fontSize={14.5}
          fontWeight={600}
          fill="var(--color-botanical)"
        >
          Steady attention
          <tspan fontWeight={400} fill="var(--color-slate)" style={{ fontFamily: "var(--font-mono)" }}>
            {" "}
            {Math.round(100 - focus.distraction)}
          </tspan>
        </text>
        <text
          x={polarPoint(CX, CY, GAUGE_R + 24, 200).x}
          y={polarPoint(CX, CY, GAUGE_R + 24, 200).y + 10}
          textAnchor="end"
          fontSize={14.5}
          fontWeight={600}
          fill="var(--color-teal)"
        >
          Recovery
          <tspan fontWeight={400} fill="var(--color-slate)" style={{ fontFamily: "var(--font-mono)" }}>
            {" "}
            {focus.recovery}
          </tspan>
        </text>

        {/* relationship curves: behaviour → pull → recovery */}
        <motion.path
          d={curvedConnector(primaryEdge, strongestMarker, 0.3, 1)}
          fill="none"
          stroke="var(--color-disc-d)"
          strokeOpacity={0.5}
          strokeWidth={2.4}
          strokeDasharray="6 7"
          strokeLinecap="round"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: reduced ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.path
          d={curvedConnector(strongestMarker, recoveryMid, 0.45, -1)}
          fill="none"
          stroke="var(--color-teal)"
          strokeOpacity={0.6}
          strokeWidth={2.6}
          strokeDasharray="6 7"
          strokeLinecap="round"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: reduced ? 0 : 0.95, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* inner behavioural core */}
        {DIMENSIONS.map((dim, index) => {
          const { thickness, rMid } = petalFor(dim);
          const centre = QUADRANT_ANGLE[dim];
          const isPrimary = dim === disc.primary;
          const isSecondary = dim === disc.secondary;
          return (
            <motion.path
              key={dim}
              d={arcPath(CX, CY, rMid, centre - PETAL_SWEEP / 2, centre + PETAL_SWEEP / 2)}
              fill="none"
              stroke={`var(--color-${dimensionMeta[dim].colorVar})`}
              strokeWidth={thickness}
              strokeLinecap="round"
              initial={reduced ? false : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: isPrimary ? 0.95 : isSecondary ? 0.6 : 0.26, scale: 1 }}
              transition={{ duration: 0.5, delay: reduced ? 0 : 0.06 * index, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: `${CX}px ${CY}px` }}
            />
          );
        })}
        <circle
          cx={CX}
          cy={CY}
          r={32}
          fill="var(--color-paper)"
          stroke="var(--color-hairline)"
          strokeWidth={1.5}
        />
        <text
          x={CX}
          y={CY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={27}
          fontWeight={600}
          fill={`var(--color-${dimensionMeta[disc.primary].colorVar})`}
          style={{ fontFamily: "var(--font-display)" }}
        >
          {dimensionMeta[disc.primary].displayCode}
          {disc.secondary ? (
            <tspan fontSize={16} fill="var(--color-slate)">
              {dimensionMeta[disc.secondary].displayCode}
            </tspan>
          ) : null}
        </text>

        {/* attention triggers on the orbit */}
        {triggers.map((factor, index) => {
          const angle = TRIGGER_ANGLES[index]!;
          const marker = polarPoint(CX, CY, ORBIT_R, angle);
          const strength = factor.strength / 100;
          const markerR = 6 + strength * 8;
          const lines = wrapLabel(factor.label);
          // Placement: a truly horizontal marker labels BELOW itself (a
          // radial label would land on top of it, and a side-anchored one
          // would clip the viewBox edge); everything else labels radially.
          const sinA = Math.sin((angle * Math.PI) / 180);
          const horizontal = Math.abs(sinA) > 0.85;
          const label = horizontal
            ? { x: marker.x, y: marker.y + markerR + 22 }
            : (() => {
                const radial = polarPoint(CX, CY, ORBIT_R + 32, angle);
                return {
                  x: radial.x,
                  y: radial.y < marker.y ? radial.y - (lines.length - 1) * 16 : radial.y,
                };
              })();
          return (
            <g key={factor.label}>
              <motion.circle
                cx={marker.x}
                cy={marker.y}
                r={markerR}
                fill="var(--color-disc-i)"
                fillOpacity={0.5 + strength * 0.5}
                stroke="var(--color-paper)"
                strokeWidth={2}
                initial={reduced ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.45, delay: reduced ? 0 : 0.55 + index * 0.12 }}
                style={{ transformOrigin: `${marker.x}px ${marker.y}px` }}
              />
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                fontSize={15}
                fontWeight={600}
                fill="var(--color-ink)"
              >
                {lines.map((line, lineIndex) => (
                  <tspan key={line} x={label.x} dy={lineIndex === 0 ? 0 : 17}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>

      {/* layer legend — plain HTML so it stays readable at every size */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
        {(
          [
            { color: `var(--color-${dimensionMeta[disc.primary].colorVar})`, label: "Behavioural core" },
            { color: "var(--color-botanical)", label: "Focus & recovery" },
            { color: "var(--color-disc-i)", label: "Attention pulls" },
          ] as const
        ).map((item) => (
          <span key={item.label} className="flex items-center gap-2 text-xs text-slate">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
