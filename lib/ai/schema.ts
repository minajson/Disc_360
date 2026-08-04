import { z } from "zod";
import { INSIGHT_ORDER } from "../insights/facilitator.ts";

/**
 * The contract for a generated narrative.
 *
 * Used three times, deliberately the same schema each time: the API enforces
 * it on the way out of the model, the store validates it on the way out of the
 * database, and the tests assert the rules' own narrative satisfies it — so
 * the fallback and the generated version are the same shape, and the UI has
 * one thing to render.
 */

const categories = INSIGHT_ORDER as [string, ...string[]];

export const categorySchema = z.enum(categories);

export const narrativeCardSchema = z.object({
  category: categorySchema,
  headline: z.string(),
  observation: z.string(),
  interpretation: z.array(z.string()),
});

export const narrativeBriefSchema = z.object({
  opening: z.string(),
  observations: z.array(z.string()),
  questions: z.array(z.string()),
  watchPoints: z.array(z.string()),
  actions: z.array(z.string()),
  slideOrder: z.array(categorySchema),
});

export const narrativeSummarySchema = z.object({
  headline: z.string(),
  paragraphs: z.array(z.string()),
});

export const narrativeSchema = z.object({
  cards: z.array(narrativeCardSchema),
  brief: narrativeBriefSchema,
  summary: narrativeSummarySchema,
});

export type NarrativeShape = z.infer<typeof narrativeSchema>;
