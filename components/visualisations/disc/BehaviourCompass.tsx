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
 * between Dominant and Influence; a balanced profile shows a calm ring and a
 * BALANCED badge instead of a needle.
 *
 * Typography discipline: the hub never stacks free-floating text. The primary
 * letter is the only baseline-positioned glyph; secondary/balanced states are
 * rect-backed pill badges with explicit geometry, so nothing can collide on
 * any browser's baseline metrics. ViewBox-based SVG throughout — crisp at
 * card, retina and projector scale. All motion collapses under reduced-motion.
 *
 * `variant="concept"` renders the neutral instructional form used on the
 * introduction decks: four equal segments, no needle, no personal data.
 */

const VB = 440;
const C = VB / 2;
const INNER_R = 88;
const BAND_MIN = 22;
const BAND_MAX = 74;
/** Quadrant centre angles: D north-east, I south-east, S south-west, A north-west. */
const QUADRANT_ANGLE: Record<Dimension, number> = { D: -45, I: 45, S: 135, C: -135 };
const QUADRANT_SWEEP = 78;
const HUB_R = 54;

interface BehaviourCompassProps {
  scores: DiscScores;
  primary: Dimension;
  secondary?: Dimension | null;
  /**
   * The engine's Balanced determination (archetype BAL). Must come from the
   * scoring engine, never inferred here: a profile like S 56 / D 54 has a
   * near-zero blend vector (opposites cancel) yet is NOT balanced.
   */
  balanced?: boolean;
  /** "concept": the deck's neutral form — equal bands, no needle, no data. */
  variant?: "profile" | "concept";
  /** Show the numeric score under each label. */
  showScores?: boolean;
  className?: string;
}

export function BehaviourCompass({
  scores,
  primary,
  secondary = null,
  balanced: balancedProp = false,
  variant = "profile",
  showScores = true,
  className,
}: BehaviourCompassProps) {
  const reduced = useReducedMotion() ?? false;
  const concept = variant === "concept";

  const bandFor = (dim: Dimension) => {
    const score = concept ? 55 : scores[DIMENSION_KEY[dim]];
    const thickness = BAND_MIN + (score / 100) * (BAND_MAX - BAND_MIN);
    return { score, thickness, rMid: INNER_R + thickness / 2 };
  };

  // Needle: the archetype blend — primary pulled toward the secondary by
  // their score weights. The all-four vector sum is wrong here: behavioural
  // opposites cancel it out exactly when profiles are most interesting.
  const needleAngle = secondary
    ? blendDirection([
        { angleDeg: QUADRANT_ANGLE[primary], weight: scores[DIMENSION_KEY[primary]] },
        { angleDeg: QUADRANT_ANGLE[secondary], weight: scores[DIMENSION_KEY[secondary]] },
      ]).angleDeg
    : QUADRANT_ANGLE[primary];
  const balanced = !concept && balancedProp;
  const showNeedle = !concept && !balanced;

  const bandOpacity = (dim: Dimension) => {
    if (concept) return 0.82;
    // A balanced profile weights all four equally — a single saturated band
    // would visually contradict the BALANCED reading.
    if (balanced) return 0.6;
    if (dim === primary) return 0.95;
    if (dim === secondary) return 0.58;
    return 0.24;
  };

  const needlePath = () => {
    const a = needleAngle;
    const tip = polarPoint(C, C, INNER_R - 12, a);
    const left = polarPoint(C, C, 26, a - 13);
    const right = polarPoint(C, C, 26, a + 13);
    const tail = polarPoint(C, C, 10, a + 180);
    return `M ${tip.x} ${tip.y} L ${right.x} ${right.y} L ${tail.x} ${tail.y} L ${left.x} ${left.y} Z`;
  };

  // Hub badge (secondary style, or BALANCED) — a measured pill, never stacked
  // text, so baseline metrics can't produce overlap on any renderer.
  const badgeText = balanced ? "BALANCED" : secondary ? `+ ${dimensionMeta[secondary].displayCode}` : null;
  const showHubLetter = !balanced;
  const badgeColor = balanced
    ? "var(--color-teal)"
    : secondary
      ? `var(--color-${dimensionMeta[secondary].colorVar})`
      : "";
  const badgeWidth = badgeText ? badgeText.length * 7 + 18 : 0;
  const badgeCy = balanced ? C : C + 30;
  // The primary letter sits higher when a badge shares the hub.
  const letterBaselineY = badgeText ? C + 6 : C + 16;

  const summary = concept
    ? `Behaviour compass showing the four DISC dimensions: ${DIMENSIONS.map((d) => dimensionMeta[d].label).join(", ")}.`
    : `Behaviour compass. ${DIMENSIONS.map((dim) => `${dimensionMeta[dim].label} ${scores[DIMENSION_KEY[dim]]}`).join(", ")}. Primary style ${dimensionMeta[primary].label}${secondary ? `, secondary ${dimensionMeta[secondary].label}` : balanced ? ", balanced profile" : ""}.`;

  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      role="img"
      aria-label={summary}
      className={cn("h-auto w-full", className)}
    >
      <title>Behaviour Compass</title>

      {/* orientation ring */}
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
        const opacity = bandOpacity(dim);
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
              y={pos.y + 5.5}
              textAnchor="middle"
              fontSize={15}
              fontWeight={600}
              fill="var(--color-mineral)"
            >
              {dimensionMeta[dim].displayCode}
            </text>
          </g>
        );
      })}

      {/* quadrant labels */}
      {DIMENSIONS.map((dim) => {
        const pos = polarPoint(C, C, INNER_R + BAND_MAX + 32, QUADRANT_ANGLE[dim]);
        const { score } = bandFor(dim);
        return (
          <text
            key={`label-${dim}`}
            x={pos.x}
            y={pos.y + 6}
            textAnchor="middle"
            fontSize={19}
            fontWeight={600}
            fill="var(--color-ink)"
          >
            {dimensionMeta[dim].label}
            {!concept && showScores ? (
              <tspan
                x={pos.x}
                dy={21}
                fontSize={14}
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

      {/* blend needle, or the balance ring */}
      {balanced ? (
        <circle
          cx={C}
          cy={C}
          r={INNER_R - 20}
          fill="none"
          stroke="var(--color-teal)"
          strokeWidth={2.5}
          strokeDasharray="3 8"
          strokeLinecap="round"
        />
      ) : null}
      {showNeedle ? (
        <motion.path
          d={needlePath()}
          fill="var(--color-botanical-deep)"
          initial={reduced ? false : { opacity: 0, rotate: -18 }}
          animate={{ opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 60, damping: 12, delay: reduced ? 0 : 0.35 }}
          style={{ transformOrigin: `${C}px ${C}px` }}
        />
      ) : null}

      {/* hub */}
      <circle
        cx={C}
        cy={C}
        r={HUB_R}
        fill="var(--color-paper)"
        stroke="var(--color-hairline)"
        strokeWidth={1.5}
      />

      {concept ? (
        // Concept hub: the four display letters as a neutral 2×2 mark.
        <g style={{ fontFamily: "var(--font-display)" }}>
          {DIMENSIONS.map((dim) => {
            const dx = dim === "D" || dim === "C" ? -15 : 15;
            const dy = dim === "D" || dim === "I" ? -8 : 24;
            return (
              <text
                key={`hub-${dim}`}
                x={C + dx}
                y={C + dy}
                textAnchor="middle"
                fontSize={22}
                fontWeight={600}
                fill={`var(--color-${dimensionMeta[dim].colorVar})`}
              >
                {dimensionMeta[dim].displayCode}
              </text>
            );
          })}
        </g>
      ) : (
        <>
          {/* Single baseline-positioned glyph — nothing else shares its line. */}
          {showHubLetter ? (
          <text
            x={C}
            y={letterBaselineY}
            textAnchor="middle"
            fontSize={44}
            fontWeight={600}
            fill={`var(--color-${dimensionMeta[primary].colorVar})`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {dimensionMeta[primary].displayCode}
          </text>
          ) : null}
          {badgeText ? (
            <g>
              <rect
                x={C - badgeWidth / 2}
                y={badgeCy - 11}
                width={badgeWidth}
                height={22}
                rx={11}
                fill="var(--color-mineral)"
                stroke={badgeColor}
                strokeWidth={1.25}
              />
              <text
                x={C}
                y={badgeCy + 4}
                textAnchor="middle"
                fontSize={balanced ? 10.5 : 12.5}
                fontWeight={600}
                fill={badgeColor}
                style={{ fontFamily: "var(--font-mono)", letterSpacing: balanced ? "0.08em" : undefined }}
              >
                {badgeText}
              </text>
            </g>
          ) : null}
        </>
      )}
    </svg>
  );
}
