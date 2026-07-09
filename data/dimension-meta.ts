import type { Dimension } from "@/lib/types";

/**
 * Canonical user-facing metadata for the four DISC dimensions.
 * UI labels are mandatory: Dominant, Influence, Stable, Analytical —
 * never "Dominance", "Steadiness", or "Conscientiousness".
 */
export interface DimensionMeta {
  code: Dimension;
  /** Mandatory user-facing label. */
  label: string;
  /** One-line essence of the dimension. */
  essence: string;
  /** The core question this dimension answers about a person. */
  question: string;
  /** Behavioral signature at high expression. */
  high: string;
  /** Behavioral signature at low expression. */
  low: string;
  /** Under-pressure tendency. */
  underPressure: string;
  /** Tailwind color utility stems, e.g. text-disc-d / bg-disc-d. */
  colorVar: string;
}

export const dimensionMeta: Record<Dimension, DimensionMeta> = {
  D: {
    code: "D",
    label: "Dominant",
    essence: "Drive, decisiveness, and appetite for challenge.",
    question: "How do they approach problems and exercise power?",
    high: "Direct, results-first, comfortable with confrontation and fast calls.",
    low: "Measured, consensus-seeking, prefers calculated over bold moves.",
    underPressure: "Becomes blunt, impatient, and takes unilateral control.",
    colorVar: "disc-d",
  },
  I: {
    code: "I",
    label: "Influence",
    essence: "Energy, persuasion, and social momentum.",
    question: "How do they move people and shape the room?",
    high: "Expressive, optimistic, builds coalitions through enthusiasm.",
    low: "Reserved, data-over-charisma, persuades with substance.",
    underPressure: "Talks more than listens, overpromises, scatters focus.",
    colorVar: "disc-i",
  },
  S: {
    code: "S",
    label: "Stable",
    essence: "Consistency, patience, and steady support.",
    question: "How do they handle pace, change, and loyalty?",
    high: "Calm anchor, dependable, protects team cohesion and rhythm.",
    low: "Restless, variety-seeking, energized by shifting priorities.",
    underPressure: "Withdraws, avoids conflict, absorbs strain silently.",
    colorVar: "disc-s",
  },
  C: {
    code: "C",
    label: "Analytical",
    essence: "Precision, standards, and systematic thinking.",
    question: "How do they engage rules, quality, and evidence?",
    high: "Rigorous, detail-exact, decides on verified data and logic.",
    low: "Big-picture, tolerant of ambiguity, moves before every fact lands.",
    underPressure: "Over-analyzes, retreats into process, resists commitment.",
    colorVar: "disc-c",
  },
};

export const dimensionList: DimensionMeta[] = [
  dimensionMeta.D,
  dimensionMeta.I,
  dimensionMeta.S,
  dimensionMeta.C,
];
