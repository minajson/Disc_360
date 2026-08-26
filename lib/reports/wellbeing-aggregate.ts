import type { ReportBar, ReportDocument, ReportSection } from "./model.ts";

/**
 * The management aggregate Wellbeing report, as a document.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THIS DOCUMENT MAY CONTAIN, AND WHAT IT CANNOT.
 *
 * Group figures only. There is no participant name, no email, no individual
 * score, no individual history and no raw response anywhere in the input type
 * — not filtered out later, but absent from the shape, so a future edit cannot
 * pass one in and have it quietly appear on page three.
 *
 * A PDF is the easiest place in a product to lose a privacy guarantee: the
 * screen suppresses a small cohort and the export, built from a different
 * query, does not. So this builder takes cohorts that have ALREADY been
 * through suppression and renders the suppressed ones as their confidentiality
 * state — the hidden figure is not in the document to be recovered, and the
 * hidden n is never printed.
 *
 * WHY IT IS INSTRUMENT-AWARE.
 *
 * A GHQ-12 report with a dimensions page would be asserting a factor structure
 * this product has not validated. A WHO-5 report with subscales would be
 * inventing them. A DISC360 Wellbeing report with a threshold would be
 * applying a cut-off to an unvalidated scale. Pages appear only where the
 * instrument legitimately supports them, and the builder is given no way to
 * force one.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface AggregateCohort {
  label: string;
  /** Distinct people. Null when this cohort is withheld. */
  participants: number | null;
  /** Null when withheld — the figure is absent, not hidden. */
  median: number | null;
  suppressed: boolean;
}

export interface AggregateDistributionBucket {
  label: string;
  count: number;
}

export interface AggregateWave {
  label: string;
  median: number;
  participants: number;
}

export interface AggregateDimension {
  label: string;
  median: number;
}

export interface AggregateSignal {
  priority: string;
  observation: string;
  evidence: string;
  mayMean: string;
  considerExploring: string;
}

export interface WellbeingAggregateReportInput {
  organizationName: string;
  campaignName: string | null;
  instrumentName: string;
  instrumentDescriptor: string;
  scoreLabel: string;
  scoreMin: number;
  scoreMax: number;
  scoreDirectionNote: string;
  /** ISO-8601 of the most recent completion in scope. */
  asOf: string;
  invited: number;
  /** Distinct people who completed at least once. */
  participants: number;
  /** Result rows across all waves — never presented as a headcount. */
  responses: number;
  participation: number | null;
  median: number | null;
  mean: number | null;
  distribution: AggregateDistributionBucket[];
  /** Null for instruments with no validated cut-off. */
  threshold: number | null;
  atOrAboveThresholdShare: number | null;
  medianMovement: string | null;
  cohortLabel: string;
  cohorts: AggregateCohort[];
  /** Empty unless the instrument legitimately has dimensions or subscales. */
  dimensions: AggregateDimension[];
  dimensionsLabel: string;
  /**
   * The maximum a single dimension can reach — NOT the instrument total.
   *
   * A GHQ-28 subscale is seven items scored 0–7 while the instrument total
   * runs 0–28. Drawing the subscales against the total rendered every one of
   * them as a sliver and understated the profile fourfold.
   */
  dimensionsMax: number;
  waves: AggregateWave[];
  /** True when the waves were not all scored against the same threshold. */
  thresholdChanged: boolean;
  signals: AggregateSignal[];
  minCohort: number;
  /** True when built from the illustrative population rather than live data. */
  /**
   * The banner for a document built from synthetic figures, or null for live.
   *
   * A string rather than a boolean because there is more than one synthetic
   * population — the shipped illustration and the local development fixture —
   * and a boolean silently labels one of them as the other. It carried
   * `isDemo` and a fixture-sourced report came out wearing no label at all,
   * which is the failure this banner exists to prevent.
   */
  syntheticBanner: string | null;
  /** Whole-organisation suppression: nothing may be published at all. */
  fullySuppressed: boolean;
}

export const ILLUSTRATIVE_REPORT_BANNER = "ILLUSTRATIVE DEMO DATA";

const AGGREGATE_DISCLAIMER =
  "Wellbeing Pulse questionnaires are screening and reflection tools. They do not provide a diagnosis. This document reports group figures only and describes no individual.";

export function buildWellbeingAggregateReport(
  input: WellbeingAggregateReportInput,
): ReportDocument {
  const sections: ReportSection[] = [];
  const title = input.campaignName ?? input.organizationName;

  /* ── page 1 · campaign snapshot ───────────────────────────────────── */

  const snapshot: string[] = [];
  if (input.syntheticBanner) {
    snapshot.push(
      `${input.syntheticBanner}. Every figure in this document is synthetic and generated for demonstration. It describes no real person, no real team and no real organisation.`,
    );
  }

  if (input.fullySuppressed) {
    snapshot.push(
      `Too few people have completed this pulse for any group figure to be reported. The minimum reporting group is ${input.minCohort} people, and that floor applies to this document exactly as it applies on screen.`,
    );
  } else {
    snapshot.push(
      `${input.participants} ${input.participants === 1 ? "person has" : "people have"} completed the ${input.instrumentName} pulse, across ${input.responses} ${input.responses === 1 ? "response" : "responses"} in total.` +
        (input.participation !== null
          ? ` That is ${input.participation}% of the ${input.invited} people invited.`
          : ""),
    );
    snapshot.push(input.scoreDirectionNote);
  }

  sections.push({
    title: "Campaign snapshot",
    lead: `${input.instrumentName} · ${input.instrumentDescriptor}`,
    paragraphs: snapshot,
  });

  if (input.fullySuppressed) {
    sections.push({
      title: "Why this report is short",
      pageBreakBefore: true,
      paragraphs: [
        `Cohort suppression is applied before any figure is computed, not after. Where fewer than ${input.minCohort} people are in a reported group, no figure for that group exists in this document to be recovered.`,
        "This is the intended behaviour of a small pilot rather than a fault. As participation grows, the same report fills in.",
      ],
    });
    return finish(input, title, sections);
  }

  /* ── page 2 · overall pattern ─────────────────────────────────────── */

  // Empty range at the ends is trimmed, interior zeros are kept.
  //
  // A twenty-nine-point scale printed every bucket including twenty empty
  // ones, which pushed the chart onto a second page that contained nothing but
  // zeros. Interior gaps are part of the shape and stay; leading and trailing
  // dead range describes only the scale, which the lead sentence already
  // states in full.
  const first = input.distribution.findIndex((bucket) => bucket.count > 0);
  const last = input.distribution.findLastIndex((bucket) => bucket.count > 0);
  const shown = first === -1 ? input.distribution : input.distribution.slice(first, last + 1);
  const trimmed = input.distribution.length - shown.length;

  const tallest = Math.max(1, ...shown.map((bucket) => bucket.count));
  const distributionBars: ReportBar[] = shown.map((bucket) => ({
    label: bucket.label,
    value: bucket.count,
    max: tallest,
    note: bucket.count === 1 ? "1 response" : `${bucket.count} responses`,
  }));

  const overall: string[] = [
    `The median ${input.scoreLabel} is ${input.median}${
      input.mean !== null ? `, with a mean of ${input.mean}` : ""
    }. The median is reported first because a single unusually high or low response moves a mean and does not move a median.`,
  ];
  if (input.threshold !== null && input.atOrAboveThresholdShare !== null) {
    overall.push(
      `${input.atOrAboveThresholdShare}% of responses sit at or above the configured threshold of ${input.threshold}. The threshold indicates where a fuller conversation may be warranted. It is a screening cut-off applied to a group total and it establishes nothing about any individual.`,
    );
  }
  if (input.medianMovement) overall.push(input.medianMovement);
  if (trimmed > 0) {
    overall.push(
      `Scores outside ${shown[0]!.label}–${shown[shown.length - 1]!.label} are not shown because no one recorded one. The full scale runs ${input.scoreMin}–${input.scoreMax}.`,
    );
  }

  sections.push({
    title: "Overall pattern",
    pageBreakBefore: true,
    lead: `Distribution of responses across the ${input.scoreMin}–${input.scoreMax} ${input.scoreLabel} range.`,
    bars: distributionBars,
    paragraphs: overall,
  });

  /* ── page 3 · cohort comparison ───────────────────────────────────── */

  const published = input.cohorts.filter((cohort) => !cohort.suppressed);
  const withheld = input.cohorts.filter((cohort) => cohort.suppressed);

  const cohortSection: ReportSection = {
    title: `Comparison by ${input.cohortLabel.toLowerCase()}`,
    pageBreakBefore: true,
    lead: "Groups large enough to report, with the median for each.",
  };

  if (published.length > 0) {
    cohortSection.bars = published.map((cohort) => ({
      label: cohort.label,
      value: cohort.median!,
      max: input.scoreMax,
      note: `n = ${cohort.participants}`,
    }));
  }

  const cohortNotes: string[] = [];
  if (published.length === 0) {
    cohortNotes.push(
      `No group in this comparison is large enough to report while protecting confidentiality.`,
    );
  }
  if (withheld.length > 0) {
    cohortNotes.push(
      `${withheld.length} of ${input.cohorts.length} groups ${withheld.length === 1 ? "is" : "are"} withheld: ${withheld
        .map((cohort) => cohort.label)
        .join(", ")}. Where only one group would fall below the minimum, a second is withheld alongside it — otherwise the hidden group could be worked out by subtraction. The withheld figures are not present in this document.`,
    );
  }
  cohortNotes.push(
    "Groups differ in size, role and circumstance. A difference between them is a starting point for a conversation, not a conclusion about either group.",
  );
  cohortSection.paragraphs = cohortNotes;
  sections.push(cohortSection);

  /* ── page 4 · dimensions or subscales, where legitimate ───────────── */

  if (input.dimensions.length > 0) {
    sections.push({
      title: input.dimensionsLabel,
      pageBreakBefore: true,
      lead: `Median for each, across everyone who completed this pulse.`,
      bars: input.dimensions.map((dimension) => ({
        label: dimension.label,
        value: dimension.median,
        max: input.dimensionsMax,
      })),
      paragraphs: [
        "A lower-scoring area is somewhere a group reported less of an experience during this pulse. It is not a finding about anyone, and no threshold is applied to any of these individually.",
      ],
    });
  }

  /* ── page 5 · trends ──────────────────────────────────────────────── */

  if (input.waves.length > 1) {
    const trendNotes: string[] = [
      "Each point is one wave. Waves with too few completions to protect confidentiality are absent rather than plotted as a gap — a visible gap with a date on it is itself a disclosure about a small wave.",
      "The people completing each wave are not necessarily the same people, so a change between waves can reflect who answered as much as what they reported.",
    ];
    if (input.thresholdChanged) {
      trendNotes.unshift(
        "The screening threshold changed during this period. A threshold-prevalence comparison across that change would not be like for like, so it is not drawn.",
      );
    }

    sections.push({
      title: "Movement across waves",
      pageBreakBefore: true,
      lead: `Median ${input.scoreLabel} by wave, oldest first.`,
      series: {
        points: input.waves.map((wave) => ({ label: wave.label, value: wave.median })),
        max: input.scoreMax,
        ...(input.threshold !== null && !input.thresholdChanged
          ? { threshold: input.threshold, thresholdLabel: `Threshold ${input.threshold}` }
          : {}),
      },
      bullets: input.waves.map(
        (wave) => `${wave.label} · median ${wave.median} · ${wave.participants} participants`,
      ),
      paragraphs: trendNotes,
    });
  }

  /* ── page 6 · signals ─────────────────────────────────────────────── */

  if (input.signals.length > 0) {
    sections.push({
      title: "Areas to explore",
      pageBreakBefore: true,
      lead: "Aggregate patterns worth a conversation, strongest evidence first.",
      // The heading is the tier alone. Column headings render in small caps,
      // and setting a full observation sentence in caps made the one line a
      // reader most needs the hardest line on the page to read.
      columns: input.signals.slice(0, 4).map((signal) => ({
        heading: signal.priority,
        bullets: [
          `Observation: ${signal.observation}`,
          `Evidence: ${signal.evidence}`,
          `What this may mean: ${signal.mayMean}`,
          `Consider exploring: ${signal.considerExploring}`,
        ],
      })),
      paragraphs: [
        "These describe what groups reported. None of them establishes a cause, none is a clinical finding, and none describes an individual.",
      ],
    });
  }

  /* ── page 7 · method and privacy ──────────────────────────────────── */

  const method: string[] = [
    `${input.instrumentName}. ${input.scoreDirectionNote}`,
  ];
  if (input.threshold !== null) {
    method.push(
      `A screening threshold of ${input.threshold} is configured for this organisation. It marks where a fuller conversation may be warranted and is not a diagnostic boundary.`,
    );
  } else {
    method.push(
      "This instrument carries no validated cut-off, so no threshold, band or category is applied anywhere in this report.",
    );
  }

  sections.push({
    title: "Method, privacy and suppression",
    pageBreakBefore: true,
    paragraphs: method,
    bullets: [
      `Minimum reporting group: ${input.minCohort} distinct people. Suppression is applied before a figure is computed, so a withheld figure is absent from this document rather than hidden within it.`,
      "Complementary suppression: where only one group in a comparison would fall below the minimum, a second is withheld alongside it, so the first cannot be recovered by subtraction.",
      "Cohort sizes count distinct people, never responses. Someone completing four waves is one person in every figure here.",
      "Individual answers and individual scores are readable by the participant alone — not by facilitators, not by organisation administrators and not by platform administrators. None appears in this document.",
      "Wellbeing figures are never added to, averaged with or compared against DISC or Focus Pulse results.",
      ...(input.syntheticBanner
        ? [
            `${input.syntheticBanner} — this document was generated from a synthetic population for demonstration and reports on no real workforce.`,
          ]
        : []),
    ],
  });

  return finish(input, title, sections);
}

function finish(
  input: WellbeingAggregateReportInput,
  title: string,
  sections: ReportSection[],
): ReportDocument {
  return {
    product: "wellbeing",
    audience: "aggregate",
    // The organisation or campaign, never a person. The renderer prints this
    // as "Prepared for …" and in the running footer.
    participantName: title,
    productLabel: `${input.instrumentName} · aggregate report`,
    eyebrow: input.syntheticBanner ?? "Management report",
    headline: input.fullySuppressed
      ? "Not yet reportable"
      : `Median ${input.scoreLabel} ${input.median}`,
    summary: input.fullySuppressed
      ? `Fewer than ${input.minCohort} people have completed this pulse, so no group figure can be reported yet.`
      : `${input.participants} participants · ${input.instrumentName}${
          input.participation !== null ? ` · ${input.participation}% participation` : ""
        }`,
    completedAt: input.asOf,
    meta: [
      { label: "Instrument", value: input.instrumentName },
      { label: "Participants", value: String(input.participants) },
      { label: "Responses", value: String(input.responses) },
      ...(input.participation !== null
        ? [{ label: "Participation", value: `${input.participation}%` }]
        : []),
      { label: "Minimum group", value: String(input.minCohort) },
      ...(input.syntheticBanner ? [{ label: "Data", value: input.syntheticBanner }] : []),
    ],
    sections,
    disclaimer: AGGREGATE_DISCLAIMER,
  };
}
