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
 * · licensed        — rights are recorded and content is loaded, but the
 *                     instrument is not switched on for participants. Serves
 *                     ONLY in a non-production deployment with the demo flag,
 *                     so it can be verified end to end before release.
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
 * licence and this platform is commercial. It is RECORDED and surfaced, not
 * enforced: the product owner has confirmed no additional licence is required
 * for this implementation's intended use. It stays because it remains true and
 * because anyone considering a commercial deployment of that instrument needs
 * to see it — see canServeToParticipants for why enforcing it needs somewhere
 * to read an organisation's classification from first.
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

  /**
   * The bound on the STORED RAW total (`wellbeing_results.total_score`).
   *
   * ───────────────────────────────────────────────────────────────────
   * WHY THIS IS NOT primaryScoreMax.
   *
   * For GHQ they are the same number, and that coincidence is what made the
   * database constraints wrong. WHO-5's PRIMARY score is the published
   * percentage (0–100) while its RAW total is 0–25, and the two are stored in
   * different columns. A rule that reads `primaryScoreMax` and applies it to
   * `total_score` is therefore correct for three instruments and silently
   * wrong for the fourth.
   * ───────────────────────────────────────────────────────────────────
   */
  rawScoreMax: number;
  /**
   * The bound on the stored Likert total, or null where none exists.
   *
   * GHQ's secondary continuous measure only. Null means the instrument must
   * store no Likert score at all — which is a rule, not an absence.
   */
  likertScoreMax: number | null;
  /**
   * WHICH STORED COLUMN CARRIES THE PRIMARY SCORE.
   *
   * ───────────────────────────────────────────────────────────────────
   * THE ASSUMPTION THIS FIELD EXISTS TO DELETE.
   *
   * `at_or_above_threshold` was defined in the schema as
   * `total_score >= threshold_at_completion`. That is GHQ's arithmetic, and it
   * was written when GHQ was the only instrument with a cut-off.
   *
   * WHO-5's cut-off of 50 is a number on its TRANSFORMED scale, stored in
   * `index_score`. Compared against its raw 0–25 total it is not merely
   * inaccurate — it is unreachable, so every WHO-5 result at or above the
   * cut-off was rejected outright at insert.
   *
   * Reading surfaces had the same assumption in a milder form: they picked the
   * column by testing `primaryScoreMax === 100`, which gets the right answer
   * for all four instruments today purely by coincidence — every instrument
   * that tops out at 100 happens to be one that normalises. An instrument with
   * a raw 0–100 count would satisfy that test and be read from a null column,
   * reporting zero for everybody.
   *
   * So the column is DECLARED. A threshold, where one exists, is stated on this
   * same scale — see `thresholdScaleFor`, which derives rather than repeats it.
   * ───────────────────────────────────────────────────────────────────
   */
  reportedOn: "raw" | "index";

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
   * non-commercial licence governs it, which is surfaced to whoever configures
   * a campaign rather than enforced in code.
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
  // Raw and primary coincide here — the coincidence that made a shared rule
  // look correct for years.
  rawScoreMax: 12,
  likertScoreMax: 36,
  reportedOn: "raw",
  itemCount: 12,
  responseOptionCount: 4,
  subscales: [],
  subscaleDescription: "Overall score only — no subscales",
  hasThreshold: true,
  // The supplied guide put a score of 4 in two bands at once ("3–4 borderline"
  // and "≥4 clinically significant"). Resolved by the product owner to the 3/4
  // split, so 4 is the first score in the upper band. Recorded with its
  // provenance because the document itself cannot be quoted as the authority.
  thresholdDescription:
    "Binary GHQ scoring (0-0-1-1), 0–12. Bands 0–3 and 4–12, the 3/4 split confirmed by the " +
    "product owner after the supplied guide placed 4 in both. A screening indication only — " +
    "not a diagnosis and not a measure of fitness for work.",
  defaultThreshold: 4,
  licensing: "external_rights_required",
  licensingDescription:
    "Licence confirmed by the product owner for digital use. Content transcribed from " +
    "GHQ-12_Questionnaire_and_Assessment_Guide.pdf, which carries no attribution statement — " +
    "see sourceDocument.",
  sourceDocument: "GHQ-12_Questionnaire_and_Assessment_Guide.pdf",
  // Deliberately null. GHQ-12 is copyright Goldberg & Williams and licensed
  // through GL Assessment, so an attribution string is very likely required —
  // but none appears in the supplied guide, and inventing one would be worse
  // than leaving the gap visible. It is reported rather than fabricated.
  attribution: null,
  /*
   * HELD, and held for a LICENSING reason rather than a technical one.
   *
   * ───────────────────────────────────────────────────────────────────
   * WHY THIS IS NOT `active`.
   *
   * It was. Nothing about the engine has changed: GHQ-12's scoring, threshold
   * governance, reports and tests are complete and passing.
   *
   * What changed is that `active` was doing no work and hiding a gap. GHQ-12
   * has never been servable in production — its version there is
   * `structure_only` with no wording — so the only thing keeping it off was the
   * ABSENCE OF CONTENT, not a decision. `canServeToParticipants` said yes; the
   * questionnaire loader happened to find nothing. That is fail-closed by
   * accident, and it would have become fail-OPEN the moment the content
   * migration ran.
   *
   * The real position is the one directly above: `attribution` is null because
   * the exact wording GL Assessment requires has not been confirmed, and
   * 00040's own licence_note says it "must be confirmed with GL Assessment
   * before external production release". An instrument whose required
   * attribution is unknown is not ready to be served, so the registry now says
   * so instead of relying on a database happening to be empty.
   *
   * `licensed` still permits authorised internal testing — a non-production
   * deployment with WELLBEING_DEMO_MODE set — which is the same controlled
   * mechanism GHQ-28 and WHO-5 use, and it cannot open the hosted product.
   * Flip this to `active` when the attribution wording is recorded, and not
   * before.
   * ───────────────────────────────────────────────────────────────────
   */
  status: "licensed",
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
  rawScoreMax: 28,
  // 28 items x 3. GHQ-12's 36 was applied to this column platform-wide, so a
  // GHQ-28 result scoring above 36 on the Likert measure was rejected.
  likertScoreMax: 84,
  reportedOn: "raw",
  itemCount: 28,
  responseOptionCount: 4,
  subscales: GHQ28_SUBSCALES,
  subscaleDescription:
    "Four subscales of seven items. Profile dimensions only — they carry no thresholds of their own.",
  hasThreshold: true,
  // FIVE, not the "4 or more" printed in the supplied guide. The product owner
  // confirmed the 4/5 split, which is also what the registry already held. The
  // divergence from the document is deliberate and recorded so nobody later
  // "corrects" this to match it.
  thresholdDescription:
    "Binary GHQ scoring (0-0-1-1), 0–28. Bands 0–4 and 5–28, the 4/5 split confirmed by the " +
    "product owner; the supplied guide states 4. A screening indication only — not a " +
    "diagnosis, and the four subscales carry no thresholds of their own.",
  defaultThreshold: 5,
  licensing: "external_rights_required",
  licensingDescription:
    "Licence confirmed by the product owner for digital use. Content transcribed from " +
    "GHQ-28_Questionnaire_and_Assessment_Guide.pdf, which carries no attribution statement — " +
    "see sourceDocument.",
  sourceDocument: "GHQ-28_Questionnaire_and_Assessment_Guide.pdf",
  // Null for the same reason as GHQ-12: copyright Goldberg & Hillier, licensed
  // through GL Assessment, and the supplied guide carries no attribution to
  // transcribe. Reported, not fabricated.
  attribution: null,
  // HELD, and not for a licensing reason.
  //
  // Section D asks directly about not wanting to live. The supplied guide
  // requires professional evaluation after a positive answer there, and this
  // product cannot notify anybody because an individual result is private by
  // design. The resolution is participant-facing support information, and its
  // wording must come from the Occupational Health team — it is not something
  // this product may compose for itself.
  //
  // So GHQ-28 stays non-servable in production until that wording exists. The
  // engine, scoring, subscales, reporting, analytics and tests are complete and
  // exercised locally; only the participant-facing route is closed. See
  // GHQ28_SUPPORT_APPROVED in data/ghq28-support-content.ts.
  status: "licensed",
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
  // The raw total, BEFORE the x4 transform. The cut-off of 50 lives on the
  // transformed scale and is nonsense against this number.
  rawScoreMax: 25,
  likertScoreMax: null,
  reportedOn: "index",
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
  // HELD at `licensed` until the full E2E gate passes.
  //
  // The five directional assumptions that made WHO-5 unsafe are all fixed —
  // result dispatch, scoring dispatch, report label, emphasis flag and
  // aggregate share — and its result, report and analytics paths are complete.
  // What remains is proving the participant journey end to end rather than
  // asserting it. Flipping this word is the whole act of opening WHO-5, so it
  // waits for that evidence.
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
  rawScoreMax: 48,
  likertScoreMax: null,
  // Reported on its 0–100 index, and carrying NO threshold — the two facts are
  // independent, which is why they are no longer one field.
  reportedOn: "index",
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
 * The largest number that could be a meaningful threshold for an instrument.
 *
 * A threshold is stated on whichever scale the instrument declares, so its
 * bound follows that declaration: GHQ's cut-offs are counts on the raw scale,
 * WHO-5's is a percentage on the transformed one. Null where the instrument
 * carries no threshold — there is no range, not an unbounded one.
 */
export function thresholdMaxFor(key: InstrumentKey): number | null {
  const instrument = INSTRUMENTS[key];
  if (!instrument.hasThreshold) return null;
  return instrument.reportedOn === "index" ? instrument.primaryScoreMax : instrument.rawScoreMax;
}

/**
 * The scale an instrument's cut-off is stated on, or null where it has none.
 *
 * DERIVED, not declared: a threshold is always a number on the same scale the
 * instrument is reported on. Storing it twice would create two facts that can
 * disagree, and disagreeing facts about a scale is the whole subject of this
 * file.
 */
export function thresholdScaleFor(key: InstrumentKey): "raw" | "index" | null {
  const instrument = INSTRUMENTS[key];
  return instrument.hasThreshold ? instrument.reportedOn : null;
}

/** The instrument a governed policy row was written for, by its scoring method. */
export function instrumentForScoringMethod(method: string): InstrumentKey | null {
  return INSTRUMENT_KEYS.find((key) => INSTRUMENTS[key].scoringMethod === method) ?? null;
}

/**
 * A governed policy row, reduced to the two fields a threshold rule needs.
 *
 * Structural rather than an import, so this rule lives beside the metadata it
 * derives from and stays testable — `lib/wellbeing/policy.ts` is `server-only`
 * and cannot be loaded by the unit runner.
 */
export interface GovernedPolicy {
  screeningThreshold: number;
  /** The scoring method — and therefore the instrument — this policy governs. */
  scoringMethod: string;
}

/**
 * The threshold to score and classify a given instrument against.
 *
 * ─────────────────────────────────────────────────────────────────────
 * A POLICY GOVERNS THE INSTRUMENT IT NAMES, AND NO OTHER.
 *
 * `wellbeing_policies.screening_threshold` was read as one organisation-wide
 * number and applied to whatever was being scored. With GHQ-12 alone that was
 * indistinguishable from correct. With two threshold-carrying instruments it
 * meant GHQ-28 was classified against GHQ-12's 3/4 split rather than its own
 * 4/5 — and the analytics surface had separately been patched to DISPLAY
 * GHQ-28's 5, so the cut-off a facilitator read was not the cut-off the stored
 * results were classified by.
 *
 * The row has always carried `scoring_method`. It was simply never read.
 * ─────────────────────────────────────────────────────────────────────
 */
export function resolveGovernedThreshold(
  policy: GovernedPolicy,
  key: InstrumentKey,
): number | null {
  const instrument = INSTRUMENTS[key];
  if (!instrument.hasThreshold) return null;
  if (policy.scoringMethod !== instrument.scoringMethod) return instrument.defaultThreshold;

  // Bounded on the instrument's OWN scale, not on GHQ-12's 1–12. The database
  // enforces the same rule; this stays because "the constraint makes it
  // unreachable" and "safe to assume" are not the same thing for a number that
  // decides what a person is told about themselves.
  const max = thresholdMaxFor(key);
  if (max === null) return instrument.defaultThreshold;
  const threshold = policy.screeningThreshold;
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > max) {
    return instrument.defaultThreshold;
  }
  return threshold;
}

/** A stored result, reduced to the two score columns every instrument writes. */
export interface StoredScores {
  /** `wellbeing_results.total_score` — the instrument's RAW total. */
  totalScore: number;
  /** `wellbeing_results.index_score` — present only where one is normalised. */
  indexScore: number | null;
}

/**
 * The figure an instrument is REPORTED on, taken from its declared scale.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS REPLACED `primaryScoreMax === 100`.
 *
 * That test asked "does this instrument report on 0–100?" and used the answer
 * to pick a COLUMN. It gets the right answer for all four instruments today,
 * by coincidence: every instrument whose primary scale tops out at 100 happens
 * to be one that normalises into `index_score`.
 *
 * The coincidence is not a rule. An instrument with a raw 0–100 count would
 * satisfy the test and be read from the wrong column, and nothing would fail —
 * it would report zero for everybody, because `index_score` is null there.
 *
 * `reportedOn` states the fact directly instead of inferring it.
 * ─────────────────────────────────────────────────────────────────────
 */
export function reportedScoreFor(key: InstrumentKey, scores: StoredScores): number {
  return INSTRUMENTS[key].reportedOn === "index" ? (scores.indexScore ?? 0) : scores.totalScore;
}

/**
 * Whether a result sits at or above its instrument's cut-off.
 *
 * DIRECTION IS NOT DECIDED HERE, deliberately. This answers only "which side
 * of the number is it on"; what that side MEANS is `scoreDirection`'s job, and
 * conflating the two is the defect this whole audit exists to remove — on GHQ
 * at-or-above is the concerning side, on WHO-5 it is the unremarkable one.
 *
 * Returns null for an instrument that carries no threshold, which must then
 * store no flag either.
 */
export function atOrAboveThresholdFor(
  key: InstrumentKey,
  scores: StoredScores,
  threshold: number | null,
): boolean | null {
  const instrument = INSTRUMENTS[key];
  if (!instrument.hasThreshold || threshold === null) return null;
  return reportedScoreFor(key, scores) >= threshold;
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
  },
): ServeDecision {
  const instrument = INSTRUMENTS[key];

  // `useClassification` is RECORDED, not enforced here.
  //
  // It was briefly a hard gate: an instrument marked `internal_noncommercial`
  // was refused unless the caller passed a matching organisation
  // classification. Nothing ever passed one, so the gate defaulted closed and
  // WHO-5 could not be served by anybody — a dead end rather than a control.
  //
  // The product owner has since confirmed that no additional licence is
  // required for this implementation's intended use, so the block is removed.
  // The classification stays on the instrument because it remains TRUE and is
  // rendered in the licensing surfaces: CC BY-NC-SA is a non-commercial
  // licence, and anyone considering serving WHO-5 to a paying customer needs
  // to see that before they do. Recording a constraint and enforcing it are
  // different jobs, and only the first one is honest here.
  //
  // If enforcement is wanted later it needs somewhere to read the
  // organisation's classification FROM — a column and a governance surface —
  // not a parameter no caller supplies.

  if (instrument.status === "active") return { allowed: true, reason: null };

  // `licensed` and `demo_restricted` share one serving rule.
  //
  // Both mean "the content exists and may be looked at, but this instrument is
  // not switched on for participants". The only place that is legitimate is a
  // NON-PRODUCTION deployment with the demo flag explicitly set — which is
  // also the only way to exercise the participant journey before release.
  //
  // Without this, a held instrument could not be end-to-end tested anywhere,
  // and the choice would be between shipping it unverified or flipping it to
  // `active` to make a test pass. Both are worse than a rule that says plainly
  // where a held instrument may run.
  //
  // Production is unaffected: `isProductionEnvironment()` returns true for the
  // hosted deployment unconditionally, so this branch cannot open there.
  if (instrument.status === "demo_restricted" || instrument.status === "licensed") {
    if (!options.isProduction && options.demoEnabled) {
      return { allowed: true, reason: null };
    }
    return { allowed: false, reason: NOT_ACTIVE_MESSAGE };
  }

  // structure_only and retired never serve, anywhere.
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
