/**
 * DISC360 Wellbeing Pulse V1 — original instrument content.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THIS IS ORIGINAL DISC360 CONTENT.
 *
 * It is not GHQ-12, not derived from GHQ-12, and carries no licensed
 * third-party wording. Unlike the GHQ item bank, this content ships in full
 * and its version can be activated for participants.
 *
 * It is also NOT a diagnostic test, NOT a psychiatric assessment and NOT
 * psychometrically validated. V1 exists to let a person reflect on how their
 * own working life has been and to watch that change over time. Every product
 * surface built on it has to stay inside that claim.
 * ─────────────────────────────────────────────────────────────────────
 *
 * IMMUTABLE ONCE RELEASED. The item wording, the item order and the dimension
 * mapping are the version. Editing any of them silently re-interprets every
 * historical result, so a change means a new questionnaire version — never an
 * edit to this array.
 */

export const DISC360_WELLBEING_INSTRUMENT_KEY = "disc360_wellbeing_v1";
export const DISC360_WELLBEING_QUESTIONNAIRE_VERSION = 1;

/** Shown once, above the items. */
export const DISC360_WELLBEING_INSTRUCTION =
  "Thinking about the past two weeks, choose the response that best reflects your experience.";

/**
 * Five ordered response positions, scored 0–4.
 *
 * The scale runs from less of the experience to more of it, and every item is
 * worded POSITIVELY — so a higher score always means stronger current
 * wellbeing, on every item, with no reverse-scoring anywhere. That uniformity
 * is a property of the item set, and the scoring engine asserts it rather
 * than assuming it.
 */
export const DISC360_WELLBEING_OPTIONS: readonly { position: number; label: string; points: number }[] =
  [
    { position: 0, label: "Never", points: 0 },
    { position: 1, label: "Rarely", points: 1 },
    { position: 2, label: "Sometimes", points: 2 },
    { position: 3, label: "Often", points: 3 },
    { position: 4, label: "Almost always", points: 4 },
  ];

export const DISC360_WELLBEING_MAX_ITEM_POINTS = 4;

/* ── the six dimensions ─────────────────────────────────────────────── */

export type DimensionKey =
  | "capacity"
  | "recovery_demand"
  | "emotional_resilience"
  | "connection_safety"
  | "purpose_confidence"
  | "everyday_wellbeing";

export interface DimensionMeta {
  key: DimensionKey;
  label: string;
  /** Neutral description — never a clinical construct. */
  description: string;
  /** Display order across every surface. */
  position: number;
}

export const DISC360_WELLBEING_DIMENSIONS: readonly DimensionMeta[] = [
  {
    key: "capacity",
    label: "Capacity",
    description: "Attention and energy available for the day.",
    position: 0,
  },
  {
    key: "recovery_demand",
    label: "Recovery & Demand",
    description: "Switching off after demanding periods, and how manageable demands feel.",
    position: 1,
  },
  {
    key: "emotional_resilience",
    label: "Emotional Resilience",
    description: "Steadiness under difficulty, and dealing with problems as they arise.",
    position: 2,
  },
  {
    key: "connection_safety",
    label: "Connection & Safety",
    description: "Feeling supported by people around you, and able to ask for help.",
    position: 3,
  },
  {
    key: "purpose_confidence",
    label: "Purpose & Confidence",
    description: "Finding the work worthwhile, and feeling able to handle it.",
    position: 4,
  },
  {
    key: "everyday_wellbeing",
    label: "Everyday Wellbeing",
    description: "Enjoyment in ordinary life, and functioning day to day.",
    position: 5,
  },
];

export const DIMENSION_META: Record<DimensionKey, DimensionMeta> = Object.fromEntries(
  DISC360_WELLBEING_DIMENSIONS.map((dimension) => [dimension.key, dimension]),
) as Record<DimensionKey, DimensionMeta>;

/* ── the twelve items ───────────────────────────────────────────────── */

export interface DiscWellbeingItem {
  /** Stable key. Never renumbered — history joins on it. */
  externalId: string;
  /** 0-based administration order. Part of the version contract. */
  position: number;
  /** Short internal label, used in dimension breakdowns. */
  facet: string;
  prompt: string;
  dimension: DimensionKey;
}

export const DISC360_WELLBEING_ITEMS: readonly DiscWellbeingItem[] = [
  {
    externalId: "dw_focus",
    position: 0,
    facet: "Focus",
    prompt: "I have been able to stay focused on the things that need my attention.",
    dimension: "capacity",
  },
  {
    externalId: "dw_recovery",
    position: 1,
    facet: "Recovery",
    prompt: "I have been able to switch off and recover after demanding periods.",
    dimension: "recovery_demand",
  },
  {
    externalId: "dw_energy",
    position: 2,
    facet: "Energy",
    prompt: "I have had enough energy to manage my usual daily activities.",
    dimension: "capacity",
  },
  {
    externalId: "dw_workload",
    position: 3,
    facet: "Workload",
    prompt: "The demands on me have felt manageable.",
    dimension: "recovery_demand",
  },
  {
    externalId: "dw_emotional_balance",
    position: 4,
    facet: "Emotional Balance",
    prompt: "I have felt emotionally steady, even when things became difficult.",
    dimension: "emotional_resilience",
  },
  {
    externalId: "dw_coping",
    position: 5,
    facet: "Coping",
    prompt: "When problems arose, I felt able to deal with them effectively.",
    dimension: "emotional_resilience",
  },
  {
    externalId: "dw_connection",
    position: 6,
    facet: "Connection",
    prompt: "I have felt supported and connected to people around me.",
    dimension: "connection_safety",
  },
  {
    externalId: "dw_purpose",
    position: 7,
    facet: "Purpose",
    prompt: "What I do has felt worthwhile and meaningful to me.",
    dimension: "purpose_confidence",
  },
  {
    externalId: "dw_confidence",
    position: 8,
    facet: "Confidence",
    prompt: "I have felt confident in my ability to handle my responsibilities.",
    dimension: "purpose_confidence",
  },
  {
    externalId: "dw_positive_experience",
    position: 9,
    facet: "Positive Experience",
    prompt:
      "I have been able to experience enjoyment or satisfaction in my everyday life.",
    dimension: "everyday_wellbeing",
  },
  {
    externalId: "dw_psychological_safety",
    position: 10,
    facet: "Psychological Safety",
    prompt: "I have felt comfortable speaking up when I needed help or support.",
    dimension: "connection_safety",
  },
  {
    externalId: "dw_overall",
    position: 11,
    facet: "Overall Wellbeing",
    prompt: "Overall, I have felt able to function well in my day-to-day life.",
    dimension: "everyday_wellbeing",
  },
];

export const DISC360_WELLBEING_ITEM_COUNT = DISC360_WELLBEING_ITEMS.length;

/** Items belonging to a dimension, in administration order. */
export function itemsForDimension(dimension: DimensionKey): DiscWellbeingItem[] {
  return DISC360_WELLBEING_ITEMS.filter((item) => item.dimension === dimension).sort(
    (a, b) => a.position - b.position,
  );
}
