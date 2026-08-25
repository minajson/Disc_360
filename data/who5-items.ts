/**
 * WHO-5 Well-Being Index — questionnaire STRUCTURE.
 *
 * ─────────────────────────────────────────────────────────────────────
 * LICENSING AND ATTRIBUTION.
 *
 * The WHO-5 is © World Health Organization, available under CC BY-NC-SA 3.0
 * IGO. DISC360's intended use is internal and non-commercial.
 *
 * Even so, no verbatim item wording is committed here. The licence permits
 * reuse with attribution and share-alike terms; committing the text is an
 * irreversible act that should follow a positive confirmation of the exact
 * source version and its licence, not precede it. The structure below carries
 * no copyright and is enough to build and test everything else.
 *
 * The required attribution — including the explicit statement that WHO does
 * not endorse this product — lives in the instrument registry and is rendered
 * wherever WHO-5 results appear.
 * ─────────────────────────────────────────────────────────────────────
 */

export const WHO5_INSTRUMENT_KEY = "who5";
export const WHO5_QUESTIONNAIRE_VERSION = 1;
export const WHO5_ITEM_COUNT = 5;

/**
 * Six ordered response positions, scored 0–5.
 *
 * The published scale runs from "at no time" (0) to "all of the time" (5).
 * Every item is positively worded, so a higher position always means more
 * reported wellbeing and there is no reverse-scoring anywhere.
 */
export const WHO5_RESPONSE_POSITIONS = 6;
export const WHO5_POINTS_BY_POSITION: readonly number[] = [0, 1, 2, 3, 4, 5];

/** Raw total across five items. */
export const WHO5_RAW_MAX = WHO5_ITEM_COUNT * 5;

/**
 * The official transformation: raw × 4, giving a 0–100 percentage scale.
 *
 * This is the WHO-5's own documented scoring, not a DISC360 normalisation —
 * which is why it is a multiplication by 4 rather than the (raw/max)*100
 * formula used by the DISC360 Wellbeing Index. The two produce different
 * numbers from the same shape of data, and conflating them would be wrong.
 */
export const WHO5_TRANSFORM_MULTIPLIER = 4;

export interface Who5ItemStructure {
  externalId: string;
  /** 0-based order of administration. */
  position: number;
  /** 1-based published item number. */
  number: number;
}

export const WHO5_ITEM_STRUCTURE: readonly Who5ItemStructure[] = Array.from(
  { length: WHO5_ITEM_COUNT },
  (_, index) => ({
    externalId: `who5_item_${String(index + 1).padStart(2, "0")}`,
    position: index,
    number: index + 1,
  }),
);
