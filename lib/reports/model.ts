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

export interface ReportSection {
  title: string;
  lead?: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Two-column guidance, e.g. Do / Avoid. */
  columns?: { heading: string; bullets: string[] }[];
  bars?: ReportBar[];
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
