import {
  INSTRUMENTS,
  type InstrumentKey,
  type InstrumentMetadata,
} from "../../data/wellbeing-instruments.ts";
import { GHQ28_SUBSCALE_STRUCTURE } from "../../data/ghq28-items.ts";
import {
  DISC360_WELLBEING_DIMENSIONS,
  DISC360_WELLBEING_INSTRUCTION,
  DISC360_WELLBEING_ITEMS,
  DISC360_WELLBEING_OPTIONS,
} from "../../data/disc360-wellbeing-items.ts";

/**
 * Management decision-support previews.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THESE ARE NOT ASSESSMENTS, AND THEY PRODUCE NOTHING THAT CAN BE STORED.
 *
 * Two kinds of preview exist so management can evaluate the product without
 * restricted content and without fabricating participant data:
 *
 *  1 · STRUCTURE PREVIEW — the shape of the questionnaire experience with the
 *      content slots left empty. Twelve or twenty-eight numbered steps, the
 *      right number of response options, the real layout and progression. It
 *      carries no wording, is not scorable, and has no submit path.
 *
 *  2 · ILLUSTRATIVE RESULT — a result screen drawn from explicit, hard-coded
 *      demo numbers. Every figure is labelled as illustrative, and nothing
 *      here is ever written to wellbeing_results.
 *
 * Both are PURE. They return plain data with no ids, no session, no profile
 * and no persistence hook, so there is nothing for a caller to accidentally
 * save. That is the safety property, not a convention.
 * ─────────────────────────────────────────────────────────────────────
 */

export const STRUCTURE_PREVIEW_BANNER = "STRUCTURE PREVIEW — NOT AN ACTIVE QUESTIONNAIRE";
export const ILLUSTRATIVE_BANNER = "ILLUSTRATIVE DEMO DATA";
export const CONTENT_PENDING_PLACEHOLDER = "[Question content available after licensing]";

/* ── structure preview ──────────────────────────────────────────────── */

export interface PreviewItem {
  /** 1-based published item number. */
  number: number;
  /** Real wording where the instrument owns its content; null otherwise. */
  prompt: string | null;
  /** Section heading, where the instrument groups items (GHQ-28). */
  sectionLabel: string | null;
  /** True when this item opens a new section. */
  startsSection: boolean;
}

export interface StructurePreview {
  instrumentKey: InstrumentKey;
  instrument: InstrumentMetadata;
  /** True only where the instrument's own wording is loaded. */
  contentAvailable: boolean;
  /** Shown above the items where the instrument carries one. */
  instruction: string | null;
  items: PreviewItem[];
  /** Real labels where content exists, generic placeholders otherwise. */
  optionLabels: string[];
  /** Always present for a content-free preview. */
  banner: string | null;
}

/**
 * Builds the wire preview for one instrument.
 *
 * For DISC360 Wellbeing — the one instrument whose content DISC360 owns — the
 * preview shows the real items, because there is nothing to withhold. For the
 * three third-party instruments it shows numbered slots and generic option
 * placeholders, which is what lets management judge length, progression and
 * mobile layout without any restricted wording existing in this repository.
 */
export function buildStructurePreview(instrumentKey: InstrumentKey): StructurePreview {
  const instrument = INSTRUMENTS[instrumentKey];
  const contentAvailable = instrumentKey === "disc360_wellbeing_v1";

  if (contentAvailable) {
    return {
      instrumentKey,
      instrument,
      contentAvailable: true,
      instruction: DISC360_WELLBEING_INSTRUCTION,
      items: DISC360_WELLBEING_ITEMS.map((item) => ({
        number: item.position + 1,
        prompt: item.prompt,
        sectionLabel: null,
        startsSection: false,
      })),
      optionLabels: DISC360_WELLBEING_OPTIONS.map((option) => option.label),
      banner: null,
    };
  }

  // Section headings only where the instrument publishes them. GHQ-28's four
  // seven-item blocks are part of its structure, so management can see the
  // shape; GHQ-12 and WHO-5 have none and get none invented for them.
  const sections =
    instrumentKey === "ghq28"
      ? GHQ28_SUBSCALE_STRUCTURE.map((subscale) => ({
          label: subscale.label,
          from: subscale.itemRange[0],
          to: subscale.itemRange[1],
        }))
      : [];

  const items: PreviewItem[] = Array.from({ length: instrument.itemCount }, (_, index) => {
    const number = index + 1;
    const section = sections.find((entry) => number >= entry.from && number <= entry.to);
    return {
      number,
      // Never a paraphrase, never a near-equivalent, never a placeholder that
      // reads like a question. An explicit statement that content is pending.
      prompt: null,
      sectionLabel: section?.label ?? null,
      startsSection: section ? section.from === number : false,
    };
  });

  return {
    instrumentKey,
    instrument,
    contentAvailable: false,
    instruction: null,
    items,
    optionLabels: Array.from(
      { length: instrument.responseOptionCount },
      (_, index) => `Response option ${index + 1}`,
    ),
    banner: STRUCTURE_PREVIEW_BANNER,
  };
}

/* ── illustrative result preview ────────────────────────────────────── */

export interface IllustrativeSubscore {
  key: string;
  label: string;
  /** On this sub-score's own scale. */
  value: number;
  max: number;
}

export interface IllustrativeResult {
  instrumentKey: InstrumentKey;
  instrument: InstrumentMetadata;
  banner: string;
  /** The headline figure, on the instrument's own primary scale. */
  headline: number;
  headlineMax: number;
  headlineLabel: string;
  /** Raw figure where the instrument normalises its headline. */
  rawScore: number | null;
  rawMax: number | null;
  /** Secondary stored measure, where the instrument has one. */
  secondaryLabel: string | null;
  secondaryValue: number | null;
  secondaryMax: number | null;
  /** Null where the instrument carries no threshold. */
  threshold: number | null;
  atOrAboveThreshold: boolean | null;
  /** Subscales (GHQ-28) or dimensions (DISC360). Empty otherwise. */
  subscores: IllustrativeSubscore[];
  /** Oldest first, on the primary scale, for the history chart. */
  history: { label: string; value: number }[];
}

/**
 * Explicit demo numbers, chosen once and hard-coded.
 *
 * Deliberately not generated: a preview that computed plausible-looking
 * figures would be indistinguishable from a real result, and the whole point
 * is that these are obviously and permanently synthetic.
 */
export function buildIllustrativeResult(instrumentKey: InstrumentKey): IllustrativeResult {
  const instrument = INSTRUMENTS[instrumentKey];
  const base = {
    instrumentKey,
    instrument,
    banner: ILLUSTRATIVE_BANNER,
    headlineLabel: instrument.primaryScoreLabel,
    headlineMax: instrument.primaryScoreMax,
  };

  switch (instrumentKey) {
    case "ghq12":
      return {
        ...base,
        headline: 4,
        rawScore: null,
        rawMax: null,
        secondaryLabel: "Secondary Likert measure (stored, not shown to participants)",
        secondaryValue: 14,
        secondaryMax: 36,
        threshold: 4,
        atOrAboveThreshold: true,
        subscores: [],
        history: [
          { label: "Q1", value: 2 },
          { label: "Q2", value: 5 },
          { label: "Q3", value: 3 },
          { label: "Q4", value: 4 },
        ],
      };

    case "ghq28":
      return {
        ...base,
        headline: 8,
        rawScore: null,
        rawMax: null,
        secondaryLabel: "Secondary Likert measure (stored, not shown to participants)",
        secondaryValue: 31,
        secondaryMax: 84,
        threshold: 5,
        atOrAboveThreshold: true,
        // A profile, not four verdicts. No threshold is attached to any of
        // them, here or anywhere in the product.
        subscores: [
          { key: "somatic", label: "Somatic symptoms", value: 3, max: 7 },
          { key: "anxiety_insomnia", label: "Anxiety / insomnia", value: 2, max: 7 },
          { key: "social_dysfunction", label: "Social dysfunction", value: 2, max: 7 },
          { key: "severe_depression", label: "Severe depression", value: 1, max: 7 },
        ],
        history: [
          { label: "Q1", value: 6 },
          { label: "Q2", value: 11 },
          { label: "Q3", value: 9 },
          { label: "Q4", value: 8 },
        ],
      };

    case "who5":
      return {
        ...base,
        headline: 64,
        rawScore: 16,
        rawMax: 25,
        secondaryLabel: null,
        secondaryValue: null,
        secondaryMax: null,
        threshold: null,
        atOrAboveThreshold: null,
        subscores: [],
        history: [
          { label: "Q1", value: 48 },
          { label: "Q2", value: 56 },
          { label: "Q3", value: 60 },
          { label: "Q4", value: 64 },
        ],
      };

    case "disc360_wellbeing_v1":
      return {
        ...base,
        headline: 74,
        rawScore: 36,
        rawMax: 48,
        secondaryLabel: null,
        secondaryValue: null,
        secondaryMax: null,
        threshold: null,
        atOrAboveThreshold: null,
        subscores: DISC360_WELLBEING_DIMENSIONS.map((dimension, index) => ({
          key: dimension.key,
          label: dimension.label,
          value: [78, 61, 70, 83, 76, 68][index]!,
          max: 100,
        })),
        history: [
          { label: "May", value: 63 },
          { label: "Jun", value: 67 },
          { label: "Jul", value: 71 },
          { label: "Aug", value: 74 },
        ],
      };
  }
}
