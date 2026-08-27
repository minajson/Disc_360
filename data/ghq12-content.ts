/**
 * GHQ-12 — questionnaire content, transcribed from the supplied guide.
 *
 * ─────────────────────────────────────────────────────────────────────
 * SOURCE.
 *
 * `GHQ-12_Questionnaire_and_Assessment_Guide.pdf`, supplied by the product
 * owner as the authorised implementation source and confirmed by them as the
 * text to transcribe exactly.
 *
 * Every prompt and every anchor below is copied verbatim from that document.
 * Nothing is paraphrased, corrected, reordered or reconciled against any other
 * copy of GHQ-12.
 *
 * RECORDED DISCREPANCIES — reported, not silently resolved.
 *
 *   · The supplied guide carries no copyright line, publisher, edition or
 *     attribution statement. GHQ-12 is copyright Goldberg & Williams and is
 *     published under licence by GL Assessment, so an attribution string will
 *     have to come from the licence itself; there is none to transcribe here.
 *
 *   · Its interpretation section placed a score of 4 in two bands at once
 *     ("3–4 borderline" and "≥4 clinically significant"). The product owner
 *     resolved this to the 3/4 split — 0–3 and 4–12 — which is what
 *     `GHQ12_BAND_BOUNDARY` records.
 *
 * ANCHORS ARE PER ITEM, NOT SHARED.
 *
 * GHQ-12 does not use one response set. A positively-worded item runs
 * "Better than usual → Much less than usual"; a negatively-worded one runs
 * "Not at all → Much more than usual"; and several items vary the fourth
 * anchor again ("Much less capable", "Much less useful", "Much less happy").
 *
 * Storing a single shared set and reusing it would silently re-word two thirds
 * of the questionnaire. So each item carries its own four labels, in published
 * order, and the scoring weights attach to POSITION rather than to wording —
 * which is why no item needs reverse-scoring: every set is already ordered
 * from least to most reported difficulty.
 * ─────────────────────────────────────────────────────────────────────
 */

export const GHQ12_INSTRUMENT_KEY = "ghq12";
export const GHQ12_QUESTIONNAIRE_VERSION = 1;
export const GHQ12_ITEM_COUNT = 12;
export const GHQ12_RESPONSE_POSITIONS = 4;

export const GHQ12_SOURCE_DOCUMENT = "GHQ-12_Questionnaire_and_Assessment_Guide.pdf";

/** The instruction shown before the first item, verbatim. */
export const GHQ12_INSTRUCTIONS =
  "We would like to know if you have had any medical complaints and how your general health " +
  "has been over the past few weeks. Please answer ALL questions by selecting the answer that " +
  "most closely applies to you. Remember that we want to know about present or recent " +
  "complaints, not those that you had in the past.";

export const GHQ12_RECALL_WINDOW = "the past few weeks";

/**
 * Binary (GHQ) weights by position: 0-0-1-1, giving a 0–12 total.
 * Likert weights by position: 0-1-2-3, giving a 0–36 total.
 *
 * Both are transcribed from the guide's own per-cell annotations rather than
 * assumed from the method name, because the two are stated independently on
 * every row of the source table.
 */
export const GHQ12_BIMODAL_WEIGHTS: readonly number[] = [0, 0, 1, 1];
export const GHQ12_LIKERT_WEIGHTS: readonly number[] = [0, 1, 2, 3];

export const GHQ12_BIMODAL_MAX = 12;
export const GHQ12_LIKERT_MAX = 36;

/**
 * The cut-off, as resolved by the product owner.
 *
 * The supplied guide's bands overlapped at 4. The owner's decision is the 3/4
 * split: 0–3 is the lower band, 4 and above the upper one. Recorded as a
 * boundary rather than as prose so the bands cannot drift apart again.
 */
export const GHQ12_BAND_BOUNDARY = 4;

export interface Ghq12ItemContent {
  externalId: string;
  /** 0-based order of administration. */
  position: number;
  /** 1-based published item number. */
  number: number;
  prompt: string;
  /** Four labels in published order, position 0 → 3. */
  options: readonly string[];
}

export const GHQ12_ITEM_CONTENT: readonly Ghq12ItemContent[] = [
  {
    externalId: "item_01",
    position: 0,
    number: 1,
    prompt: "Been able to concentrate on whatever you're doing?",
    options: ["Better than usual", "Same as usual", "Less than usual", "Much less than usual"],
  },
  {
    externalId: "item_02",
    position: 1,
    number: 2,
    prompt: "Lost much sleep over worry?",
    options: ["Not at all", "No more than usual", "Rather more than usual", "Much more than usual"],
  },
  {
    externalId: "item_03",
    position: 2,
    number: 3,
    prompt: "Felt that you are playing a useful part in things?",
    options: ["More so than usual", "Same as usual", "Less useful than usual", "Much less useful"],
  },
  {
    externalId: "item_04",
    position: 3,
    number: 4,
    prompt: "Felt capable of making decisions about things?",
    options: ["More so than usual", "Same as usual", "Less so than usual", "Much less capable"],
  },
  {
    externalId: "item_05",
    position: 4,
    number: 5,
    prompt: "Felt constantly under strain?",
    options: ["Not at all", "No more than usual", "Rather more than usual", "Much more than usual"],
  },
  {
    externalId: "item_06",
    position: 5,
    number: 6,
    prompt: "Felt you couldn't overcome your difficulties?",
    options: ["Not at all", "No more than usual", "Rather more than usual", "Much more than usual"],
  },
  {
    externalId: "item_07",
    position: 6,
    number: 7,
    prompt: "Been able to enjoy your normal day-to-day activities?",
    options: ["More so than usual", "Same as usual", "Less so than usual", "Much less than usual"],
  },
  {
    externalId: "item_08",
    position: 7,
    number: 8,
    prompt: "Been able to face up to your problems?",
    options: ["More so than usual", "Same as usual", "Less so than usual", "Much less than usual"],
  },
  {
    externalId: "item_09",
    position: 8,
    number: 9,
    prompt: "Been feeling unhappy and depressed?",
    options: ["Not at all", "No more than usual", "Rather more than usual", "Much more than usual"],
  },
  {
    externalId: "item_10",
    position: 9,
    number: 10,
    prompt: "Been losing confidence in yourself?",
    options: ["Not at all", "No more than usual", "Rather more than usual", "Much more than usual"],
  },
  {
    externalId: "item_11",
    position: 10,
    number: 11,
    prompt: "Been thinking of yourself as a worthless person?",
    options: ["Not at all", "No more than usual", "Rather more than usual", "Much more than usual"],
  },
  {
    externalId: "item_12",
    position: 11,
    number: 12,
    prompt: "Been feeling reasonably happy, all things considered?",
    // "About same as usual" — the only item that words position 1 this way.
    // Transcribed as printed rather than normalised to "Same as usual".
    options: ["More so than usual", "About same as usual", "Less so than usual", "Much less happy"],
  },
];
