/**
 * GHQ-28 — questionnaire STRUCTURE.
 *
 * ─────────────────────────────────────────────────────────────────────
 * LICENSING — read before adding text to this file.
 *
 * GHQ-28 item and response wording is copyright Goldberg & Hillier and is
 * licensed commercially (GL Assessment). No verbatim wording is committed
 * here, because DISC360's digital-use rights are still being pursued.
 *
 * What IS committed carries no copyright: that there are 28 items, that each
 * has four ordered response positions, what each position scores, and which
 * seven-item block each item belongs to. That is enough to build and fully
 * test the engine, the subscale profile, the history model and the analytics.
 * ─────────────────────────────────────────────────────────────────────
 */

export const GHQ28_INSTRUMENT_KEY = "ghq28";
export const GHQ28_QUESTIONNAIRE_VERSION = 1;
export const GHQ28_ITEM_COUNT = 28;
export const GHQ28_RESPONSE_POSITIONS = 4;

/**
 * Bimodal weights by response position — the primary screening method.
 * 1st = 0 · 2nd = 0 · 3rd = 1 · 4th = 1, giving a 0–28 total.
 *
 * No per-item reverse-scoring, for the same reason as GHQ-12: the published
 * response sets are already ordered from "no worse than usual" toward "worse
 * than usual" on every item.
 */
export const GHQ28_BIMODAL_WEIGHTS: readonly number[] = [0, 0, 1, 1];

/** Likert weights — the secondary continuous measure, 0–84 across 28 items. */
export const GHQ28_LIKERT_WEIGHTS: readonly number[] = [0, 1, 2, 3];

export type Ghq28SubscaleKey =
  | "somatic"
  | "anxiety_insomnia"
  | "social_dysfunction"
  | "severe_depression";

export interface Ghq28SubscaleStructure {
  key: Ghq28SubscaleKey;
  label: string;
  /** 1-based inclusive, as published. */
  itemRange: [number, number];
  position: number;
}

/**
 * The four published seven-item blocks.
 *
 * They are PROFILE DIMENSIONS and nothing more. Each is deliberately given no
 * threshold of its own: a "severe depression subscale score of 5" is not a
 * finding, and the schema and engine both refuse to produce one.
 */
export const GHQ28_SUBSCALE_STRUCTURE: readonly Ghq28SubscaleStructure[] = [
  { key: "somatic", label: "Somatic symptoms", itemRange: [1, 7], position: 0 },
  { key: "anxiety_insomnia", label: "Anxiety / insomnia", itemRange: [8, 14], position: 1 },
  { key: "social_dysfunction", label: "Social dysfunction", itemRange: [15, 21], position: 2 },
  { key: "severe_depression", label: "Severe depression", itemRange: [22, 28], position: 3 },
];

export const GHQ28_SUBSCALE_ITEM_COUNT = 7;
/** Bimodal maximum per subscale. */
export const GHQ28_SUBSCALE_MAX_BIMODAL = 7;
/** Likert maximum per subscale. */
export const GHQ28_SUBSCALE_MAX_LIKERT = 21;

export interface Ghq28ItemStructure {
  externalId: string;
  /** 0-based order of administration. */
  position: number;
  /** 1-based published item number. */
  number: number;
  subscale: Ghq28SubscaleKey;
}

/** Which seven-item block a 1-based item number belongs to. */
export function subscaleForItemNumber(itemNumber: number): Ghq28SubscaleKey {
  const found = GHQ28_SUBSCALE_STRUCTURE.find(
    (subscale) => itemNumber >= subscale.itemRange[0] && itemNumber <= subscale.itemRange[1],
  );
  if (!found) throw new RangeError(`GHQ-28 item number out of range: ${itemNumber}`);
  return found.key;
}

/**
 * The twenty-eight item slots, in published order.
 *
 * Ordering is part of the version: item 1 is the first administered item and
 * index 0 of every stored `item_positions` array, and the subscale mapping is
 * derived from that order.
 */
export const GHQ28_ITEM_STRUCTURE: readonly Ghq28ItemStructure[] = Array.from(
  { length: GHQ28_ITEM_COUNT },
  (_, index) => {
    const number = index + 1;
    return {
      externalId: `ghq28_item_${String(number).padStart(2, "0")}`,
      position: index,
      number,
      subscale: subscaleForItemNumber(number),
    };
  },
);
