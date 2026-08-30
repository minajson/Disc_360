import "server-only";
import {
  buildDiscWellbeingReport,
  buildWellbeingReport,
  type ReportDocument,
} from "@/lib/reports/model";
import { reportFilename } from "@/lib/reports/identity";
import { loadOwnWellbeingResult } from "@/lib/wellbeing/queries";
import { DEFAULT_SCREENING_THRESHOLD } from "@/lib/scoring/wellbeing";
import { INSTRUMENTS } from "@/data/wellbeing-instruments";
import { WORK_LOCATION_LABEL } from "@/data/wellbeing-taxonomy";
import {
  ghqOutcomeCopy,
  ghqScoreLabel,
  ghqScoreMeaning,
  MOVEMENT_CAVEAT,
  MOVEMENT_LABEL,
  movementDetail,
  participantDisclaimerFor,
} from "@/data/wellbeing-content";
import {
  DISC_DIMENSION_LEAD,
  DISC_INDEX_LABEL,
  DISC_INDEX_MEANING,
  DISC_LOWEST_HEADING,
  DISC_MOVEMENT_CAVEAT,
  DISC_MOVEMENT_LABEL,
  DISC_NO_BANDS_NOTE,
  DISC_PATTERN_NOTE,
  DISC_STRONGEST_HEADING,
  DISC_WELLBEING_DISCLAIMER_LONG,
  indexMovementDetail,
  lowestLine,
  sinceFirstDetail,
  strongestLine,
} from "@/data/disc360-wellbeing-content";
import { DIMENSION_META, type DimensionKey } from "@/data/disc360-wellbeing-items";
import {
  who5CutoffCopy,
  WHO5_CUTOFF_SOURCE_NOTE,
  WHO5_DISCLAIMER_LONG,
  WHO5_MOVEMENT_CAVEAT,
  WHO5_SCORE_MEANING,
} from "@/data/who5-content";
import { WHO5_SUGGESTED_CUTOFF_PERCENTAGE } from "@/data/who5-items";
import { DISC_WELLBEING_MAX_RAW, rankDimensions } from "@/lib/scoring/disc360-wellbeing";
import type { WellbeingHistoryRecord } from "@/lib/wellbeing/queries";
import type { AuthContext } from "@/lib/auth/guards";

/**
 * The participant's own Wellbeing Pulse report.
 *
 * Authorization is `loadOwnWellbeingResult` — no profile id parameter, read
 * through the caller's own RLS-scoped client, with a redundant ownership
 * comparison on top. The PDF route and the email action both call THIS
 * function, so the downloaded file and the emailed attachment cannot diverge
 * in content or in permission.
 *
 * A miss returns null and every caller answers 404.
 */

export interface OwnWellbeingReport {
  document: ReportDocument;
  filename: string;
  context: AuthContext;
  /** The address on the participant's own account. */
  accountEmail: string;
  /** Canonical web location of the same result. */
  webPath: string;
  resultId: string;
}

export async function loadOwnWellbeingReport(
  resultId: string,
): Promise<OwnWellbeingReport | null> {
  const loaded = await loadOwnWellbeingResult(resultId);
  if (!loaded) return null;

  const { context, record, history } = loaded;
  const participantName =
    context.profile.full_name?.trim() || context.profile.preferred_name?.trim() || "Participant";

  // History up to and including this pulse — a report for an older result must
  // not draw a line into that participant's future. Same-instrument only,
  // because `history` is already scoped to the result's instrument.
  const upToHere = history.chronological.filter(
    (entry) => entry.completedAt <= record.completedAt,
  );

  if (record.instrumentKey === "disc360_wellbeing_v1") {
    return {
      document: buildDiscWellbeingDocument(participantName, record, upToHere),
      filename: reportFilename(participantName, "wellbeing"),
      context,
      accountEmail: context.profile.email,
      webPath: `/wellbeing/result/${record.id}`,
      resultId: record.id,
    };
  }

  if (record.instrumentKey === "who5") {
    // WHO-5's principal figure is the published percentage (raw × 4), and its
    // noteworthy side is BELOW the cut-off — the opposite of GHQ. Every value
    // and every string here is WHO-5's own; none is shared with the GHQ branch
    // below, because sharing them would invert the meaning.
    const score = record.indexScore ?? 0;
    const cutoff = record.threshold ?? WHO5_SUGGESTED_CUTOFF_PERCENTAGE;
    const outcome = who5CutoffCopy(score >= cutoff);

    return {
      document: buildWellbeingReport({
        participantName,
        completedAt: record.completedAt,
        totalScore: score,
        maxScore: 100,
        threshold: cutoff,
        // Emphasise BELOW the cut-off. Passing `record.atOrAboveThreshold`
        // straight through would highlight strong wellbeing as the concern.
        atOrAboveThreshold: score < cutoff,
        // Named for WHO-5, not inherited from GHQ.
        scoreLabel: "WHO-5 Well-Being Score",
        scoreMetaLabel: "WHO-5 score",
        thresholdMetaLabel: "Suggested threshold",
        outcomeHeadline: outcome.headline,
        outcomeBody: outcome.body,
        outcomeDetail: WHO5_CUTOFF_SOURCE_NOTE,
        scoreMeaning: WHO5_SCORE_MEANING,
        disclaimer: WHO5_DISCLAIMER_LONG,
        history: upToHere
          .filter((entry) => entry.indexScore !== null)
          .map((entry) => ({
            completedAt: entry.completedAt,
            totalScore: entry.indexScore!,
            threshold: entry.threshold ?? WHO5_SUGGESTED_CUTOFF_PERCENTAGE,
          })),
        movementLabel: record.comparison
          ? DISC_MOVEMENT_LABEL[record.comparison.movement]
          : undefined,
        movementDetail: record.comparison
          ? who5MovementDetail(record.comparison.movement, record.comparison.delta)
          : undefined,
        movementCaveat: record.comparison ? WHO5_MOVEMENT_CAVEAT : undefined,
        departmentAtCompletion: record.departmentAtCompletion,
        workLocationAtCompletion: record.workLocationAtCompletion
          ? WORK_LOCATION_LABEL[record.workLocationAtCompletion]
          : null,
        officeLocationAtCompletion: record.officeLocationAtCompletion,
        questionnaireVersion: record.questionnaireVersion,
        scoringVersion: record.scoringVersion,
        attemptNumber: record.attemptNumber,
      }),
      filename: reportFilename(participantName, "wellbeing"),
      context,
      accountEmail: context.profile.email,
      webPath: `/wellbeing/result/${record.id}`,
      resultId: record.id,
    };
  }

  /*
   * ─────────────────────────────────────────────────────────────────────
   * BOTH GHQ QUESTIONNAIRES REACH THIS BRANCH, AND THEY ARE NOT THE SAME.
   *
   * This block used to hard-code GHQ-12 throughout — `WELLBEING_MAX_SCORE`
   * (12), `SCREENING_DISCLAIMER_LONG` (which opens with the words "GHQ-12"),
   * `outcomeCopy` (which names the GHQ-12 threshold) and GHQ-12's 3/4 split as
   * the fallback threshold. So a participant who answered twenty-eight
   * questions downloaded a report that named GHQ-12, explained a 0–12 range,
   * and drew their score — which can reach 28 — on a twelve-cell scale.
   *
   * Everything below is now read from the questionnaire that was actually
   * answered. `data/wellbeing-instruments.ts` already held all of it.
   * ─────────────────────────────────────────────────────────────────────
   */
  const ghq = record.instrumentKey === "ghq28" ? "ghq28" : "ghq12";
  const instrument = INSTRUMENTS[ghq];
  const outcome = ghqOutcomeCopy(ghq, record.atOrAboveThreshold === true);
  // The questionnaire's own split — GHQ-12 at 3/4, GHQ-28 at 4/5. One shared
  // fallback classified GHQ-28 a point early wherever a stored value was
  // missing.
  const fallbackThreshold = instrument.defaultThreshold ?? DEFAULT_SCREENING_THRESHOLD;

  const document = buildWellbeingReport({
    participantName,
    completedAt: record.completedAt,
    totalScore: record.totalScore,
    maxScore: instrument.primaryScoreMax,
    // GHQ always carries a threshold; the schema enforces it. The fallback
    // exists so a type-level null can never render as "threshold null".
    threshold: record.threshold ?? fallbackThreshold,
    atOrAboveThreshold: record.atOrAboveThreshold === true,
    scoreLabel: ghqScoreLabel(ghq),
    outcomeHeadline: outcome.headline,
    outcomeBody: outcome.body,
    outcomeDetail: outcome.detail,
    scoreMeaning: ghqScoreMeaning(ghq),
    disclaimer: participantDisclaimerFor(ghq),
    history: upToHere.map((entry) => ({
      completedAt: entry.completedAt,
      totalScore: entry.totalScore,
      threshold: entry.threshold ?? fallbackThreshold,
    })),
    movementLabel: record.comparison ? MOVEMENT_LABEL[record.comparison.movement] : undefined,
    movementDetail: record.comparison
      ? movementDetail(record.comparison.movement, record.comparison.delta)
      : undefined,
    movementCaveat: record.comparison ? MOVEMENT_CAVEAT : undefined,
    departmentAtCompletion: record.departmentAtCompletion,
    workLocationAtCompletion: record.workLocationAtCompletion
      ? WORK_LOCATION_LABEL[record.workLocationAtCompletion]
      : null,
    officeLocationAtCompletion: record.officeLocationAtCompletion,
    questionnaireVersion: record.questionnaireVersion,
    scoringVersion: record.scoringVersion,
    attemptNumber: record.attemptNumber,
  });

  return {
    document,
    filename: reportFilename(participantName, "wellbeing"),
    context,
    accountEmail: context.profile.email,
    webPath: `/wellbeing/result/${record.id}`,
    resultId: record.id,
  };
}


/**
 * The DISC360 Wellbeing Pulse document.
 *
 * Separate from the GHQ builder rather than a branch inside it: the two
 * reports share a renderer and share nothing else — different scale, different
 * sections, different language, and no threshold anywhere in this one.
 */
function buildDiscWellbeingDocument(
  participantName: string,
  record: WellbeingHistoryRecord,
  upToHere: WellbeingHistoryRecord[],
): ReportDocument {
  const ranked = rankDimensions(
    record.dimensions.map((dimension) => ({
      key: dimension.key,
      raw: dimension.raw,
      index: dimension.index,
    })),
  );

  // Name the person's own higher and lower dimensions — relative to their own
  // other answers on this pulse, never to a standard or to other people.
  const strongest = ranked.slice(0, 2).map((dimension) => DIMENSION_META[dimension.key].label);
  const lowest = ranked
    .slice(-2)
    .reverse()
    .map((dimension) => DIMENSION_META[dimension.key].label);

  const first = upToHere[0];
  const sinceFirst =
    first && first.id !== record.id && record.indexScore !== null && first.indexScore !== null
      ? sinceFirstDetail(record.indexScore - first.indexScore)
      : undefined;

  const dimensionHistory = DIMENSION_ORDER.map((key) => ({
    label: DIMENSION_META[key].label,
    points: upToHere
      .map((entry) => {
        const dimension = entry.dimensions.find((d) => d.key === key);
        return dimension ? { completedAt: entry.completedAt, index: dimension.index } : null;
      })
      .filter((point): point is { completedAt: string; index: number } => point !== null),
  }));

  return buildDiscWellbeingReport({
    participantName,
    completedAt: record.completedAt,
    wellbeingIndex: record.indexScore ?? 0,
    rawScore: record.totalScore,
    rawMax: DISC_WELLBEING_MAX_RAW,
    indexLabel: DISC_INDEX_LABEL,
    indexMeaning: DISC_INDEX_MEANING,
    noBandsNote: DISC_NO_BANDS_NOTE,
    dimensionLead: DISC_DIMENSION_LEAD,
    dimensions: record.dimensions.map((dimension) => ({
      label: DIMENSION_META[dimension.key].label,
      index: dimension.index,
      description: DIMENSION_META[dimension.key].description,
    })),
    strongestHeading: DISC_STRONGEST_HEADING,
    strongestLine: strongestLine(strongest),
    lowestHeading: DISC_LOWEST_HEADING,
    lowestLine: lowestLine(lowest),
    patternNote: DISC_PATTERN_NOTE,
    disclaimer: DISC_WELLBEING_DISCLAIMER_LONG,
    history: upToHere
      .filter((entry) => entry.indexScore !== null)
      .map((entry) => ({ completedAt: entry.completedAt, index: entry.indexScore! })),
    movementLabel: record.indexComparison
      ? DISC_MOVEMENT_LABEL[record.indexComparison.movement]
      : undefined,
    movementDetail: record.indexComparison
      ? indexMovementDetail(record.indexComparison.movement, record.indexComparison.delta)
      : undefined,
    sinceFirstDetail: sinceFirst,
    movementCaveat: record.indexComparison ? DISC_MOVEMENT_CAVEAT : undefined,
    dimensionHistory,
    departmentAtCompletion: record.departmentAtCompletion,
    workLocationAtCompletion: record.workLocationAtCompletion
      ? WORK_LOCATION_LABEL[record.workLocationAtCompletion]
      : null,
    officeLocationAtCompletion: record.officeLocationAtCompletion,
    questionnaireVersion: record.questionnaireVersion,
    scoringVersion: record.scoringVersion,
    attemptNumber: record.attemptNumber,
  });
}

const DIMENSION_ORDER: DimensionKey[] = [
  "capacity",
  "recovery_demand",
  "emotional_resilience",
  "connection_safety",
  "purpose_confidence",
  "everyday_wellbeing",
];


/**
 * Direction and size, and nothing about health.
 *
 * The same rule as the on-screen result: "improved" and "deteriorated" would
 * be clinical claims derived from arithmetic on five questions.
 */
function who5MovementDetail(movement: "higher" | "lower" | "similar", delta: number): string {
  const points = Math.abs(delta) === 1 ? "1 point" : `${Math.abs(delta)} points`;
  if (movement === "similar") return "Your score is the same as it was last time.";
  return movement === "higher"
    ? `Your score is ${points} higher than your previous check-in.`
    : `Your score is ${points} lower than your previous check-in.`;
}
