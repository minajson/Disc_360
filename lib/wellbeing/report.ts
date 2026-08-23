import "server-only";
import { buildWellbeingReport, type ReportDocument } from "@/lib/reports/model";
import { reportFilename } from "@/lib/reports/identity";
import { loadOwnWellbeingResult } from "@/lib/wellbeing/queries";
import { WELLBEING_MAX_SCORE } from "@/lib/scoring/wellbeing";
import { WORK_LOCATION_LABEL } from "@/data/wellbeing-taxonomy";
import {
  MOVEMENT_CAVEAT,
  MOVEMENT_LABEL,
  movementDetail,
  outcomeCopy,
  SCORE_MEANING,
  SCREENING_DISCLAIMER_LONG,
} from "@/data/wellbeing-content";
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
  const outcome = outcomeCopy(record.atOrAboveThreshold);

  // History up to and including this pulse — a report for an older result must
  // not draw a line into that participant's future.
  const upToHere = history.chronological.filter(
    (entry) => entry.completedAt <= record.completedAt,
  );

  const document = buildWellbeingReport({
    participantName,
    completedAt: record.completedAt,
    totalScore: record.totalScore,
    maxScore: WELLBEING_MAX_SCORE,
    threshold: record.threshold,
    atOrAboveThreshold: record.atOrAboveThreshold,
    outcomeHeadline: outcome.headline,
    outcomeBody: outcome.body,
    outcomeDetail: outcome.detail,
    scoreMeaning: SCORE_MEANING,
    disclaimer: SCREENING_DISCLAIMER_LONG,
    history: upToHere.map((entry) => ({
      completedAt: entry.completedAt,
      totalScore: entry.totalScore,
      threshold: entry.threshold,
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
