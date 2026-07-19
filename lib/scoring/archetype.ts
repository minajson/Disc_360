import {
  DIMENSION_KEY,
  DIMENSIONS,
  type ArchetypeCode,
  type Dimension,
  type DiscScores,
} from "../types/index.ts";

/**
 * Archetype derivation — deterministic, unit-tested. Thresholds are part
 * of the scoring contract documented in CLAUDE.md:
 *
 * 1. Balanced when max − min ≤ BALANCED_SPREAD.
 * 2. Pure when top1 − top2 ≥ PURE_GAP.
 * 3. Otherwise a primary+secondary pair; D↔S and I↔C are behavioral
 *    opposites and never form a pair — the third-ranked dimension is
 *    substituted when it sits within DIAGONAL_WINDOW of the second,
 *    else the archetype falls back to the pure primary.
 *
 * Dimension sort tie-break is D → I → S → C.
 */

export const BALANCED_SPREAD = 12;
export const PURE_GAP = 15;
export const DIAGONAL_WINDOW = 8;

/** Behavioural opposites — D↔S and I↔C never pair in an archetype. */
export const OPPOSITE: Record<Dimension, Dimension> = {
  D: "S",
  S: "D",
  I: "C",
  C: "I",
};

export interface ArchetypeDerivation {
  code: ArchetypeCode;
  primary: Dimension;
  secondary: Dimension | null;
}

/** Internal dimension key → user-facing letter. Analytical displays as "A". */
const DISPLAY_LETTER: Record<Dimension, string> = {
  D: "D",
  I: "I",
  S: "S",
  C: "A",
};

/**
 * User-facing hybrid type: the two highest dimensions in display letters,
 * highest first — DI, DS, DA, IS, IA, SA and their reverses.
 *
 * This is deliberately NOT `archetypeCode`. The archetype is a psychometric
 * reading that suppresses behavioural opposites (D↔S, I↔C never pair) and
 * collapses to a single letter when one dimension dominates, so it cannot
 * express DS or IA. The hybrid type answers the plainer question "which two
 * scored highest?" and always returns two letters. Both are derived from the
 * same `rankDimensions` ordering, so they can never disagree about which
 * dimension is primary.
 */
export function deriveHybridType(normalized: DiscScores): string {
  const ranked = rankDimensions(normalized);
  const [first, second] = ranked as [Dimension, Dimension];
  return `${DISPLAY_LETTER[first]}${DISPLAY_LETTER[second]}`;
}

/** Dimensions sorted by score descending; ties resolve in D→I→S→C order. */
export function rankDimensions(normalized: DiscScores): Dimension[] {
  return [...DIMENSIONS].sort((a, b) => {
    const diff = normalized[DIMENSION_KEY[b]] - normalized[DIMENSION_KEY[a]];
    if (diff !== 0) return diff;
    return DIMENSIONS.indexOf(a) - DIMENSIONS.indexOf(b);
  });
}

export function deriveArchetype(normalized: DiscScores): ArchetypeDerivation {
  const ranked = rankDimensions(normalized);
  const [first, second, third] = ranked as [Dimension, Dimension, Dimension];
  const score = (dim: Dimension) => normalized[DIMENSION_KEY[dim]];

  const max = score(first);
  const min = score(ranked[3] as Dimension);

  if (max - min <= BALANCED_SPREAD) {
    return { code: "BAL", primary: first, secondary: null };
  }

  if (score(first) - score(second) >= PURE_GAP) {
    return { code: first, primary: first, secondary: null };
  }

  let secondary: Dimension | null = second;
  if (OPPOSITE[first] === second) {
    secondary =
      score(second) - score(third) <= DIAGONAL_WINDOW ? third : null;
  }

  if (!secondary) {
    return { code: first, primary: first, secondary: null };
  }

  return {
    code: `${first}${secondary}` as ArchetypeCode,
    primary: first,
    secondary,
  };
}
