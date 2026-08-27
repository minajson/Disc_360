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

/**
 * What the deployment's rights permit, as distinct from what the licence is.
 *
 * `internal_noncommercial` exists because CC BY-NC-SA is a NON-COMMERCIAL
 * licence and this platform is commercial. Recording the classification is not
 * enough on its own — `canServeToParticipants` refuses to put such an
 * instrument in front of a participant in an organisation that does not carry
 * the same classification, so the boundary is enforced rather than documented.
 */
export type UseClassification = "unrestricted" | "internal_noncommercial";

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

  /**
   * How the score is named in prose. May be generic.
   *
   * "Wellbeing Index", "GHQ-12 screening score" — the phrase that reads
   * naturally inside a sentence.
   */
  primaryScoreLabel: string;
  /**
   * How the score is named BESIDE A FIGURE. Always instrument-qualified.
   *
   * ───────────────────────────────────────────────────────────────────
   * WHY THIS EXISTS SEPARATELY FROM primaryScoreLabel.
   *
   * WHO-5 and DISC360 Wellbeing both report on 0–100 and both count upward.
   * A screen that prints "Wellbeing Score 72" is therefore ambiguous between
   * two instruments that measure different things by different formulas — and
   * the ambiguity is invisible, because 72 looks like 72.
   *
   * `metricName` is the name that must appear wherever a figure appears:
   * "WHO-5 Well-Being Score · 72 / 100" and "DISC360 Wellbeing Index · 72 /
   * 100" cannot be mistaken for each other.
   * ───────────────────────────────────────────────────────────────────
   */
  metricName: string;
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
  /**
   * The use this deployment's rights actually cover.
   *
   * Kept SEPARATE from scoring metadata on purpose: how a score is computed is
   * a psychometric fact that never changes, while what we are permitted to do
   * with it is a legal position that can. `unrestricted` means the content is
   * DISC360's own or otherwise unencumbered. `internal_noncommercial` means a
   * non-commercial licence governs it, and serving is gated accordingly.
   */
  useClassification?: UseClassification;
  /** Publication identifier of the exact source the content was taken from. */
  sourceDocument?: string;
  /** The publisher's own suggested citation, reproduced as given. */
  sourceCitation?: string;
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
  metricName: "GHQ-12 Screening Score",
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
  metricName: "GHQ-28 Screening Score",
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
  metricName: "WHO-5 Well-Being Score",
  primaryScoreMin: 0,
  primaryScoreMax: 100,
  scoreDirection: "higher_is_stronger_wellbeing",
  itemCount: 5,
  responseOptionCount: 6,
  subscales: [],
  subscaleDescription: "Single scale — no subscales",
  // The cut-off belongs to the INSTRUMENT's documentation, not to DISC360's
  // interpretation. It is carried so it can be shown with its source attached
  // and its exact status — suggested, and an indication for further
  // assessment — never as a finding this product has made.
  hasThreshold: true,
  thresholdDescription:
    "A percentage score below 50 (or a raw score below 13) has been suggested as a cut-off " +
    "for poor mental well-being and as an indication for further assessment. Source: " +
    "WHO/UCN/MSD/MHE/2024.1. It is not a diagnosis and not a finding by DISC360.",
  defaultThreshold: 50,
  licensing: "open_licence",
  licensingDescription:
    "World Health Organization content under CC BY-NC-SA 3.0 IGO. Intended use here is internal and non-commercial.",
  useClassification: "internal_noncommercial",
  sourceDocument: "WHO/UCN/MSD/MHE/2024.1",
  sourceCitation:
    "World Health Organization. The World Health Organization-Five Well-Being Index (WHO-5). " +
    "Geneva: World Health Organization; 2024. Licence: CC BY-NC-SA 3.0 IGO.",
  // Rendered wherever WHO-5 results appear. The disclaimer half is not
  // optional: reproducing WHO material must never read as WHO endorsing this
  // product.
  attribution:
    "WHO-5 Well-Being Index © World Health Organization, used under CC BY-NC-SA 3.0 IGO. " +
    "The World Health Organization does not endorse DISC360 or Wellbeing Pulse, and is not " +
    "responsible for any interpretation presented here.",
  // `licensed`, not `active`, and the distinction is a release blocker rather
  // than bookkeeping.
  //
  // The rights ARE confirmed and the verbatim content IS loaded (00038). What
  // is missing is a WHO-5 result path: the result surface currently dispatches
  // `disc360_wellbeing_v1` and sends everything else to GhqResult. GHQ counts
  // UPWARD TOWARD DISTRESS on 0–12; WHO-5 counts upward toward WELLBEING on
  // 0–100, and its suggested cut-off is a floor, not a ceiling. Rendering a
  // WHO-5 score through that component would show a participant with good
  // wellbeing the concerning outcome — the interpretation exactly inverted.
  //
  // So it stays switched off here, where one word governs it, rather than
  // relying on no organisation happening to carry the non-commercial
  // classification. Flip to "active" only once Who5Result exists and the
  // result, history and report paths are proven not to touch GHQ code.
  status: "licensed",
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
  metricName: "DISC360 Wellbeing Index",
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

/**
 * The identity of a numeric SCALE, for asserting that two series belong on it.
 *
 * ─────────────────────────────────────────────────────────────────────
 * A RANGE IS NOT A SCALE.
 *
 * WHO-5 and DISC360 Wellbeing are both 0–100 and both count upward. Sharing a
 * range is exactly what makes them dangerous to each other: any chart written
 * to accept "a 0–100 series" will happily plot one on the other's axis, and
 * nothing about the numbers will look wrong.
 *
 * So a scale is identified by its INSTRUMENT, not by its bounds. Two series
 * may share an axis only when this string matches.
 * ─────────────────────────────────────────────────────────────────────
 */
export function scoreScaleId(key: InstrumentKey): string {
  const instrument = INSTRUMENTS[key];
  return `${key}:${instrument.primaryScoreMin}-${instrument.primaryScoreMax}`;
}

/** Whether two instruments' figures may share one numeric axis. Never across. */
export function sharesScale(a: InstrumentKey, b: InstrumentKey): boolean {
  return scoreScaleId(a) === scoreScaleId(b);
}

/** "DISC360 Wellbeing Index · 72 / 100" — the unambiguous form beside a figure. */
export function scoreDisplay(key: InstrumentKey, value: number | string): string {
  const instrument = INSTRUMENTS[key];
  return `${instrument.metricName} · ${value} / ${instrument.primaryScoreMax}`;
}

/* ── the licensing gate ─────────────────────────────────────────────── */

export interface ServeDecision {
  allowed: boolean;
  /** Participant- or facilitator-facing reason. Never exposes content. */
  reason: string | null;
}

export const NOT_ACTIVE_MESSAGE = "This instrument is not active for participant use.";

/**
 * Refusal for a non-commercially-licensed instrument in a commercial context.
 *
 * Names the reason rather than saying "not available", because this one is not
 * a deployment gap somebody should wait out — it is a rights boundary, and the
 * person reading it needs to know that using the instrument here requires a
 * different licence, not a later release.
 */
export const NON_COMMERCIAL_ONLY_MESSAGE =
  "This instrument is licensed for internal, non-commercial use only, and this organisation " +
  "is not recorded as such. Using it here requires a separate licence from its publisher.";

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
  options: {
    isProduction: boolean;
    demoEnabled: boolean;
    /**
     * What the ORGANISATION about to run this campaign is licensed for.
     *
     * Omitted means unrestricted, which is correct for every instrument whose
     * content DISC360 owns. It is only consulted for an instrument that
     * carries a narrower classification of its own.
     */
    organizationUse?: UseClassification;
  },
): ServeDecision {
  const instrument = INSTRUMENTS[key];

  // The non-commercial boundary, checked BEFORE status.
  //
  // An instrument licensed for internal non-commercial use may not be served
  // by an organisation that is not itself classified that way — being "active"
  // is a content fact and says nothing about rights. Checked first so that
  // flipping a status can never, on its own, put licensed content in front of
  // a commercial customer.
  if (instrument.useClassification === "internal_noncommercial") {
    const organizationUse = options.organizationUse ?? "unrestricted";
    if (organizationUse !== "internal_noncommercial") {
      return { allowed: false, reason: NON_COMMERCIAL_ONLY_MESSAGE };
    }
  }

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
