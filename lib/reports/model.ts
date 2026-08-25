import { DIMENSIONS, type ArchetypeCode, type Dimension, type DiscScores } from "../types/index.ts";
import { dimensionMeta } from "../../data/dimension-meta.ts";
import { insightMap, type ArchetypeInsight } from "../../data/insight-maps.ts";
import { displayArchetypeCode } from "../utils/display.ts";
import { combinedInsights } from "../insights/combined.ts";
import {
  ENERGY_LABELS,
  FOCUS_DIMENSION_META,
  FOCUS_PATTERNS,
  LOOP_LABELS,
  NOTIFICATION_LABELS,
  RESET_LABELS,
} from "../../data/focus-insights.ts";
import type { FocusResult, FocusScores } from "../scoring/focus.ts";
import type { ReportProduct } from "./identity.ts";

/**
 * The individual report, as a document.
 *
 * This is the ONE reading of a participant's result that both the web page and
 * the PDF are built from. Nothing here computes a score: every number arrives
 * already computed by `lib/scoring/*` and every phrase already written by
 * `data/insight-maps.ts`, `data/focus-insights.ts` or `lib/insights/combined.ts`.
 * The model only decides what belongs in a personal report — which is also why
 * it is the right place to enforce that nothing team-scoped ever can.
 *
 * Pure and unit-tested, so "the PDF says something the page does not" is a
 * test failure rather than a support ticket.
 */

export interface ReportMetaItem {
  label: string;
  value: string;
}

/** A labelled 0–100 measure. `max` stays explicit so the renderer never guesses. */
export interface ReportBar {
  label: string;
  value: number;
  max: number;
  note?: string;
  /** Data-identifier tint. DISC colours are for data only — never chrome. */
  tone?: Dimension;
}

/**
 * A 0–N screening scale with a marked threshold.
 *
 * Its own primitive rather than a `ReportBar`, because a bar says "how much of
 * the maximum" and this says "where the count sits relative to a configured
 * line". Rendering it as a filled bar would imply a proportion of something.
 */
export interface ReportScale {
  label: string;
  value: number;
  max: number;
  /** Marked with a rule and a caption; never used to recolour the whole track. */
  threshold: number;
  /** Text beneath the scale, e.g. the at/below-threshold outcome. */
  caption?: string;
  atOrAboveThreshold?: boolean;
}

export interface ReportSeriesPoint {
  label: string;
  value: number;
}

/** A small line chart — used for a participant's own history over time. */
export interface ReportSeries {
  points: ReportSeriesPoint[];
  max: number;
  /** Dashed reference rule, e.g. the screening threshold. */
  threshold?: number;
  thresholdLabel?: string;
}

export interface ReportSection {
  title: string;
  lead?: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Two-column guidance, e.g. Do / Avoid. */
  columns?: { heading: string; bullets: string[] }[];
  bars?: ReportBar[];
  /** A 0–N score against a marked threshold. */
  scale?: ReportScale;
  /** A line chart of values over time. */
  series?: ReportSeries;
  /** Start this section on a fresh page. Used for deliberate page structure. */
  pageBreakBefore?: boolean;
}

export interface ReportDocument {
  product: ReportProduct;
  /** Name as it appears on the report and in the filename. */
  participantName: string;
  productLabel: string;
  eyebrow: string;
  headline: string;
  summary: string;
  /** ISO-8601. */
  completedAt: string;
  meta: ReportMetaItem[];
  sections: ReportSection[];
  disclaimer: string;
}

const DISC_DISCLAIMER =
  "DISC360 is a development tool — not a medical, clinical or employment-selection instrument.";
const FOCUS_DISCLAIMER =
  "The Focus Pulse describes attention patterns and habits. It is not a medical or clinical measure and is not a diagnosis.";

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

const score = (scores: DiscScores, dim: Dimension): number =>
  scores[dim.toLowerCase() as keyof DiscScores];

function discBars(scores: DiscScores): ReportBar[] {
  return DIMENSIONS.map((dim) => ({
    label: `${dimensionMeta[dim].displayCode} · ${dimensionMeta[dim].label}`,
    value: score(scores, dim),
    max: 100,
    tone: dim,
  }));
}

function focusBars(scores: FocusScores): ReportBar[] {
  return FOCUS_DIMENSION_META.map((meta) => ({
    label: meta.label,
    value: scores[meta.key],
    max: 100,
    note: meta.description,
  }));
}

export interface DiscReportInput {
  participantName: string;
  completedAt: string;
  scores: DiscScores;
  archetypeCode: ArchetypeCode;
  primary: Dimension;
  secondary: Dimension | null;
  /** The snapshot stored at completion, so a historical report reads as it did. */
  insight?: ArchetypeInsight;
}

export function buildDiscReport(input: DiscReportInput): ReportDocument {
  const insight = input.insight ?? insightMap[input.archetypeCode];
  const meta: ReportMetaItem[] = [
    { label: "Profile", value: insight.name },
    { label: "Blend", value: displayArchetypeCode(input.archetypeCode) },
    { label: "Primary style", value: dimensionMeta[input.primary].label },
    ...(input.secondary
      ? [{ label: "Supporting style", value: dimensionMeta[input.secondary].label }]
      : []),
    { label: "Completed", value: formatDate(input.completedAt) },
  ];

  const sections: ReportSection[] = [
    {
      title: "Your dimension profile",
      lead: "Each dimension is scored 0–100 for intensity. They describe emphasis, not ability.",
      bars: discBars(input.scores),
    },
    {
      title: "Strengths",
      bullets: insight.strengths.map((item) => `${item.title}. ${item.detail}`),
    },
    {
      title: "Blind spots",
      lead: "Patterns worth watching — each one is the shadow of a strength, not a flaw.",
      bullets: insight.blindSpots.map((item) => `${item.title}. ${item.detail}`),
    },
    {
      title: "Communication",
      lead: "How you tend to communicate.",
      bullets: insight.communicationStyle,
      columns: [
        { heading: "What works with you", bullets: insight.communication.do },
        { heading: "What to avoid", bullets: insight.communication.dont },
      ],
    },
    {
      title: "Leadership",
      lead: insight.leadershipStyle.headline,
      paragraphs: [insight.leadershipStyle.description],
      bullets: insight.leadershipStyle.bullets,
    },
    {
      title: "Conflict",
      lead: insight.conflictResponse.headline,
      paragraphs: [insight.conflictResponse.description],
      bullets: insight.conflictResponse.tips,
    },
    {
      title: "Under pressure",
      columns: [
        { heading: "Triggers", bullets: insight.stressResponse.triggers },
        { heading: "How it shows", bullets: insight.stressResponse.behaviors },
        { heading: "Recovery", bullets: insight.stressResponse.recovery },
      ],
    },
    {
      title: "What fuels and drains you",
      columns: [
        { heading: "Fuels you", bullets: insight.motivators },
        { heading: "Drains you", bullets: insight.drainers },
      ],
    },
    {
      title: "Where you do your best work",
      bullets: insight.idealEnvironment,
    },
    {
      title: "Recommendations",
      paragraphs: [insight.coaching],
    },
    {
      title: "Working with the four styles",
      lead: "Practical adjustments for the people around you.",
      bullets: DIMENSIONS.map((dim) => {
        const guide = insightMap[dim];
        const first = guide.communication.do[0] ?? dimensionMeta[dim].underPressure;
        return `${dimensionMeta[dim].label} (${dimensionMeta[dim].displayCode}): ${first}`;
      }),
    },
  ];

  return {
    product: "disc",
    participantName: input.participantName,
    productLabel: "DISC Behaviour Profile",
    eyebrow: `Individual report · ${displayArchetypeCode(input.archetypeCode)}`,
    headline: insight.name,
    summary: insight.summary,
    completedAt: input.completedAt,
    meta,
    sections,
    disclaimer: DISC_DISCLAIMER,
  };
}

export interface FocusReportInput {
  participantName: string;
  completedAt: string;
  focus: FocusResult;
}

export function buildFocusReport(input: FocusReportInput): ReportDocument {
  const { focus } = input;
  const pattern = FOCUS_PATTERNS[focus.patternCode];

  return {
    product: "focus",
    participantName: input.participantName,
    productLabel: "Focus & Digital Dopamine Pulse",
    eyebrow: "Individual report · Attention pattern",
    headline: pattern.name,
    summary: pattern.summary,
    completedAt: input.completedAt,
    meta: [
      { label: "Attention pattern", value: pattern.name },
      { label: "Top distraction loop", value: LOOP_LABELS[focus.primaryLoop] },
      { label: "Notification response", value: NOTIFICATION_LABELS[focus.notificationPattern] },
      { label: "Energy pattern", value: ENERGY_LABELS[focus.energyPattern] },
      { label: "Preferred reset", value: RESET_LABELS[focus.preferredReset] },
      { label: "Completed", value: formatDate(input.completedAt) },
    ],
    sections: [
      {
        title: "Your attention measures",
        lead: "Four measures of how attention behaves for you day to day.",
        bars: focusBars(focus.scores),
      },
      {
        title: "Three things to try",
        bullets: pattern.recommendations,
      },
    ],
    disclaimer: FOCUS_DISCLAIMER,
  };
}

export interface CombinedReportInput {
  participantName: string;
  completedAt: string;
  scores: DiscScores;
  archetypeCode: ArchetypeCode;
  primary: Dimension;
  secondary: Dimension | null;
  insight?: ArchetypeInsight;
  focus: FocusResult;
}

export function buildCombinedReport(input: CombinedReportInput): ReportDocument {
  const disc = buildDiscReport(input);
  const focusReport = buildFocusReport({
    participantName: input.participantName,
    completedAt: input.completedAt,
    focus: input.focus,
  });
  const pattern = FOCUS_PATTERNS[input.focus.patternCode];
  const fusion = combinedInsights(input.primary, input.focus);

  return {
    product: "combined",
    participantName: input.participantName,
    productLabel: "Combined DISC + Focus Profile",
    eyebrow: `Individual report · ${displayArchetypeCode(input.archetypeCode)} × ${pattern.name}`,
    headline: `${disc.headline} · ${pattern.name}`,
    summary: disc.summary,
    completedAt: input.completedAt,
    meta: [
      ...disc.meta.filter((item) => item.label !== "Completed"),
      { label: "Attention pattern", value: pattern.name },
      { label: "Top distraction loop", value: LOOP_LABELS[input.focus.primaryLoop] },
      { label: "Completed", value: formatDate(input.completedAt) },
    ],
    sections: [
      {
        title: "Behaviour × attention",
        lead: "How your behavioural style and your attention pattern interact.",
        bullets: fusion.interactions,
      },
      {
        title: "Combined strengths and blind spots",
        columns: [
          { heading: "Strengths", bullets: fusion.strengths },
          { heading: "Blind spots", bullets: fusion.blindSpots },
        ],
      },
      {
        title: "Combined recommendations",
        columns: [
          { heading: "Communication", bullets: fusion.communicationRecommendations },
          { heading: "Focus", bullets: fusion.focusRecommendations },
        ],
      },
      {
        title: "How others can support you",
        bullets: fusion.supportSuggestions,
      },
      ...focusReport.sections,
      ...disc.sections,
    ],
    disclaimer: `${DISC_DISCLAIMER} ${FOCUS_DISCLAIMER}`,
  };
}


/* ── Wellbeing Pulse ────────────────────────────────────────────────── */

export interface WellbeingReportHistoryPoint {
  completedAt: string;
  totalScore: number;
  threshold: number;
}

export interface WellbeingReportInput {
  participantName: string;
  completedAt: string;
  totalScore: number;
  maxScore: number;
  threshold: number;
  atOrAboveThreshold: boolean;
  /** Copy comes from data/wellbeing-content.ts, already safety-screened. */
  outcomeHeadline: string;
  outcomeBody: string;
  outcomeDetail: string;
  scoreMeaning: string;
  disclaimer: string;
  /** Oldest first. Empty or single-entry histories draw no chart. */
  history: WellbeingReportHistoryPoint[];
  movementLabel?: string;
  movementDetail?: string;
  movementCaveat?: string;
  departmentAtCompletion?: string | null;
  workLocationAtCompletion?: string | null;
  officeLocationAtCompletion?: string | null;
  questionnaireVersion: number;
  scoringVersion: string;
  attemptNumber?: number | null;
}

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

/**
 * The private Wellbeing Pulse report.
 *
 * What this deliberately does NOT contain, in a report the participant may
 * forward or print: any organisational figure, any cohort median, any
 * comparison against colleagues, any DISC or Focus result, and any item-level
 * breakdown. A personal wellbeing report is the person's own score, their own
 * history, and the disclaimer — nothing that would let a reader place them
 * against anybody else.
 *
 * The Likert 0–36 measure is likewise absent. It is stored for research and
 * trend work, and showing a second, larger-looking number beside the screening
 * score would invite exactly the misreading the two-scale separation exists to
 * prevent.
 */
export function buildWellbeingReport(input: WellbeingReportInput): ReportDocument {
  const meta: ReportMetaItem[] = [
    { label: "Screening score", value: `${input.totalScore} / ${input.maxScore}` },
    { label: "Screening threshold", value: String(input.threshold) },
    { label: "Completed", value: formatDate(input.completedAt) },
  ];
  if (input.attemptNumber) {
    meta.push({ label: "Pulse number", value: String(input.attemptNumber) });
  }
  if (input.departmentAtCompletion) {
    meta.push({ label: "Department / Function", value: input.departmentAtCompletion });
  }
  if (input.workLocationAtCompletion) {
    meta.push({
      label: "Work location",
      value: input.officeLocationAtCompletion
        ? `${input.workLocationAtCompletion} · ${input.officeLocationAtCompletion}`
        : input.workLocationAtCompletion,
    });
  }

  const sections: ReportSection[] = [
    {
      title: "Your screening score",
      scale: {
        label: "GHQ-12 screening score",
        value: input.totalScore,
        max: input.maxScore,
        threshold: input.threshold,
        atOrAboveThreshold: input.atOrAboveThreshold,
        caption: input.outcomeBody,
      },
      paragraphs: [input.outcomeDetail, input.scoreMeaning],
    },
  ];

  // The trend only exists once there is something to compare against.
  if (input.history.length > 1) {
    sections.push({
      title: "Your pulses over time",
      lead: input.movementLabel,
      series: {
        points: input.history.map((point) => ({
          label: shortDate(point.completedAt),
          value: point.totalScore,
        })),
        max: input.maxScore,
        threshold: input.threshold,
        thresholdLabel: `Threshold ${input.threshold}`,
      },
      paragraphs: [input.movementDetail, input.movementCaveat].filter(
        (value): value is string => Boolean(value),
      ),
    });
  }

  sections.push({
    title: "What this is, and what it is not",
    paragraphs: [input.disclaimer],
    bullets: [
      "Your individual answers and score are private to you. Your manager, your facilitator and platform administrators cannot see them.",
      "Group reporting only ever uses figures for groups large enough that no one in them can be identified.",
      "This result is never combined with, compared against or added to any other assessment.",
      `Questionnaire version ${input.questionnaireVersion} · scoring version ${input.scoringVersion}.`,
    ],
  });

  return {
    product: "wellbeing",
    participantName: input.participantName,
    productLabel: "Wellbeing Pulse",
    eyebrow: "Private report",
    headline: input.outcomeHeadline,
    summary: input.outcomeBody,
    completedAt: input.completedAt,
    meta,
    sections,
    disclaimer: input.disclaimer,
  };
}


/* ── DISC360 Wellbeing Pulse V1 ─────────────────────────────────────── */

export interface DiscWellbeingReportDimension {
  label: string;
  /** 0–100. */
  index: number;
  description: string;
}

export interface DiscWellbeingReportHistoryPoint {
  completedAt: string;
  index: number;
}

export interface DiscWellbeingDimensionHistory {
  label: string;
  points: DiscWellbeingReportHistoryPoint[];
}

export interface DiscWellbeingReportInput {
  participantName: string;
  completedAt: string;
  /** 0–100. */
  wellbeingIndex: number;
  /** 0–48, shown as provenance rather than as a headline. */
  rawScore: number;
  rawMax: number;
  indexLabel: string;
  indexMeaning: string;
  noBandsNote: string;
  dimensionLead: string;
  dimensions: DiscWellbeingReportDimension[];
  /** Copy comes from data/disc360-wellbeing-content.ts, already screened. */
  strongestHeading: string;
  strongestLine: string;
  lowestHeading: string;
  lowestLine: string;
  patternNote: string;
  disclaimer: string;
  /** Oldest first, this instrument only. */
  history: DiscWellbeingReportHistoryPoint[];
  movementLabel?: string;
  movementDetail?: string;
  sinceFirstDetail?: string;
  movementCaveat?: string;
  dimensionHistory: DiscWellbeingDimensionHistory[];
  departmentAtCompletion?: string | null;
  workLocationAtCompletion?: string | null;
  officeLocationAtCompletion?: string | null;
  questionnaireVersion: number;
  scoringVersion: string;
  attemptNumber?: number | null;
}

/**
 * The private DISC360 Wellbeing Pulse report.
 *
 * Three deliberate pages: the current pulse, the person's own pattern, and
 * their history.
 *
 * What it does NOT contain: any organisational figure, any cohort median, any
 * comparison against colleagues, any other instrument, any band, any
 * threshold, and any management recommendation. "Currently higher" and
 * "currently lower" are relative to this person's own other dimensions on this
 * pulse — nothing here grades them, because V1 is not validated and has no
 * scale on which grading would mean anything.
 */
export function buildDiscWellbeingReport(input: DiscWellbeingReportInput): ReportDocument {
  const meta: ReportMetaItem[] = [
    { label: input.indexLabel, value: `${input.wellbeingIndex} / 100` },
    { label: "Completed", value: formatDate(input.completedAt) },
  ];
  if (input.attemptNumber) {
    meta.push({ label: "Pulse number", value: String(input.attemptNumber) });
  }
  if (input.departmentAtCompletion) {
    meta.push({ label: "Department / Function", value: input.departmentAtCompletion });
  }
  if (input.workLocationAtCompletion) {
    meta.push({
      label: "Work location",
      value: input.officeLocationAtCompletion
        ? `${input.workLocationAtCompletion} · ${input.officeLocationAtCompletion}`
        : input.workLocationAtCompletion,
    });
  }

  const dimensionBars: ReportBar[] = input.dimensions.map((dimension) => ({
    label: dimension.label,
    value: dimension.index,
    max: 100,
    note: dimension.description,
  }));

  const sections: ReportSection[] = [
    {
      title: "Your Wellbeing Index",
      // A 0–100 index with no threshold: the scale is drawn with its marker
      // past the end, so no line is implied anywhere on it.
      scale: {
        label: input.indexLabel,
        value: input.wellbeingIndex,
        max: 100,
        threshold: 101,
        atOrAboveThreshold: false,
        caption: `${input.rawScore} of ${input.rawMax} points across twelve questions.`,
      },
      paragraphs: [input.indexMeaning, input.noBandsNote],
    },
    {
      title: "Your six dimensions",
      lead: input.dimensionLead,
      bars: dimensionBars,
    },
    {
      title: "Your pattern",
      pageBreakBefore: true,
      lead: input.patternNote,
      columns: [
        { heading: input.strongestHeading, bullets: [input.strongestLine].filter(Boolean) },
        { heading: input.lowestHeading, bullets: [input.lowestLine].filter(Boolean) },
      ],
    },
  ];

  if (input.history.length > 1) {
    sections.push({
      title: "Your history",
      pageBreakBefore: true,
      lead: input.movementLabel,
      series: {
        points: input.history.map((point) => ({
          label: shortDate(point.completedAt),
          value: point.index,
        })),
        max: 100,
      },
      paragraphs: [input.movementDetail, input.sinceFirstDetail, input.movementCaveat].filter(
        (value): value is string => Boolean(value),
      ),
    });

    // Dimension movement, only where there is movement to show.
    for (const dimension of input.dimensionHistory) {
      if (dimension.points.length < 2) continue;
      sections.push({
        title: `${dimension.label} over time`,
        series: {
          points: dimension.points.map((point) => ({
            label: shortDate(point.completedAt),
            value: point.index,
          })),
          max: 100,
        },
      });
    }
  }

  sections.push({
    title: "What this is, and what it is not",
    pageBreakBefore: input.history.length > 1 ? false : true,
    paragraphs: [input.disclaimer],
    bullets: [
      "Your individual answers and your index are private to you. Your manager, your facilitator and platform administrators cannot see them.",
      "Group reporting only ever uses figures for groups large enough that no one in them can be identified.",
      "This result is never combined with, compared against or added to any other assessment.",
      `DISC360 Wellbeing Pulse V1 · questionnaire version ${input.questionnaireVersion} · scoring version ${input.scoringVersion}.`,
    ],
  });

  return {
    product: "wellbeing",
    participantName: input.participantName,
    productLabel: "DISC360 Wellbeing Pulse",
    eyebrow: "Private report",
    headline: `Wellbeing Index ${input.wellbeingIndex}`,
    summary: input.indexMeaning,
    completedAt: input.completedAt,
    meta,
    sections,
    disclaimer: input.disclaimer,
  };
}
