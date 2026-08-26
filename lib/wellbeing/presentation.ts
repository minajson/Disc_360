import "server-only";
import {
  getWellbeingCohortMovement,
  getWellbeingComparison,
  getWellbeingCoverage,
  getWellbeingDimensionProfile,
  getWellbeingSignalPatterns,
  getWellbeingWorkspace,
  type AnalyticsScope,
  type AnalyticsSource,
  type CompareDimension,
} from "@/lib/wellbeing/analytics";
import { analyticsPlanFor, aggregateWellbeingLevel } from "@/lib/wellbeing/instrument-analytics";
import { SIGNAL_PRIORITY_LABEL } from "@/lib/wellbeing/signals";
import type { InstrumentKey } from "@/data/wellbeing-instruments";

/**
 * The Wellbeing Presentation deck.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THE DECK IS BUILT AS DATA ON THE SERVER.
 *
 * A presentation is the highest-risk surface in this product. It is shown to
 * the people with the most authority to act on it, in a room, at a size where
 * a caption is easy to miss — and it is the surface most likely to be
 * screenshotted and forwarded.
 *
 * So the client is handed slides, not a query. Every figure below comes from
 * the same analytics functions the screen uses, each of which authorises
 * through `requireWellbeingAnalyst` and applies suppression before returning
 * anything. A withheld cohort is filtered out HERE, on the server, so it is
 * absent from the props the deck renders with — there is nothing in the
 * client payload to inspect, and no interaction that could reveal one.
 *
 * WHAT THE DECK DELIBERATELY HAS NO SLIDE FOR.
 *
 * No participant, no roster, no name, no individual anything. And no
 * facilitator recommendation: this deck presents what was measured and where
 * to look, and stops. Telling leadership what to DO about a workforce's
 * wellbeing from a screening aggregate is exactly the over-reach the whole
 * product is built to avoid, and putting it on a slide makes it policy.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface DeckFigure {
  label: string;
  value: string;
  note?: string;
}

export interface DeckCohort {
  label: string;
  median: number;
  p25: number;
  p75: number;
  participants: number;
}

export interface DeckWave {
  label: string;
  median: number;
  responses: number;
}

export type DeckSlide =
  | { kind: "title"; campaign: string; organisation: string; instrument: string; period: string; status: string }
  | { kind: "participation"; figures: DeckFigure[]; coverage: { label: string; published: number; withheld: number; covered: number; participants: number }[]; minCohort: number }
  | { kind: "pattern"; scoreLabel: string; scoreMin: number; scoreMax: number; distribution: { label: string; count: number }[]; median: number; mean: number; level: string | null; levelDetail: string | null; threshold: number | null; thresholdShare: number | null; responses: number }
  | { kind: "dimensions"; heading: string; max: number; form: "radar" | "bars"; dimensions: { key: string; label: string; median: number; mean: number; completed: number }[]; highest: string | null; lowest: string | null }
  | { kind: "trend"; scoreLabel: string; scoreMin: number; scoreMax: number; waves: DeckWave[]; movement: string | null; thresholdConsistent: boolean; thresholds: number[]; suppressedWaves: number }
  | { kind: "cohorts"; dimensionLabel: string; scoreLabel: string; scoreMin: number; scoreMax: number; cohorts: DeckCohort[]; withheld: number; minCohort: number; distress: boolean }
  | { kind: "movement"; dimensionLabel: string; scoreMin: number; scoreMax: number; waves: string[]; rows: { label: string; medians: (number | null)[] }[] }
  | { kind: "signals"; signals: { priority: string; observation: string; evidence: string; mayMean: string; considerExploring: string }[] }
  | { kind: "discussion"; instrument: string; notClaims: readonly string[]; minCohort: number; points: string[] };

export interface WellbeingDeck {
  campaign: string;
  organisation: string;
  instrument: string;
  source: AnalyticsSource;
  slides: DeckSlide[];
}

export async function buildWellbeingDeck({
  organizationId,
  instrumentKey,
  source,
  scope,
  campaignName,
  organisationName,
  period,
  status,
  invited,
  completedParticipants,
  participationPercent,
  dimension = "department",
}: {
  organizationId: string;
  instrumentKey: InstrumentKey;
  source: AnalyticsSource;
  scope: AnalyticsScope;
  campaignName: string;
  organisationName: string;
  period: string;
  status: string;
  invited: number;
  completedParticipants: number;
  participationPercent: number | null;
  dimension?: CompareDimension;
}): Promise<WellbeingDeck> {
  const plan = analyticsPlanFor(instrumentKey);

  // Six independent, independently-authorised, independently-suppressed reads.
  // The deck issues no query of its own, for the same reason the PDF does not:
  // an export with its own query is how a document ends up publishing what the
  // screen withholds.
  const [workspace, coverage, profile, comparison, movement, patterns] = await Promise.all([
    getWellbeingWorkspace(organizationId, instrumentKey, source, scope),
    getWellbeingCoverage(organizationId, instrumentKey, source, scope),
    getWellbeingDimensionProfile(organizationId, instrumentKey, source, scope),
    getWellbeingComparison(organizationId, instrumentKey, dimension, source, scope),
    getWellbeingCohortMovement(organizationId, instrumentKey, dimension, source, scope),
    getWellbeingSignalPatterns(organizationId, instrumentKey, dimension, source, scope),
  ]);

  const { context, overview, trend } = workspace;
  const instrument = context.instrument;
  const level = overview ? aggregateWellbeingLevel(plan, overview.median) : null;

  const slides: DeckSlide[] = [];

  /* 1 · title */
  slides.push({
    kind: "title",
    campaign: campaignName,
    organisation: organisationName,
    instrument: instrument.name,
    period,
    status,
  });

  /* 2 · participation and coverage */
  slides.push({
    kind: "participation",
    minCohort: context.minCohort,
    figures: [
      { label: "Invited", value: String(invited) },
      {
        label: "Participants",
        value: String(completedParticipants),
        note: `${overview?.completed ?? 0} response${(overview?.completed ?? 0) === 1 ? "" : "s"} across all waves`,
      },
      {
        label: "Participation",
        value: participationPercent === null ? "—" : `${participationPercent}%`,
      },
      { label: "Minimum reporting group", value: String(context.minCohort) },
    ],
    coverage: coverage.coverage.dimensions.map((entry) => ({
      label: entry.label,
      published: entry.published,
      withheld: entry.withheld,
      covered: entry.covered,
      participants: coverage.coverage.participants,
    })),
  });

  /* 3 · the overall pattern — only where there IS one to publish */
  if (overview) {
    slides.push({
      kind: "pattern",
      scoreLabel: instrument.primaryScoreLabel,
      scoreMin: instrument.primaryScoreMin,
      scoreMax: instrument.primaryScoreMax,
      distribution: overview.distribution.map((bucket) => {
        const end = Math.min(instrument.primaryScoreMax, bucket.score + overview.bucketSize - 1);
        return {
          label:
            overview.bucketSize > 1 && end > bucket.score
              ? `${bucket.score}–${end}`
              : String(bucket.score),
          count: bucket.count,
        };
      }),
      median: overview.median,
      mean: overview.mean,
      level: level?.label ?? null,
      levelDetail: level?.detail ?? null,
      threshold: plan.thresholdRate ? context.threshold : null,
      thresholdShare:
        plan.thresholdRate && context.threshold !== null ? overview.atOrAboveThresholdShare : null,
      responses: overview.completed,
    });
  }

  /* 4 · what the workforce is telling us — the instrument's own structure */
  if (plan.dimensionForm && profile.view.dimensions && profile.view.dimensions.length > 0) {
    slides.push({
      kind: "dimensions",
      heading: plan.dimensionHeading ?? "Profile",
      max: plan.dimensionMax,
      form: plan.dimensionForm,
      dimensions: profile.view.dimensions,
      highest: profile.view.highest?.label ?? null,
      lowest: profile.view.lowest?.label ?? null,
    });
  }

  /* 5 · trends */
  if (trend.points.length > 0) {
    slides.push({
      kind: "trend",
      scoreLabel: instrument.primaryScoreLabel,
      scoreMin: instrument.primaryScoreMin,
      scoreMax: instrument.primaryScoreMax,
      waves: trend.points.map((point) => ({
        label: point.label,
        median: point.aggregate.median,
        responses: point.aggregate.completed,
      })),
      movement: trend.medianChange
        ? trend.medianChange.movement === "unchanged"
          ? "The median is unchanged against the previous comparable wave."
          : `The median is ${Math.abs(trend.medianChange.delta)} ${
              Math.abs(trend.medianChange.delta) === 1 ? "point" : "points"
            } ${trend.medianChange.movement} than the previous comparable wave.`
        : null,
      thresholdConsistent: trend.thresholdConsistent,
      thresholds: trend.thresholds,
      suppressedWaves: workspace.trendSuppressedWaves,
    });
  }

  /* 6 · cohort differences — published cohorts ONLY */
  const publishedCohorts = comparison.view.cohorts.filter(
    (cohort) => !cohort.suppressed && cohort.stats,
  );
  if (publishedCohorts.length > 0) {
    slides.push({
      kind: "cohorts",
      dimensionLabel: comparison.view.label,
      scoreLabel: instrument.primaryScoreLabel,
      scoreMin: instrument.primaryScoreMin,
      scoreMax: instrument.primaryScoreMax,
      // A withheld cohort contributes NOTHING here — not a row, not a label,
      // not a null. It is filtered out before the deck exists, so it is absent
      // from the payload the browser receives rather than hidden in it.
      cohorts: publishedCohorts.map((cohort) => ({
        label: cohort.label,
        median: cohort.stats!.median,
        p25: cohort.stats!.p25,
        p75: cohort.stats!.p75,
        participants: cohort.completed ?? 0,
      })),
      withheld: comparison.view.suppressedCount,
      minCohort: context.minCohort,
      distress: instrument.scoreDirection === "higher_is_more_distress",
    });
  }

  /* 7 · cohort movement, where there is more than one wave */
  const movableRows = movement.view.rows.filter(
    (row) => !row.suppressed && row.cells.some((cell) => cell.median !== null),
  );
  if (movement.view.waves.length > 1 && movableRows.length > 0) {
    slides.push({
      kind: "movement",
      dimensionLabel: movement.view.label,
      scoreMin: movement.view.scoreMin,
      scoreMax: movement.view.scoreMax,
      waves: movement.view.waves.map((wave) => wave.label),
      rows: movableRows.map((row) => ({
        label: row.label,
        medians: row.cells.map((cell) => cell.median),
      })),
    });
  }

  /* 8 · areas to explore */
  if (patterns.signals.length > 0) {
    slides.push({
      kind: "signals",
      signals: patterns.signals.map((signal) => ({
        priority: SIGNAL_PRIORITY_LABEL[signal.priority],
        observation: signal.observation,
        evidence: signal.evidence,
        mayMean: signal.mayMean,
        considerExploring: signal.considerExploring,
      })),
    });
  }

  /* 9 · discussion — questions, never recommendations */
  slides.push({
    kind: "discussion",
    instrument: instrument.name,
    notClaims: instrument.notClaims,
    minCohort: context.minCohort,
    points: [
      "Does this match what people are telling their managers, and where does it not?",
      "Which of these differences is worth understanding before anything is decided?",
      "What would we need to know that a questionnaire cannot tell us?",
      "Who else should see this, and what would we want them to do with it?",
      participationPercent !== null && participationPercent < 60
        ? "What would make it easier for more people to take part next time?"
        : "What would we want to measure again, and when?",
    ],
  });

  return {
    campaign: campaignName,
    organisation: organisationName,
    instrument: instrument.name,
    source,
    slides,
  };
}
