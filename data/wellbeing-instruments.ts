/**
 * The Wellbeing Pulse instrument registry.
 *
 * Wellbeing Pulse is a platform that runs governed instruments, not a single
 * questionnaire. Four exist. They measure different things, on different
 * scales, in different directions, under different licences — so everything
 * that differs between them is declared here, once, and every surface reads it
 * from here rather than branching on an instrument key.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE TWO RULES THIS FILE EXISTS TO ENFORCE.
 *
 *  1 · SCORES NEVER MEET. No instrument's score is convertible into, mergeable
 *      with, or comparable against another's. GHQ-12 counts distress upward,
 *      WHO-5 and the DISC360 index count wellbeing upward, and GHQ-28 runs on
 *      a different range again. `scoreDirection` and `primaryScoreMax` are
 *      recorded so a chart cannot silently share an axis.
 *
 *  2 · UNLICENSED CONTENT CANNOT REACH A PARTICIPANT. `status` is the gate,
 *      and `canServeToParticipants()` is the only function permitted to open
 *      it. Three of the four instruments are third-party content whose digital
 *      -use rights are still being confirmed, so their item wording is not in
 *      this repository at all.
 * ─────────────────────────────────────────────────────────────────────
 */

export type InstrumentKey = "ghq12" | "ghq28" | "who5" | "disc360_wellbeing_v1";

export const INSTRUMENT_KEYS: readonly InstrumentKey[] = [
  "ghq12",
  "ghq28",
  "who5",
  "disc360_wellbeing_v1",
] as const;

/**
 * Lifecycle state. The ONLY thing that decides whether content may be served.
 *
 * · structure_only  — item slots and weights exist; no wording is committed.
 * · demo_restricted — wording may exist locally for internal evaluation, but
 *                     the instrument is barred from participant use until
 *                     rights are confirmed.
 * · licensed        — rights are recorded, not yet switched on.
 * · active          — live for participants.
 * · retired         — superseded; historical results still resolve against it.
 */
export type InstrumentStatus =
  | "structure_only"
  | "demo_restricted"
  | "licensed"
  | "active"
  | "retired";

export type ScoreDirection =
  /** Higher = more of what is being screened for. */
  | "higher_is_more_distress"
  /** Higher = stronger reported wellbeing. */
  | "higher_is_stronger_wellbeing";

export type LicensingBasis =
  /** Third-party content; digital-use rights required and being pursued. */
  | "external_rights_required"
  /** Third-party content under a recorded open licence. */
  | "open_licence"
  /** DISC360's own material. */
  | "original_content";

export interface SubscaleDefinition {
  key: string;
  label: string;
  /** 1-based inclusive item range, as published. */
  itemRange: [number, number];
  itemCount: number;
  description: string;
}

export interface InstrumentMetadata {
  key: InstrumentKey;
  name: string;
  descriptor: string;
  /** Who authored or publishes the instrument. */
  publisher: string;
  purpose: string;

  questionnaireVersion: number;
  scoringMethod: string;
  scoringVersion: string;
  scoringEngine: string;

  primaryScoreLabel: string;
  primaryScoreMin: number;
  primaryScoreMax: number;
  scoreDirection: ScoreDirection;

  itemCount: number;
  responseOptionCount: number;

  /** Named sub-scores. Empty where the instrument defines none. */
  subscales: readonly SubscaleDefinition[];
  subscaleDescription: string;

  hasThreshold: boolean;
  thresholdDescription: string;
  /** Governed default. Null where the instrument carries no threshold. */
  defaultThreshold: number | null;

  licensing: LicensingBasis;
  licensingDescription: string;
  /** Required attribution, rendered wherever the instrument's results appear. */
  attribution: string | null;
  status: InstrumentStatus;

  /** Typical completion time, for the management comparison. */
  minutesToComplete: string;
  /** What this instrument is NOT — carried into product copy. */
  notClaims: readonly string[];
}

/* ── GHQ-12 ─────────────────────────────────────────────────────────── */

export const GHQ12: InstrumentMetadata = {
  key: "ghq12",
  name: "GHQ-12",
  descriptor: "GHQ-12 wellbeing screening",
  publisher: "Goldberg & Williams (GL Assessment)",
  purpose: "Psychological distress screening",
  questionnaireVersion: 1,
  scoringMethod: "ghq_bimodal_0011",
  scoringVersion: "1.0.0",
  scoringEngine: "lib/scoring/wellbeing.ts",
  primaryScoreLabel: "GHQ-12 screening score",
  primaryScoreMin: 0,
  primaryScoreMax: 12,
  scoreDirection: "higher_is_more_distress",
  itemCount: 12,
  responseOptionCount: 4,
  subscales: [],
  subscaleDescription: "Overall score only — no subscales",
  hasThreshold: true,
  thresholdDescription: "Configured screening threshold",
  defaultThreshold: 4,
  licensing: "external_rights_required",
  licensingDescription:
    "External rights required — digital-use permission is being pursued internally",
  attribution: null,
  status: "demo_restricted",
  minutesToComplete: "2–3 minutes",
  notClaims: ["not a diagnosis", "not a severity scale", "not a measure of fitness for work"],
};

/* ── GHQ-28 ─────────────────────────────────────────────────────────── */

export const GHQ28_SUBSCALES: readonly SubscaleDefinition[] = [
  {
    key: "somatic",
    label: "Somatic symptoms",
    itemRange: [1, 7],
    itemCount: 7,
    description: "Items 1–7, reported as a profile dimension only.",
  },
  {
    key: "anxiety_insomnia",
    label: "Anxiety / insomnia",
    itemRange: [8, 14],
    itemCount: 7,
    description: "Items 8–14, reported as a profile dimension only.",
  },
  {
    key: "social_dysfunction",
    label: "Social dysfunction",
    itemRange: [15, 21],
    itemCount: 7,
    description: "Items 15–21, reported as a profile dimension only.",
  },
  {
    key: "severe_depression",
    label: "Severe depression",
    itemRange: [22, 28],
    itemCount: 7,
    description: "Items 22–28, reported as a profile dimension only.",
  },
];

export const GHQ28: InstrumentMetadata = {
  key: "ghq28",
  name: "GHQ-28",
  descriptor: "GHQ-28 wellbeing screening",
  publisher: "Goldberg & Hillier (GL Assessment)",
  purpose: "Psychological distress screening with a four-part profile",
  questionnaireVersion: 1,
  scoringMethod: "ghq28_bimodal_0011",
  scoringVersion: "1.0.0",
  scoringEngine: "lib/scoring/ghq28.ts",
  primaryScoreLabel: "GHQ-28 screening score",
  primaryScoreMin: 0,
  primaryScoreMax: 28,
  scoreDirection: "higher_is_more_distress",
  itemCount: 28,
  responseOptionCount: 4,
  subscales: GHQ28_SUBSCALES,
  subscaleDescription:
    "Four subscales of seven items. Profile dimensions only — they carry no thresholds of their own.",
  hasThreshold: true,
  thresholdDescription: "Configured GHQ-28 screening threshold",
  defaultThreshold: 5,
  licensing: "external_rights_required",
  licensingDescription:
    "External rights required — digital-use permission is being pursued internally",
  attribution: null,
  status: "demo_restricted",
  minutesToComplete: "5–7 minutes",
  notClaims: [
    "not a diagnosis",
    "not a severity scale",
    "subscales are not separately interpretable as conditions",
    "not a measure of fitness for work",
  ],
};

/* ── WHO-5 ──────────────────────────────────────────────────────────── */

export const WHO5: InstrumentMetadata = {
  key: "who5",
  name: "WHO-5",
  descriptor: "WHO-5 Well-Being Index",
  publisher: "World Health Organization",
  purpose: "Short self-reported measure of current wellbeing",
  questionnaireVersion: 1,
  scoringMethod: "who5_sum_x4",
  scoringVersion: "1.0.0",
  scoringEngine: "lib/scoring/who5.ts",
  primaryScoreLabel: "WHO-5 score",
  primaryScoreMin: 0,
  primaryScoreMax: 100,
  scoreDirection: "higher_is_stronger_wellbeing",
  itemCount: 5,
  responseOptionCount: 6,
  subscales: [],
  subscaleDescription: "Single scale — no subscales",
  hasThreshold: false,
  thresholdDescription: "No threshold configured in this deployment",
  defaultThreshold: null,
  licensing: "open_licence",
  licensingDescription:
    "World Health Organization content under CC BY-NC-SA 3.0 IGO. Intended use here is internal and non-commercial.",
  // Rendered wherever WHO-5 results appear. The disclaimer half is not
  // optional: reproducing WHO material must never read as WHO endorsing this
  // product.
  attribution:
    "WHO-5 Well-Being Index © World Health Organization, used under CC BY-NC-SA 3.0 IGO. " +
    "The World Health Organization does not endorse DISC360 or Wellbeing Pulse, and is not " +
    "responsible for any interpretation presented here.",
  status: "structure_only",
  minutesToComplete: "1–2 minutes",
  notClaims: [
    "not a diagnosis",
    "not a clinical assessment",
    "not endorsed by the World Health Organization",
  ],
};

/* ── DISC360 Wellbeing Pulse V1 ─────────────────────────────────────── */

export const DISC360_WELLBEING_V1: InstrumentMetadata = {
  key: "disc360_wellbeing_v1",
  name: "DISC360 Wellbeing Pulse",
  descriptor: "Workplace wellbeing reflection",
  publisher: "DISC360",
  purpose: "Workplace wellbeing monitoring and reflection",
  questionnaireVersion: 1,
  scoringMethod: "disc360_wellbeing_sum_0_48",
  scoringVersion: "1.0.0",
  scoringEngine: "lib/scoring/disc360-wellbeing.ts",
  primaryScoreLabel: "Wellbeing Index",
  primaryScoreMin: 0,
  primaryScoreMax: 100,
  scoreDirection: "higher_is_stronger_wellbeing",
  itemCount: 12,
  responseOptionCount: 5,
  subscales: [],
  subscaleDescription: "Six dimensions, two items each",
  hasThreshold: false,
  thresholdDescription: "No clinical threshold in V1",
  defaultThreshold: null,
  licensing: "original_content",
  licensingDescription: "Original DISC360 product content",
  attribution: null,
  status: "active",
  minutesToComplete: "2–3 minutes",
  notClaims: [
    "not a diagnosis",
    "not a clinical or psychiatric assessment",
    "not psychometrically validated",
    "not a measure of fitness for work",
  ],
};

export const INSTRUMENTS: Record<InstrumentKey, InstrumentMetadata> = {
  ghq12: GHQ12,
  ghq28: GHQ28,
  who5: WHO5,
  disc360_wellbeing_v1: DISC360_WELLBEING_V1,
};

export function isInstrumentKey(value: string): value is InstrumentKey {
  return (INSTRUMENT_KEYS as readonly string[]).includes(value);
}

export function instrumentMeta(key: InstrumentKey): InstrumentMetadata {
  return INSTRUMENTS[key];
}

export function higherIsBetter(key: InstrumentKey): boolean {
  return INSTRUMENTS[key].scoreDirection === "higher_is_stronger_wellbeing";
}

/* ── the licensing gate ─────────────────────────────────────────────── */

export interface ServeDecision {
  allowed: boolean;
  /** Participant- or facilitator-facing reason. Never exposes content. */
  reason: string | null;
}

export const NOT_ACTIVE_MESSAGE = "This instrument is not active for participant use.";

/**
 * May this instrument be served to a participant?
 *
 * The single gate. Only `active` passes, and `demo_restricted` passes ONLY
 * outside production AND with the demo flag explicitly on — so no environment
 * variable alone, and no code path alone, can put unlicensed content in front
 * of a real participant.
 *
 * `isProduction` and `demoEnabled` are passed in rather than read from the
 * environment here, so this function stays pure and directly testable.
 */
export function canServeToParticipants(
  key: InstrumentKey,
  options: { isProduction: boolean; demoEnabled: boolean },
): ServeDecision {
  const instrument = INSTRUMENTS[key];

  if (instrument.status === "active") return { allowed: true, reason: null };

  if (instrument.status === "demo_restricted") {
    if (!options.isProduction && options.demoEnabled) {
      return { allowed: true, reason: null };
    }
    return { allowed: false, reason: NOT_ACTIVE_MESSAGE };
  }

  // structure_only, licensed (not yet switched on) and retired never serve.
  return { allowed: false, reason: NOT_ACTIVE_MESSAGE };
}

/** Why a facilitator cannot pick this instrument, for the campaign picker. */
export function unavailableReason(key: InstrumentKey): string {
  const instrument = INSTRUMENTS[key];
  switch (instrument.status) {
    case "active":
      return "";
    case "demo_restricted":
      return "Not available — questionnaire content awaiting licence confirmation";
    case "structure_only":
      return "Not available — questionnaire content not yet loaded";
    case "licensed":
      return "Not available — licensed but not yet activated";
    case "retired":
      return "Not available — retired";
  }
}
