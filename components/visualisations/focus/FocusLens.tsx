"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { curvedConnector, polarPoint, wrapLabel } from "@/lib/visuals/geometry";
import type { FocusScores } from "@/lib/scoring/focus";
import type { DistractionFactor } from "@/lib/visuals/focus-factors";

/**
 * Focus Lens — the Focus Pulse hero visual.
 *
 * A field of attention rather than a bar chart. The centre is the focus
 * field: it opens wider when distraction susceptibility is low and contracts
 * when it is high. Aperture blades around it thicken and darken with mental
 * load — the iris closing. The strongest attention pulls sit on orbital
 * rings — the stronger the pull, the closer its orbit — each tugging on the
 * field along a curved path. A single slow ripple breathes at full motion.
 *
 * Deliberately distinct from the DISC compass: organic and monochromatic
 * (teal/botanical with one amber pull accent) where the compass is a
 * four-colour instrument. Non-clinical by design — a metaphor for attention,
 * never a scan or an ECG.
 *
 * ViewBox-based SVG; labels wrap to two short lines and sit radially outside
 * their markers so nothing collides or clips at any size.
 */

const VB_W = 560;
const VB_H = 520;
const CX = VB_W / 2;
const CY = 254;
/** Focus field radius range, driven by (100 − distraction). */
const FIELD_MIN = 40;
const FIELD_MAX = 98;
/** Orbital rings, innermost = strongest pull. */
const RINGS = [138, 166, 194];
/** Marker angles — staggered to keep labels apart. */
const FACTOR_ANGLES = [-38, 63, 152, -118];

interface FocusLensProps {
  scores: FocusScores;
  /** Strongest attention pulls, strongest first (deriveDistractionFactors). */
  factors: DistractionFactor[];
  className?: string;
}

export function FocusLens({ scores, factors, className }: FocusLensProps) {
  const reduced = useReducedMotion() ?? false;

  const fieldR = FIELD_MIN + ((100 - scores.distraction) / 100) * (FIELD_MAX - FIELD_MIN);
  const load = scores.mentalLoad / 100;
  const bladeR = fieldR + 15;
  const shown = factors.slice(0, FACTOR_ANGLES.length);

  const summary = `Focus lens. Focus field openness ${Math.round(100 - scores.distraction)} of 100, mental load ${scores.mentalLoad}, recovery readiness ${scores.recovery}. Strongest attention pulls: ${shown.map((f) => f.label).join(", ")}.`;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={summary}
      className={cn("h-auto w-full", className)}
    >
      <title>Focus Lens</title>
      <defs>
        <radialGradient id="lens-field" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-teal)" stopOpacity="0.32" />
          <stop offset="62%" stopColor="var(--color-teal)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--color-botanical)" stopOpacity="0.28" />
        </radialGradient>
      </defs>

      {/* orbital rings — dotted, fading outward */}
      {RINGS.map((r, index) => (
        <circle
          key={r}
          cx={CX}
          cy={CY}
          r={r}
          fill="none"
          stroke="var(--color-teal)"
          strokeOpacity={0.32 - index * 0.08}
          strokeWidth={1.4}
          strokeDasharray="1.5 8"
          strokeLinecap="round"
        />
      ))}

      {/* slow breathing ripple — full motion only */}
      {!reduced ? (
        <motion.circle
          cx={CX}
          cy={CY}
          fill="none"
          stroke="var(--color-teal)"
          strokeWidth={1.5}
          initial={{ r: fieldR + 6, opacity: 0.4 }}
          animate={{ r: RINGS[1], opacity: 0 }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "linear" }}
        />
      ) : null}

      {/* the focus field */}
      <motion.circle
        cx={CX}
        cy={CY}
        r={fieldR}
        fill="url(#lens-field)"
        stroke="var(--color-botanical)"
        strokeOpacity={0.55}
        strokeWidth={1.75}
        initial={reduced ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      />
      <circle cx={CX} cy={CY} r={fieldR * 0.42} fill="var(--color-paper)" fillOpacity={0.55} />
      <text
        x={CX}
        y={CY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14.5}
        fontWeight={600}
        fill="var(--color-botanical-deep)"
        style={{ letterSpacing: "0.15em" }}
      >
        ATTENTION
      </text>

      {/* aperture blades — the iris closes as mental load rises */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = i * 45 + 22.5;
        const start = polarPoint(CX, CY, bladeR, angle - 13);
        const end = polarPoint(CX, CY, bladeR, angle + 13);
        return (
          <path
            key={angle}
            d={`M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${bladeR} ${bladeR} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`}
            fill="none"
            stroke="var(--color-slate)"
            strokeOpacity={0.22 + load * 0.45}
            strokeWidth={3 + load * 9}
            strokeLinecap="round"
          />
        );
      })}

      {/* attention pulls: curved tug toward the field + marker + radial label */}
      {shown.map((factor, index) => {
        const angle = FACTOR_ANGLES[index]!;
        const ring = RINGS[Math.min(index, RINGS.length - 1)]!;
        const marker = polarPoint(CX, CY, ring, angle);
        const fieldEdge = polarPoint(CX, CY, fieldR + 8, angle);
        const strength = factor.strength / 100;
        const lines = wrapLabel(factor.label);
        const label = polarPoint(CX, CY, ring + 30, angle);
        // Nudge the label further from the marker when it sits above it.
        const labelY = label.y < marker.y ? label.y - (lines.length - 1) * 16 : label.y;
        return (
          <g key={factor.label}>
            <motion.path
              d={curvedConnector(marker, fieldEdge, 0.28, index % 2 === 0 ? 1 : -1)}
              fill="none"
              stroke="var(--color-disc-i)"
              strokeOpacity={0.25 + strength * 0.45}
              strokeWidth={1.6 + strength * 1.6}
              strokeDasharray="5 6"
              strokeLinecap="round"
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, delay: reduced ? 0 : 0.25 + index * 0.12, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.circle
              cx={marker.x}
              cy={marker.y}
              r={6 + strength * 8}
              fill="var(--color-disc-i)"
              fillOpacity={0.5 + strength * 0.5}
              stroke="var(--color-paper)"
              strokeWidth={2}
              initial={reduced ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.45, delay: reduced ? 0 : 0.2 + index * 0.12 }}
              style={{ transformOrigin: `${marker.x}px ${marker.y}px` }}
            />
            <text
              x={label.x}
              y={labelY}
              textAnchor="middle"
              fontSize={15.5}
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
  );
}
