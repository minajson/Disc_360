"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import { arcPath, blendDirection, polarPoint } from "@/lib/visuals/geometry";
import { DIMENSION_KEY, DIMENSIONS, type Dimension, type DiscScores } from "@/lib/types";

/**
 * Behaviour Compass — the DISC hero visual.
 *
 * A radial navigation instrument, not a pie chart: four curved segment bands
 * whose outward reach grows with each dimension's score, a needle pointing at
 * the weighted blend of all four, and a hub carrying the primary style. The
 * blend needle is what makes mixed profiles legible at a glance — DI points
 * between Dominant and Influence, a balanced profile shows a calm ring
 * instead of a needle.
 *
 * ViewBox-based SVG: scales fluidly from a 300px card to a projected slide
 * with no fixed pixel canvas. All motion collapses under reduced-motion.
 */

const VB = 440;
const C = VB / 2;
const INNER_R = 88;
/** Band thickness range — the score-driven "petal" reach. */
const BAND_MIN = 22;
const BAND_MAX = 74;
/** Quadrant centre angles: D north-east, I south-east, S south-west, A north-west. */
const QUADRANT_ANGLE: Record<Dimension, number> = { D: -45, I: 45, S: 135, C: -135 };
const QUADRANT_SWEEP = 78; // per segment, leaving 12° breathing gaps

interface BehaviourCompassProps {
  scores: DiscScores;
  primary: Dimension;
  secondary?: Dimension | null;
  /** Show the numeric score under each label. */
  showScores?: boolean;
  className?: string;
}

export function BehaviourCompass({
  scores,
  primary,
  secondary = null,
  showScores = true,
  className,
}: BehaviourCompassProps) {
  const reduced = useReducedMotion() ?? false;

  const bandFor = (dim: Dimension) => {
    const score = scores[DIMENSION_KEY[dim]];
    const thickness = BAND_MIN + (score / 100) * (BAND_MAX - BAND_MIN);
    return { score, thickness, rMid: INNER_R + thickness / 2 };
  };

  const blend = blendDirection(
    DIMENSIONS.map((dim) => ({
      angleDeg: QUADRANT_ANGLE[dim],
      weight: scores[DIMENSION_KEY[dim]],
    })),
  );
  const balanced = blend.magnitude < 8;

  const needlePath = () => {
    const a = blend.angleDeg;
    const tip = polarPoint(C, C, INNER_R - 12, a);
    const left = polarPoint(C, C, 26, a - 13);
    const right = polarPoint(C, C, 26, a + 13);
    const tail = polarPoint(C, C, 10, a + 180);
    return `M ${tip.x} ${tip.y} L ${right.x} ${right.y} L ${tail.x} ${tail.y} L ${left.x} ${left.y} Z`;
  };

  const summary = DIMENSIONS.map(
    (dim) => `${dimensionMeta[dim].label} ${scores[DIMENSION_KEY[dim]]}`,
  ).join(", ");

  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      role="img"
      aria-label={`Behaviour compass. ${summary}. Primary style ${dimensionMeta[primary].label}${secondary ? `, secondary ${dimensionMeta[secondary].label}` : ""}.`}
      className={cn("h-auto w-full", className)}
    >
      <title>Behaviour Compass</title>

      {/* orientation ring — a quiet dotted track behind everything */}
      <circle
        cx={C}
        cy={C}
        r={INNER_R + BAND_MAX + 8}
        fill="none"
        stroke="var(--color-hairline)"
        strokeWidth={1}
        strokeDasharray="1.5 7"
        strokeLinecap="round"
      />

      {/* four score-reaching segment bands */}
      {DIMENSIONS.map((dim, index) => {
        const { thickness, rMid } = bandFor(dim);
        const centre = QUADRANT_ANGLE[dim];
        const isPrimary = dim === primary;
        const isSecondary = dim === secondary;
        const opacity = isPrimary ? 0.95 : isSecondary ? 0.58 : 0.24;
        return (
          <motion.path
            key={dim}
            d={arcPath(C, C, rMid, centre - QUADRANT_SWEEP / 2, centre + QUADRANT_SWEEP / 2)}
            fill="none"
            stroke={`var(--color-${dimensionMeta[dim].colorVar})`}
            strokeWidth={thickness}
            strokeLinecap="round"
            initial={reduced ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity, scale: 1 }}
            transition={{ duration: 0.55, delay: reduced ? 0 : 0.08 * index, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: `${C}px ${C}px` }}
          />
        );
      })}

      {/* letter chips riding each band */}
      {DIMENSIONS.map((dim) => {
        const { rMid } = bandFor(dim);
        const pos = polarPoint(C, C, rMid, QUADRANT_ANGLE[dim]);
        return (
          <g key={`chip-${dim}`}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={14}
              fill={`var(--color-${dimensionMeta[dim].colorVar})`}
              stroke="var(--color-paper)"
              strokeWidth={2.5}
            />
            <text
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={15}
              fontWeight={600}
              fill="var(--color-mineral)"
            >
              {dimensionMeta[dim].displayCode}
            </text>
          </g>
        );
      })}

      {/* quadrant labels — inside the viewBox, never clipped */}
      {DIMENSIONS.map((dim) => {
        const pos = polarPoint(C, C, INNER_R + BAND_MAX + 32, QUADRANT_ANGLE[dim]);
        const { score } = bandFor(dim);
        return (
          <text
            key={`label-${dim}`}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={19}
            fontWeight={600}
            fill="var(--color-ink)"
          >
            {dimensionMeta[dim].label}
            {showScores ? (
              <tspan
                x={pos.x}
                dy={22}
                fontSize={15}
                fontWeight={400}
                fill="var(--color-slate)"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {score}
              </tspan>
            ) : null}
          </text>
        );
      })}

      {/* blend needle, or the balance ring for even profiles */}
      {balanced ? (
        <circle
          cx={C}
          cy={C}
          r={INNER_R - 22}
          fill="none"
          stroke="var(--color-teal)"
          strokeWidth={2.5}
          strokeDasharray="3 8"
          strokeLinecap="round"
        />
      ) : (
        <motion.path
          d={needlePath()}
          fill="var(--color-botanical-deep)"
          initial={reduced ? false : { opacity: 0, rotate: -18 }}
          animate={{ opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 60, damping: 12, delay: reduced ? 0 : 0.35 }}
          style={{ transformOrigin: `${C}px ${C}px` }}
        />
      )}

      {/* hub */}
      <circle
        cx={C}
        cy={C}
        r={56}
        fill="var(--color-paper)"
        stroke="var(--color-hairline)"
        strokeWidth={1.5}
      />
      <text
        x={C}
        y={secondary || balanced ? C - 8 : C}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={44}
        fontWeight={600}
        fill={`var(--color-${dimensionMeta[primary].colorVar})`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {dimensionMeta[primary].displayCode}
      </text>
      {secondary ? (
        <text
          x={C}
          y={C + 26}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={16}
          fill="var(--color-slate)"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          + {dimensionMeta[secondary].displayCode}
        </text>
      ) : null}
      {balanced ? (
        <text
          x={C}
          y={C + 26}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={13}
          fill="var(--color-teal)"
          style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}
        >
          BALANCED
        </text>
      ) : null}
    </svg>
  );
}
