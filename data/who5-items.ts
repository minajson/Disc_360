/**
 * WHO-5 Well-Being Index — questionnaire content and structure.
 *
 * ─────────────────────────────────────────────────────────────────────
 * SOURCE, VERIFIED.
 *
 * World Health Organization. The World Health Organization-Five Well-Being
 * Index (WHO-5). Geneva: World Health Organization; 2024.
 * Document WHO/UCN/MSD/MHE/2024.1. Licence: CC BY-NC-SA 3.0 IGO.
 * https://www.who.int/publications/m/item/WHO-UCN-MSD-MHE-2024.01
 *
 * The wording below is reproduced VERBATIM from that publication. It is not
 * paraphrased, not assembled from secondary websites, and shares no wording
 * with GHQ-12, GHQ-28 or the DISC360 Wellbeing Pulse.
 *
 * LICENSING.
 *
 * CC BY-NC-SA 3.0 IGO permits copying and redistribution for NON-COMMERCIAL
 * purposes with attribution. Two conditions shape how this file may be used:
 *
 *   · NonCommercial — DISC360's recorded use is `internal_noncommercial`, and
 *     `canServeToParticipants` refuses to serve WHO-5 to an organisation not
 *     carrying that classification. The gate is the licence, expressed in code.
 *
 *   · ShareAlike — applies to ADAPTATIONS. Reproducing the instrument exactly,
 *     as here, is not an adaptation. Rewording an item would be, and would
 *     oblige DISC360 to license that adaptation under the same or an
 *     equivalent Creative Commons licence. So the items are never edited: a
 *     translation or variant belongs in its own file with its own licence
 *     note, never as a quiet edit to these strings.
 *
 * The publication states that use of the WHO logo is not permitted and that
 * nothing may suggest WHO endorses any specific organization, product or
 * service. No WHO logo appears anywhere in this product, and the required
 * non-endorsement statement lives in the instrument registry and renders
 * wherever WHO-5 content or results appear.
 * ─────────────────────────────────────────────────────────────────────
 */

export const WHO5_INSTRUMENT_KEY = "who5";
export const WHO5_QUESTIONNAIRE_VERSION = 1;
export const WHO5_ITEM_COUNT = 5;

/** The publication's citation, rendered wherever the instrument is identified. */
export const WHO5_SOURCE_CITATION =
  "World Health Organization. The World Health Organization-Five Well-Being Index (WHO-5). " +
  "Geneva: World Health Organization; 2024. Licence: CC BY-NC-SA 3.0 IGO.";

export const WHO5_SOURCE_DOCUMENT = "WHO/UCN/MSD/MHE/2024.1";
export const WHO5_SOURCE_URL =
  "https://www.who.int/publications/m/item/WHO-UCN-MSD-MHE-2024.01";

/** The respondent-facing instruction, verbatim. */
export const WHO5_STEM =
  "Please indicate for each of the five statements which is closest to how you have been " +
  "feeling over the last two weeks. Notice that higher numbers mean better well-being.";

/** The worked example the publication prints beneath the instruction, verbatim. */
export const WHO5_EXAMPLE =
  "Example. If you have felt cheerful and in good spirits more than half of the time during " +
  "the last two weeks, select number three.";

/** The recall window every item is answered against. */
export const WHO5_RECALL_WINDOW = "the last two weeks";

/**
 * Six ordered response positions, scored 0–5.
 *
 * Stored in ASCENDING point order — position 0 is the lowest frequency and
 * scores 0, position 5 is the highest and scores 5. The publication's table
 * prints them in the opposite direction (highest frequency in the leftmost
 * column); that is a layout choice, and the points attached to each anchor are
 * identical either way. Storing them ascending keeps position and points in
 * step, so a stored position can never be read as the wrong anchor.
 *
 * Every item is positively worded, so a higher position always means more
 * reported wellbeing. There is no reverse-scoring anywhere in WHO-5.
 */
export const WHO5_RESPONSE_POSITIONS = 6;
export const WHO5_POINTS_BY_POSITION: readonly number[] = [0, 1, 2, 3, 4, 5];

export interface Who5ResponseOption {
  /** 0-based, ascending with points. */
  position: number;
  /** Verbatim anchor wording. */
  label: string;
  points: number;
}

export const WHO5_RESPONSE_OPTIONS: readonly Who5ResponseOption[] = [
  { position: 0, label: "At no time", points: 0 },
  { position: 1, label: "Some of the time", points: 1 },
  { position: 2, label: "Less than half of the time", points: 2 },
  { position: 3, label: "More than half of the time", points: 3 },
  { position: 4, label: "Most of the time", points: 4 },
  { position: 5, label: "All of the time", points: 5 },
];

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

/**
 * The cut-off the publication comments on, recorded as METADATA rather than
 * applied as a rule.
 *
 * Quoting the source: a percentage score below 50 (or a raw score below 13)
 * "has been suggested as a cut-off for poor mental well-being and as an
 * indication for further assessment for the possible presence of a mental
 * health condition". Two things follow, and both are load-bearing:
 *
 *   · It is a SUGGESTED cut-off for further assessment, not a diagnosis and
 *     not a finding. Anything rendered from it says so.
 *   · It belongs to the instrument's documentation, not to DISC360's
 *     interpretation. It is presented with its source attached, separated from
 *     the score itself, so a reader can tell the measurement from the comment
 *     on the measurement.
 */
export const WHO5_SUGGESTED_CUTOFF_PERCENTAGE = 50;
export const WHO5_SUGGESTED_CUTOFF_RAW = 13;

export interface Who5ItemStructure {
  externalId: string;
  /** 0-based order of administration. */
  position: number;
  /** 1-based published item number. */
  number: number;
  /** Verbatim item wording. */
  prompt: string;
}

export const WHO5_ITEM_STRUCTURE: readonly Who5ItemStructure[] = [
  {
    externalId: "who5_item_01",
    position: 0,
    number: 1,
    prompt: "I have felt cheerful and in good spirits",
  },
  {
    externalId: "who5_item_02",
    position: 1,
    number: 2,
    prompt: "I have felt calm and relaxed",
  },
  {
    externalId: "who5_item_03",
    position: 2,
    number: 3,
    prompt: "I have felt active and vigorous",
  },
  {
    externalId: "who5_item_04",
    position: 3,
    number: 4,
    prompt: "I woke up feeling fresh and rested",
  },
  {
    externalId: "who5_item_05",
    position: 4,
    number: 5,
    prompt: "My daily life has been filled with things that interest me",
  },
];
