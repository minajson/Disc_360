/**
 * Wellbeing Pulse — questionnaire STRUCTURE.
 *
 * ─────────────────────────────────────────────────────────────────────
 * LICENSING — read before adding text to this file.
 *
 * The GHQ-12 item and response wording is copyright Goldberg & Williams and
 * is licensed commercially (GL Assessment). No verbatim item text, and no
 * verbatim response-option text, is committed here, because DISC360's
 * electronic-use right has not been evidenced in this repository.
 *
 * What IS committed is the part that carries no copyright: how many items
 * there are, that each has four ordered response positions, and what each
 * position scores. That is enough to build and fully test the scoring
 * engine, the threshold model, the history model and the analytics — which
 * is exactly the separation the build brief asks for.
 *
 * Licensed wording arrives later as a content migration that fills
 * `wellbeing_items.prompt` and `wellbeing_item_options.label` and flips the
 * version's `content_status` to 'licensed'. Nothing in this file, in the
 * scoring engine or in the schema changes when that happens.
 *
 * A version whose content_status is 'structure_only' can never be activated
 * for participants — the database enforces it. So the absence of licensed
 * text is a visible, honest product state, not a stub.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Response positions per item, always four, always in the published order. */
export const WELLBEING_RESPONSE_POSITIONS = 4;

/** Items per administration. */
export const WELLBEING_ITEM_COUNT = 12;

/**
 * Bimodal weights by response position — the primary screening method.
 *
 * 1st = 0 · 2nd = 0 · 3rd = 1 · 4th = 1, giving a 0–12 total.
 *
 * There is deliberately NO per-item reverse-scoring table. The published
 * response sets are already ordered from "no worse than usual" toward "worse
 * than usual", including for the positively-worded items, so applying a
 * reversal on top of that would double-count the wording and corrupt the
 * total. This is the single most common GHQ implementation error.
 */
export const BIMODAL_WEIGHTS: readonly number[] = [0, 0, 1, 1];

/**
 * Likert weights by response position — the secondary continuous measure.
 * 0-1-2-3 across four positions, giving a 0–36 range. Research/trend use
 * only: it never sets the screening threshold and is not shown to
 * participants or to management analytics by default.
 */
export const LIKERT_WEIGHTS: readonly number[] = [0, 1, 2, 3];

export interface WellbeingItemStructure {
  /** Stable key. Never renumbered — history joins on it. */
  externalId: string;
  /** 0-based order of administration within the version. */
  position: number;
}

/**
 * The twelve item slots, in published order.
 *
 * Ordering is preserved exactly: `item_01` is the first administered item and
 * index 0 of every stored `item_positions` array. Reordering these would
 * silently re-interpret every historical result, so the order is part of the
 * questionnaire version, not a presentation choice.
 */
export const WELLBEING_ITEM_STRUCTURE: readonly WellbeingItemStructure[] =
  Array.from({ length: WELLBEING_ITEM_COUNT }, (_, index) => ({
    externalId: `item_${String(index + 1).padStart(2, "0")}`,
    position: index,
  }));

/** The questionnaire this structure describes, for the record. */
export const WELLBEING_QUESTIONNAIRE_CODE = "ghq12";

/** Version number seeded by the Phase B migration. */
export const WELLBEING_QUESTIONNAIRE_VERSION = 1;
