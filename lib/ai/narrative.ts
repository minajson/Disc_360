import {
  CATEGORY_TITLE,
  INSIGHT_ORDER,
  type FacilitatorInsight,
  type FacilitatorInsightSet,
  type InsightCategory,
} from "../insights/facilitator.ts";
import { leadSentences } from "../insights/board.ts";
import { checkNarrative, screenLines, type NarrativePayload } from "./policy.ts";

/**
 * The narrative layer — pure, so the whole contract with the model is testable
 * without a network call.
 *
 * Division of labour, deliberately strict:
 *
 *   the rules   own every number, sample size, signal, evidence chip and
 *               question, and own a complete narrative of their own;
 *   the model   owns prose only — a headline, a re-worded observation and the
 *               interpretation points, for the team scope, one category at a
 *               time.
 *
 * A model narrative is therefore never *needed*. It is applied card by card on
 * top of the deterministic set, and any card whose prose fails the register
 * check keeps the rule-written text. That is why a bad generation degrades to
 * something correct rather than to an error page.
 */

/* ── what the model may see ─────────────────────────────────────────── */

/**
 * Metric labels are built from dimension metadata and fixed strings, never
 * from a team, department or person. The pattern is asserted in tests so that
 * a future evidence chip carrying free text fails the suite instead of
 * travelling to a third party.
 */
export const SAFE_METRIC = /^[A-Za-z0-9 %+\-–.]+$/;

/**
 * Builds the only payload a model is given.
 *
 * Team scope only. Department-level cards stay entirely deterministic: a
 * department is the smallest group on this surface and the one where prose
 * about "the group" comes closest to describing identifiable people.
 */
export function toPayload(set: FacilitatorInsightSet): NarrativePayload {
  return {
    scopeKind: "team",
    cards: set.insights.map((insight) => ({
      category: insight.category,
      title: insight.title,
      observation: insight.observation,
      interpretation: [...insight.interpretation],
      evidence: insight.evidence.map((chip) => ({
        metric: chip.label,
        value: chip.value,
      })),
      signal: insight.signal,
      sampleSize: insight.sampleSize,
      populationSize: insight.populationSize,
    })),
  };
}

/* ── the shape a model must return ──────────────────────────────────── */

export interface NarrativeCard {
  category: string;
  headline: string;
  observation: string;
  interpretation: string[];
}

export interface NarrativeBrief {
  /** Roughly sixty seconds of opening, in one paragraph. */
  opening: string;
  observations: string[];
  questions: string[];
  watchPoints: string[];
  actions: string[];
  /** Categories in the order the facilitator should present them. */
  slideOrder: string[];
}

export interface NarrativeSummary {
  headline: string;
  paragraphs: string[];
}

export interface Narrative {
  cards: NarrativeCard[];
  brief: NarrativeBrief;
  summary: NarrativeSummary;
}

/** A narrative plus the provenance the UI has to display. */
export interface NarrativeRecord {
  narrative: Narrative;
  source: "model" | "rules";
  model: string | null;
  generatedAt: string;
  editedAt: string | null;
  sharedAt: string | null;
}

/* ── applying a model narrative to the deterministic set ────────────── */

export interface AppliedNarrative {
  set: FacilitatorInsightSet;
  /** Categories whose prose the model wrote. */
  applied: InsightCategory[];
  /** Categories that kept rule-written prose, and why. */
  rejected: { category: string; problems: string[] }[];
}

/**
 * Merges model prose onto the deterministic cards.
 *
 * Everything measured — evidence, signal, sample size, population size and the
 * questions — is taken from the deterministic card, not from the model's
 * reply. A generated card therefore cannot show a figure that was not
 * computed, whatever the model returns.
 */
export function applyNarrative(
  set: FacilitatorInsightSet,
  narrative: Narrative,
): AppliedNarrative {
  const byCategory = new Map(narrative.cards.map((card) => [card.category, card]));
  const applied: InsightCategory[] = [];
  const rejected: { category: string; problems: string[] }[] = [];

  const insights: FacilitatorInsight[] = set.insights.map((insight) => {
    const card = byCategory.get(insight.category);
    if (!card) {
      rejected.push({ category: insight.category, problems: ["no narrative returned"] });
      return insight;
    }
    const check = checkNarrative({
      headline: card.headline,
      observation: card.observation,
      interpretation: card.interpretation,
    });
    if (!check.ok) {
      rejected.push({ category: insight.category, problems: check.problems });
      return insight;
    }
    applied.push(insight.category);
    return {
      ...insight,
      title: card.headline.trim(),
      observation: card.observation.trim(),
      interpretation: card.interpretation.map((line) => line.trim()),
    };
  });

  // Categories the model invented are dropped rather than rendered: a card
  // outside INSIGHT_ORDER has no evidence behind it.
  for (const card of narrative.cards) {
    if (!set.insights.some((insight) => insight.category === card.category)) {
      rejected.push({ category: card.category, problems: ["unknown category"] });
    }
  }

  return { set: { ...set, insights }, applied, rejected };
}

/* ── screening the brief and the summary ────────────────────────────── */

const MAX_BRIEF_LINE = 400;
const MAX_OPENING = 1200;

export function screenBrief(brief: NarrativeBrief): string[] {
  const problems = screenLines([
    brief.opening,
    ...brief.observations,
    ...brief.questions,
    ...brief.watchPoints,
    ...brief.actions,
  ]);
  if (!brief.opening.trim()) problems.push("empty opening");
  if (brief.opening.length > MAX_OPENING) problems.push("opening too long");
  for (const [field, lines] of [
    ["observations", brief.observations],
    ["questions", brief.questions],
    ["watchPoints", brief.watchPoints],
    ["actions", brief.actions],
  ] as const) {
    if (lines.length === 0) problems.push(`empty ${field}`);
    if (lines.some((line) => !line.trim())) problems.push(`blank line in ${field}`);
    if (lines.some((line) => line.length > MAX_BRIEF_LINE)) {
      problems.push(`${field} line too long`);
    }
  }
  const known = new Set<string>(INSIGHT_ORDER);
  if (brief.slideOrder.some((category) => !known.has(category))) {
    problems.push("slide order names an unknown category");
  }
  return problems;
}

export function screenSummary(summary: NarrativeSummary): string[] {
  const problems = screenLines([summary.headline, ...summary.paragraphs]);
  if (!summary.headline.trim()) problems.push("empty headline");
  if (summary.headline.length > 140) problems.push("headline too long");
  if (summary.paragraphs.length === 0) problems.push("empty summary");
  if (summary.paragraphs.some((line) => line.length > 900)) {
    problems.push("summary paragraph too long");
  }
  return problems;
}

/* ── the rules' own narrative ───────────────────────────────────────── */

const byCategory = (set: FacilitatorInsightSet, category: InsightCategory) =>
  set.insights.find((insight) => insight.category === category) ?? null;

/**
 * The brief a facilitator gets when no model has run — or when the one that
 * ran wrote something out of register.
 *
 * Every line is lifted from a deterministic card, so it says exactly what the
 * evidence layer already says, in the order the deck presents it.
 */
export function rulesBrief(set: FacilitatorInsightSet): NarrativeBrief {
  const present = INSIGHT_ORDER.filter((category) => byCategory(set, category) !== null);
  const opener = byCategory(set, "snapshot");
  const coverage = opener
    ? `${opener.sampleSize} of ${opener.populationSize} people have completed the assessment.`
    : "";

  return {
    opening: [
      coverage,
      opener ? leadSentences(opener.observation, 2) : "",
      "Everything here describes preferences the group reported about how it works, in aggregate — not ability, not performance, and not a judgement about anyone in the room.",
    ]
      .filter(Boolean)
      .join(" "),
    observations: present
      .slice(0, 3)
      .map((category) => leadSentences(byCategory(set, category)!.observation, 1)),
    questions: present
      .slice(0, 3)
      .map((category) => byCategory(set, category)!.questions[0])
      .filter((question): question is string => Boolean(question)),
    watchPoints: (["conflict", "inclusion"] as const)
      .map((category) => byCategory(set, category))
      .filter((insight): insight is FacilitatorInsight => insight !== null)
      .map((insight) => `${CATEGORY_TITLE[insight.category]}: ${leadSentences(insight.observation, 1)}`),
    actions: [
      "Put each observation to the room before offering the interpretation, and let the group say whether it recognises itself.",
      "Close on one working agreement the team writes itself, rather than one drawn from the profile.",
    ],
    slideOrder: [...present],
  };
}

/** The rule-written executive summary, used on the same terms as the brief. */
export function rulesSummary(set: FacilitatorInsightSet): NarrativeSummary {
  const snapshot = byCategory(set, "snapshot");
  const decision = byCategory(set, "decision");
  const inclusion = byCategory(set, "inclusion");

  return {
    headline: snapshot ? snapshot.title : "Team profile",
    paragraphs: [snapshot, decision, inclusion]
      .filter((insight): insight is FacilitatorInsight => insight !== null)
      .map((insight) => `${insight.observation} ${leadSentences(insight.interpretation[0] ?? "", 1)}`.trim()),
  };
}

/** The complete rules narrative — the fallback the surface always has. */
export function rulesNarrative(set: FacilitatorInsightSet): Narrative {
  return {
    cards: set.insights.map((insight) => ({
      category: insight.category,
      headline: insight.title,
      observation: insight.observation,
      interpretation: [...insight.interpretation],
    })),
    brief: rulesBrief(set),
    summary: rulesSummary(set),
  };
}
