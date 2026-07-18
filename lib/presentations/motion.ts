import type { Transition, Variants } from "framer-motion";

/**
 * Presentation motion system.
 *
 * A small set of reusable presets so motion reads as one language across every
 * deck: motion supports meaning, it does not decorate. Durations follow the
 * house scale — standard 350–600ms, section 600–900ms, ambient very slow.
 *
 * These are plain data (variants + transitions), deterministic and free of
 * randomness or time, so visual-regression screenshots are stable. Components
 * decide whether to apply them via `presetsForMotion(reduced)`: under
 * prefers-reduced-motion every preset collapses to a simple, instant-content
 * fade with no travel, scale or draw.
 */

// The house easing curve, shared with the marketing motion components.
export const PRESENTATION_EASE = [0.22, 1, 0.36, 1] as const;

export const DURATION = {
  /** Standard element transition. */
  standard: 0.5,
  /** Major section transition (slide change). */
  section: 0.75,
  /** Ambient background motion — very slow. */
  ambient: 18,
} as const;

const baseTransition: Transition = {
  duration: DURATION.standard,
  ease: PRESENTATION_EASE,
};

/* ── Presets ──────────────────────────────────────────────────────────
 * Each is a `Variants` object with `hidden` / `visible` (and some a `draw`),
 * plus a matching transition. Reduced-motion variants are content-identical
 * but strip travel, scale and path-draw so nothing moves.
 */

export interface MotionPreset {
  variants: Variants;
  transition: Transition;
}

export type PresetName =
  | "fadeUp"
  | "softScale"
  | "lineDraw"
  | "chartReveal"
  | "maskReveal"
  | "crossfade";

const FULL_PRESETS: Record<PresetName, MotionPreset> = {
  // Soft fade with a slight vertical reveal.
  fadeUp: {
    variants: {
      hidden: { opacity: 0, y: 24 },
      visible: { opacity: 1, y: 0 },
    },
    transition: baseTransition,
  },
  // Gentle scale-in for a focal element.
  softScale: {
    variants: {
      hidden: { opacity: 0, scale: 0.96 },
      visible: { opacity: 1, scale: 1 },
    },
    transition: baseTransition,
  },
  // Line / path draw-in via pathLength (applied to <path> / <line>).
  lineDraw: {
    variants: {
      hidden: { pathLength: 0, opacity: 0 },
      visible: { pathLength: 1, opacity: 1 },
    },
    transition: { duration: 0.9, ease: PRESENTATION_EASE },
  },
  // Chart bars / points growing from their baseline.
  chartReveal: {
    variants: {
      hidden: { opacity: 0, scaleY: 0 },
      visible: { opacity: 1, scaleY: 1 },
    },
    transition: { duration: DURATION.section, ease: PRESENTATION_EASE },
  },
  // Controlled mask reveal — content wiped in from the leading edge.
  maskReveal: {
    variants: {
      hidden: { clipPath: "inset(0 100% 0 0)" },
      visible: { clipPath: "inset(0 0% 0 0)" },
    },
    transition: { duration: DURATION.section, ease: PRESENTATION_EASE },
  },
  // Clean crossfade for section transitions.
  crossfade: {
    variants: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    },
    transition: { duration: DURATION.section, ease: PRESENTATION_EASE },
  },
};

// Reduced motion: identical states, but every preset becomes a plain opacity
// fade with no travel/scale/draw. Content is always immediately readable.
const REDUCED_FADE: MotionPreset = {
  variants: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  transition: { duration: 0.001 },
};

const REDUCED_PRESETS: Record<PresetName, MotionPreset> = {
  fadeUp: REDUCED_FADE,
  softScale: REDUCED_FADE,
  // lineDraw/chartReveal still need their end-state geometry, just no animation.
  lineDraw: {
    variants: { hidden: { pathLength: 1, opacity: 1 }, visible: { pathLength: 1, opacity: 1 } },
    transition: { duration: 0.001 },
  },
  chartReveal: {
    variants: { hidden: { opacity: 1, scaleY: 1 }, visible: { opacity: 1, scaleY: 1 } },
    transition: { duration: 0.001 },
  },
  maskReveal: {
    variants: { hidden: { clipPath: "inset(0 0% 0 0)" }, visible: { clipPath: "inset(0 0% 0 0)" } },
    transition: { duration: 0.001 },
  },
  crossfade: REDUCED_FADE,
};

/** All presets for the current motion preference. */
export function presetsForMotion(reduced: boolean): Record<PresetName, MotionPreset> {
  return reduced ? REDUCED_PRESETS : FULL_PRESETS;
}

/** A single preset for the current motion preference. */
export function preset(name: PresetName, reduced: boolean): MotionPreset {
  return presetsForMotion(reduced)[name];
}

/**
 * Stagger container for revealing a small group one item at a time. Kept gentle
 * — never every object individually, just short lists (words, dimensions).
 */
export function staggerContainer(reduced: boolean, stagger = 0.12): Variants {
  return {
    hidden: {},
    visible: {
      transition: reduced ? { staggerChildren: 0 } : { staggerChildren: stagger },
    },
  };
}

/**
 * Slide-change transition. A crossfade with a whisper of vertical travel at
 * full motion; a pure crossfade when reduced.
 */
export function slideTransition(reduced: boolean): MotionPreset {
  if (reduced) return REDUCED_FADE;
  return {
    variants: {
      hidden: { opacity: 0, y: 12 },
      visible: { opacity: 1, y: 0 },
    },
    transition: { duration: DURATION.section, ease: PRESENTATION_EASE },
  };
}
