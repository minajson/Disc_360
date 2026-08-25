import "server-only";
import { reportFilename } from "@/lib/reports/identity";
import {
  buildWellbeingAggregateReport,
  type AggregateCohort,
  type WellbeingAggregateReportInput,
} from "@/lib/reports/wellbeing-aggregate";
import type { ReportDocument } from "@/lib/reports/model";
import {
  getWellbeingComparison,
  getWellbeingDimensionProfile,
  getWellbeingSignalPatterns,
  getWellbeingWorkspace,
  type AnalyticsSource,
  type CompareDimension,
} from "@/lib/wellbeing/analytics";
import { SIGNAL_PRIORITY_LABEL } from "@/lib/wellbeing/signals";
import type { InstrumentKey } from "@/data/wellbeing-instruments";

/**
 * Assembles the management aggregate report.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY IT READS THE SAME FUNCTIONS THE SCREEN DOES.
 *
 * A PDF is the easiest place in a product to lose a privacy guarantee. The
 * usual way it happens is not malice but duplication: the export grows its own
 * query "just for the report", that query forgets a suppression step, and the
 * document quietly publishes what the screen withholds.
 *
 * So this loader issues no query of its own. It calls `getWellbeingWorkspace`,
 * `getWellbeingComparison`, `getWellbeingDimensionProfile` and
 * `getWellbeingSignalPatterns` — exactly the functions the analytics page
 * calls, each of which authorises through `requireWellbeingAnalyst` and
 * applies suppression before returning a figure. If a cohort is withheld on
 * screen it is withheld here, because it is the same call.
 * ─────────────────────────────────────────────────────────────────────
 */

const SCORE_DIRECTION_NOTE: Record<string, string> = {
  higher_is_more_distress:
    "On this instrument a higher score indicates more reported distress. It is a screening measure, not a diagnosis.",
  higher_is_stronger_wellbeing:
    "On this instrument a higher score indicates more of the experience described was reported.",
};

export async function loadWellbeingAggregateReport(
  organizationId: string,
  instrumentKey: InstrumentKey,
  source: AnalyticsSource,
  dimension: CompareDimension = "department",
): Promise<{ document: ReportDocument; filename: string }> {
  // Every one of these authorises independently and suppresses internally.
  const [workspace, comparison, profile, patterns] = await Promise.all([
    getWellbeingWorkspace(organizationId, instrumentKey, source),
    getWellbeingComparison(organizationId, instrumentKey, dimension, source),
    getWellbeingDimensionProfile(organizationId, instrumentKey, source),
    getWellbeingSignalPatterns(organizationId, instrumentKey, dimension, source),
  ]);

  const { context, overview, trend } = workspace;
  const instrument = context.instrument;

  const cohorts: AggregateCohort[] = comparison.view.cohorts.map((cohort) => ({
    label: cohort.label,
    // A withheld cohort contributes nulls, not a figure the renderer might
    // decide to show. There is nothing to leak because there is nothing here.
    participants: cohort.suppressed ? null : (cohort.stats?.completed ?? null),
    median: cohort.suppressed ? null : (cohort.stats?.median ?? null),
    suppressed: cohort.suppressed,
  }));

  const movement = trend.medianChange
    ? trend.medianChange.movement === "unchanged"
      ? `The median is unchanged against the previous comparable pulse.`
      : `The median is ${Math.abs(trend.medianChange.delta)} ${
          Math.abs(trend.medianChange.delta) === 1 ? "point" : "points"
        } ${trend.medianChange.movement} than the previous comparable pulse.`
    : null;

  const input: WellbeingAggregateReportInput = {
    organizationName: context.organizationName,
    campaignName: null,
    instrumentName: instrument.name,
    instrumentDescriptor: instrument.descriptor,
    scoreLabel: instrument.primaryScoreLabel,
    scoreMin: instrument.primaryScoreMin,
    scoreMax: instrument.primaryScoreMax,
    scoreDirectionNote:
      SCORE_DIRECTION_NOTE[instrument.scoreDirection] ?? SCORE_DIRECTION_NOTE.higher_is_stronger_wellbeing!,
    asOf: trend.points[trend.points.length - 1]?.at ?? new Date().toISOString(),
    invited: workspace.invited,
    participants: workspace.participants,
    responses: overview?.completed ?? 0,
    participation: workspace.participation,
    median: overview?.median ?? null,
    mean: overview?.mean ?? null,
    // Buckets carry the score at their START; the label spans the bucket so a
    // 0–100 index reads "60–69" rather than a bare "60". The span is clamped
    // to the instrument's maximum — without it the final bucket of a 0–100
    // scale printed "100–109", inventing a range the scale does not have.
    distribution: (overview?.distribution ?? []).map((bucket) => {
      const size = overview?.bucketSize ?? 1;
      const end = Math.min(instrument.primaryScoreMax, bucket.score + size - 1);
      return {
        label: size > 1 && end > bucket.score ? `${bucket.score}–${end}` : String(bucket.score),
        count: bucket.count,
      };
    }),
    threshold: context.threshold,
    atOrAboveThresholdShare: context.threshold === null ? null : (overview?.atOrAboveThresholdShare ?? null),
    medianMovement: movement,
    cohortLabel: comparison.view.label,
    cohorts,
    dimensions: (profile.view.dimensions ?? []).map((entry) => ({
      label: entry.label,
      median: entry.median,
    })),
    dimensionsLabel: instrument.subscales.length > 0 ? "Subscale profile" : "Dimension profile",
    // A subscale's own ceiling, not the instrument total.
    dimensionsMax:
      instrument.subscales.length > 0
        ? (instrument.subscales[0]?.itemCount ?? instrument.primaryScoreMax)
        : instrument.primaryScoreMax,
    waves: trend.points.map((point) => ({
      label: point.label,
      median: point.aggregate.median,
      participants: point.aggregate.completed,
    })),
    thresholdChanged: !trend.thresholdConsistent,
    signals: patterns.signals.map((signal) => ({
      priority: SIGNAL_PRIORITY_LABEL[signal.priority],
      observation: signal.observation,
      evidence: signal.evidence,
      mayMean: signal.mayMean,
      considerExploring: signal.considerExploring,
    })),
    minCohort: context.minCohort,
    isDemo: source === "demo",
    // The whole organisation is below the floor: nothing may be published.
    fullySuppressed: overview === null,
  };

  const document = buildWellbeingAggregateReport(input);
  const label = source === "demo" ? `${context.organizationName} Demo` : context.organizationName;

  return { document, filename: reportFilename(label, "wellbeing") };
}
