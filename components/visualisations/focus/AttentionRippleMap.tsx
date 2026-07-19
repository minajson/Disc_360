"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { polarPoint, wrapLabel } from "@/lib/visuals/geometry";

/**
 * Attention Ripple Map — one clear signal surrounded by interruptions.
 *
 * The centre is the signal; interruption sources sit on concentric ripple
 * rings that expand slowly at full motion. Marker prominence can vary with a
 * strength when provided; without strengths it renders as the concept visual
 * used on the Focus introduction deck. Wide 16:9-friendly canvas.
 */

const VB_W = 640;
const VB_H = 360;
const CX = VB_W / 2;
const CY = 186;
const RINGS = [64, 104, 144];
const MARKER_ANGLES = [-52, 38, 96, 152, -128, -18];

export interface RippleMarker {
  label: string;
  /** 0–100; omitted = concept mode (uniform prominence). */
  strength?: number;
}

interface AttentionRippleMapProps {
  markers: RippleMarker[];
  className?: string;
}

export function AttentionRippleMap({ markers, className }: AttentionRippleMapProps) {
  const reduced = useReducedMotion() ?? false;
  const shown = markers.slice(0, MARKER_ANGLES.length);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={`Attention ripple map. One clear signal surrounded by: ${shown.map((m) => m.label).join(", ")}.`}
      className={cn("h-auto w-full", className)}
    >
      <title>Attention Ripple Map</title>

      {/* ripple rings */}
      {RINGS.map((r, index) => (
        <circle
          key={r}
          cx={CX}
          cy={CY}
          r={r}
          fill="none"
          stroke="var(--color-teal)"
          strokeOpacity={0.34 - index * 0.09}
          strokeWidth={1.4}
          strokeDasharray="1.5 7"
          strokeLinecap="round"
        />
      ))}

      {/* one slow expanding ripple at full motion */}
      {!reduced ? (
        <motion.circle
          cx={CX}
          cy={CY}
          fill="none"
          stroke="var(--color-teal)"
          strokeWidth={1.4}
          initial={{ r: RINGS[0], opacity: 0.45 }}
          animate={{ r: RINGS[2], opacity: 0 }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
        />
      ) : null}

      {/* the signal */}
      <motion.circle
        cx={CX}
        cy={CY}
        r={30}
        fill="var(--color-botanical)"
        fillOpacity={0.9}
        initial={reduced ? false : { scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      />
      <text
        x={CX}
        y={CY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12.5}
        fontWeight={600}
        fill="var(--color-mineral)"
        style={{ letterSpacing: "0.14em" }}
      >
        SIGNAL
      </text>

      {/* interruption markers */}
      {shown.map((marker, index) => {
        const angle = MARKER_ANGLES[index]!;
        const ring = RINGS[index % RINGS.length]!;
        const pos = polarPoint(CX, CY, ring, angle);
        const strength = (marker.strength ?? 60) / 100;
        const lines = wrapLabel(marker.label, 14);
        const onRight = pos.x >= CX;
        const nearHorizontal = Math.abs(pos.y - CY) < ring * 0.45;
        const labelX = nearHorizontal ? pos.x + (onRight ? 14 : -14) : pos.x;
        const labelYBase = nearHorizontal
          ? pos.y - 4
          : pos.y < CY
            ? pos.y - 14 - (lines.length - 1) * 15
            : pos.y + 22;
        return (
          <g key={marker.label}>
            <motion.circle
              cx={pos.x}
              cy={pos.y}
              r={5 + strength * 6}
              fill="var(--color-disc-i)"
              fillOpacity={0.45 + strength * 0.5}
              stroke="var(--color-paper)"
              strokeWidth={2}
              initial={reduced ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: reduced ? 0 : 0.15 + index * 0.1 }}
              style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
            />
            <text
              x={labelX}
              y={labelYBase}
              textAnchor={nearHorizontal ? (onRight ? "start" : "end") : "middle"}
              fontSize={14.5}
              fontWeight={600}
              fill="var(--color-ink)"
            >
              {lines.map((line, lineIndex) => (
                <tspan key={line} x={labelX} dy={lineIndex === 0 ? 0 : 15}>
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
