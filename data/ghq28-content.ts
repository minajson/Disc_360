/**
 * GHQ-28 — questionnaire content, transcribed from the supplied guide.
 *
 * ─────────────────────────────────────────────────────────────────────
 * SOURCE.
 *
 * `GHQ-28_Questionnaire_and_Assessment_Guide.pdf`, supplied by the product
 * owner as the authorised implementation source and confirmed by them as the
 * text to transcribe exactly. Every prompt and anchor is verbatim.
 *
 * The structure agrees with what was already built: 28 items, four positions,
 * binary 0-0-1-1 → 0–28, Likert 0-1-2-3 → 0–84, and four seven-item subscales
 * covering items 1–7, 8–14, 15–21 and 22–28. Nothing in `ghq28-items.ts`
 * changes; this file supplies only the wording it deliberately withheld.
 *
 * RECORDED DISCREPANCIES — reported, not silently resolved.
 *
 *   · The guide carries no copyright line, publisher, edition or attribution
 *     statement. GHQ-28 is copyright Goldberg & Hillier, published under
 *     licence by GL Assessment, so the attribution string must come from the
 *     licence; there is none in the document to transcribe.
 *
 *   · The guide states a binary cut-off of "4 or more". The product owner
 *     confirmed 5 instead — the 4/5 split already configured in the registry —
 *     so the guide's stated cut-off is NOT what this implementation uses. That
 *     divergence is deliberate and is recorded here so nobody later "fixes"
 *     the registry to match the document.
 *
 * ANCHORS ARE PER SECTION.
 *
 * Each of the four sections uses its own response set, and two of them are
 * worded in opposite directions:
 *
 *   A · Somatic          Better than usual → Much worse than usual
 *   B · Anxiety/insomnia Not at all        → Much more than usual
 *   C · Social           More so than usual → Much less than usual
 *   D · Depression       Not at all        → Much more than usual
 *
 * As with GHQ-12, weights attach to POSITION, and every set is already ordered
 * from least to most reported difficulty — so no item is reverse-scored.
 *
 * SECTION D CONTAINS SUICIDALITY ITEMS.
 *
 * D3, D4, D6 and D7 ask directly about not wanting to live. That is a fact
 * about the instrument, not a decision this file makes, and it drives a
 * participant-facing safeguard elsewhere in the product: see
 * `GHQ28_SECTION_D_ITEM_IDS`, which exists so that safeguard can identify
 * those items without pattern-matching on their wording.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { Ghq28SubscaleKey } from "./ghq28-items.ts";

export const GHQ28_SOURCE_DOCUMENT = "GHQ-28_Questionnaire_and_Assessment_Guide.pdf";

/** The instruction shown before the first item, verbatim. */
export const GHQ28_INSTRUCTIONS =
  "Please read this carefully. We should like to know if you have had any medical complaints " +
  "and how your health has been in general, over the past few weeks. Please answer ALL the " +
  "questions on the following pages simply by underlining or ticking the answer which you " +
  "think most nearly applies to you. Remember that we want to know about present and recent " +
  "complaints, not those you had in the past.";

export const GHQ28_RECALL_WINDOW = "the past few weeks";

/**
 * The binary cut-off this implementation uses.
 *
 * FIVE, not the "4 or more" printed in the supplied guide. Confirmed by the
 * product owner as the 4/5 split, matching the value already in the registry.
 */
export const GHQ28_BAND_BOUNDARY = 5;

/** Response anchors by section, in published order, position 0 → 3. */
export const GHQ28_SECTION_OPTIONS: Record<Ghq28SubscaleKey, readonly string[]> = {
  somatic: ["Better than usual", "Same as usual", "Worse than usual", "Much worse than usual"],
  anxiety_insomnia: [
    "Not at all",
    "No more than usual",
    "Rather more than usual",
    "Much more than usual",
  ],
  social_dysfunction: [
    "More so than usual",
    "Same as usual",
    "Less so than usual",
    "Much less than usual",
  ],
  severe_depression: [
    "Not at all",
    "No more than usual",
    "Rather more than usual",
    "Much more than usual",
  ],
};

export interface Ghq28ItemContent {
  externalId: string;
  /** 0-based order of administration. */
  position: number;
  /** 1-based published item number, 1–28. */
  number: number;
  /** The guide's own label — A1…A7, B1…B7, C1…C7, D1…D7. */
  code: string;
  subscale: Ghq28SubscaleKey;
  prompt: string;
}

export const GHQ28_ITEM_CONTENT: readonly Ghq28ItemContent[] = [
  /* ── Section A · Somatic Symptoms ─────────────────────────────────── */
  { externalId: "ghq28_item_01", position: 0, number: 1, code: "A1", subscale: "somatic",
    prompt: "Been feeling perfectly well and in good health?" },
  { externalId: "ghq28_item_02", position: 1, number: 2, code: "A2", subscale: "somatic",
    prompt: "Been feeling in need of a good tonic?" },
  { externalId: "ghq28_item_03", position: 2, number: 3, code: "A3", subscale: "somatic",
    prompt: "Been feeling run down and out of sorts?" },
  { externalId: "ghq28_item_04", position: 3, number: 4, code: "A4", subscale: "somatic",
    prompt: "Felt that you are ill at all?" },
  { externalId: "ghq28_item_05", position: 4, number: 5, code: "A5", subscale: "somatic",
    prompt: "Been getting any pains in your head?" },
  { externalId: "ghq28_item_06", position: 5, number: 6, code: "A6", subscale: "somatic",
    prompt: "Been getting a feeling of tightness or pressure in your head?" },
  { externalId: "ghq28_item_07", position: 6, number: 7, code: "A7", subscale: "somatic",
    prompt: "Been having hot or cold spells?" },

  /* ── Section B · Anxiety and Insomnia ─────────────────────────────── */
  { externalId: "ghq28_item_08", position: 7, number: 8, code: "B1", subscale: "anxiety_insomnia",
    prompt: "Lost much sleep over worry?" },
  { externalId: "ghq28_item_09", position: 8, number: 9, code: "B2", subscale: "anxiety_insomnia",
    prompt: "Had difficulty in staying asleep once you are off?" },
  { externalId: "ghq28_item_10", position: 9, number: 10, code: "B3", subscale: "anxiety_insomnia",
    prompt: "Felt constantly under strain?" },
  { externalId: "ghq28_item_11", position: 10, number: 11, code: "B4", subscale: "anxiety_insomnia",
    prompt: "Been getting edgy and bad-tempered?" },
  { externalId: "ghq28_item_12", position: 11, number: 12, code: "B5", subscale: "anxiety_insomnia",
    prompt: "Been getting scared or panicky for no good reason?" },
  { externalId: "ghq28_item_13", position: 12, number: 13, code: "B6", subscale: "anxiety_insomnia",
    prompt: "Found everything getting on top of you?" },
  { externalId: "ghq28_item_14", position: 13, number: 14, code: "B7", subscale: "anxiety_insomnia",
    prompt: "Been feeling nervous and strung-up all the time?" },

  /* ── Section C · Social Dysfunction ───────────────────────────────── */
  { externalId: "ghq28_item_15", position: 14, number: 15, code: "C1", subscale: "social_dysfunction",
    prompt: "Been managing to keep yourself busy and occupied?" },
  { externalId: "ghq28_item_16", position: 15, number: 16, code: "C2", subscale: "social_dysfunction",
    prompt: "Been taking longer over the things you do?" },
  { externalId: "ghq28_item_17", position: 16, number: 17, code: "C3", subscale: "social_dysfunction",
    prompt: "Felt on the whole you are doing things well?" },
  { externalId: "ghq28_item_18", position: 17, number: 18, code: "C4", subscale: "social_dysfunction",
    prompt: "Been satisfied with the way you've carried out your tasks?" },
  { externalId: "ghq28_item_19", position: 18, number: 19, code: "C5", subscale: "social_dysfunction",
    prompt: "Felt that you are playing a useful part in things?" },
  { externalId: "ghq28_item_20", position: 19, number: 20, code: "C6", subscale: "social_dysfunction",
    prompt: "Felt capable of making decisions about things?" },
  { externalId: "ghq28_item_21", position: 20, number: 21, code: "C7", subscale: "social_dysfunction",
    prompt: "Been able to enjoy your normal day-to-day activities?" },

  /* ── Section D · Severe Depression ────────────────────────────────── */
  { externalId: "ghq28_item_22", position: 21, number: 22, code: "D1", subscale: "severe_depression",
    prompt: "Thinking of yourself as a worthless person?" },
  { externalId: "ghq28_item_23", position: 22, number: 23, code: "D2", subscale: "severe_depression",
    prompt: "Felt that life is entirely hopeless?" },
  { externalId: "ghq28_item_24", position: 23, number: 24, code: "D3", subscale: "severe_depression",
    prompt: "Felt that life isn't worth living?" },
  { externalId: "ghq28_item_25", position: 24, number: 25, code: "D4", subscale: "severe_depression",
    prompt: "Thought of the possibility of doing away with yourself?" },
  { externalId: "ghq28_item_26", position: 25, number: 26, code: "D5", subscale: "severe_depression",
    prompt: "Found at times you couldn't do anything because your nerves were too bad?" },
  { externalId: "ghq28_item_27", position: 26, number: 27, code: "D6", subscale: "severe_depression",
    prompt: "Found yourself wishing you were dead and away from it all?" },
  { externalId: "ghq28_item_28", position: 27, number: 28, code: "D7", subscale: "severe_depression",
    prompt: "Found that the idea of taking your own life kept coming into your mind?" },
];

/**
 * The Section D items, identified by id rather than by wording.
 *
 * The participant-facing safeguard needs to know when one of these was
 * answered positively. Matching on prompt text would break the moment a
 * translation or a licence-mandated rewording arrived — and would break
 * silently, in the one place where failing silently is least acceptable.
 */
export const GHQ28_SECTION_D_ITEM_IDS: readonly string[] = GHQ28_ITEM_CONTENT.filter(
  (item) => item.subscale === "severe_depression",
).map((item) => item.externalId);
