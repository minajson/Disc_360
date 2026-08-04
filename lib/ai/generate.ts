import "server-only";
import { generateStructured, NARRATIVE_MODEL } from "./client";
import { checkNarrative, payloadLeaks } from "./policy";
import { SYSTEM_PROMPT, userMessage } from "./prompt";
import { narrativeSchema } from "./schema";
import {
  rulesBrief,
  rulesNarrative,
  rulesSummary,
  screenBrief,
  screenSummary,
  toPayload,
  type Narrative,
} from "./narrative";
import type { FacilitatorInsightSet } from "@/lib/insights/facilitator";

/**
 * One generation, end to end.
 *
 * The order matters: build the minimal payload, prove it carries nothing
 * identifying, call the model, then screen everything it wrote. A part that
 * fails screening is replaced by the rule-written version of that part rather
 * than failing the whole generation — a facilitator who asked for a brief gets
 * a brief, and the parts that survived are still the model's.
 */

export interface GenerationOutcome {
  narrative: Narrative;
  source: "model" | "rules";
  model: string | null;
  /** Parts that fell back, for the audit row and the facilitator's notice. */
  fellBack: string[];
  reason: string | null;
  usage: { input: number; output: number } | null;
}

/**
 * The whole generation falling back.
 *
 * Stores the complete rules narrative, cards included, so a facilitator can
 * still edit every line the page shows when no model ran. `fellBack` stays
 * empty here — it means "the model ran and part of it was rejected", which is
 * a different thing from "no model ran", and the provenance field already says
 * which of the two happened.
 */
const wholeFallback = (set: FacilitatorInsightSet, reason: string): GenerationOutcome => ({
  narrative: rulesNarrative(set),
  source: "rules",
  model: null,
  fellBack: [],
  reason,
  usage: null,
});

export async function generateTeamNarrative(
  set: FacilitatorInsightSet,
): Promise<GenerationOutcome> {
  const payload = toPayload(set);

  // Refuse rather than send. If a future change to the evidence layer widens
  // the payload, this stops the first request instead of the tenth.
  const leaks = payloadLeaks(payload);
  if (leaks.length > 0) return wholeFallback(set, `payload-withheld:${leaks.length}`);

  const result = await generateStructured({
    system: SYSTEM_PROMPT,
    user: userMessage(payload),
    schema: narrativeSchema,
  });

  if (!result.ok) return wholeFallback(set, result.reason);

  const fellBack: string[] = [];

  const briefProblems = screenBrief(result.data.brief);
  const brief = briefProblems.length > 0 ? rulesBrief(set) : result.data.brief;
  if (briefProblems.length > 0) fellBack.push("brief");

  const summaryProblems = screenSummary(result.data.summary);
  const summary = summaryProblems.length > 0 ? rulesSummary(set) : result.data.summary;
  if (summaryProblems.length > 0) fellBack.push("summary");

  /*
   * Cards are screened here as well as where they are applied to the
   * deterministic set. The render-time check is the authority — nothing
   * reaches a page without passing it — but replacing a failing card now means
   * what is stored is what will display, so the facilitator edits real text
   * and the notice names exactly which categories the model lost.
   */
  const rules = new Map(rulesNarrative(set).cards.map((card) => [card.category, card]));
  const cards = result.data.cards.map((card) => {
    const fallback = rules.get(card.category);
    if (!fallback) return card;
    const check = checkNarrative({
      headline: card.headline,
      observation: card.observation,
      interpretation: card.interpretation,
    });
    if (check.ok) return card;
    fellBack.push(card.category);
    return fallback;
  });

  return {
    narrative: { cards, brief, summary },
    source: "model",
    model: result.model || NARRATIVE_MODEL,
    fellBack,
    reason: null,
    usage: result.usage,
  };
}
