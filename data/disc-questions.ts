import { assessmentScenarios } from "./assessment-scenarios.ts";
import type { Dimension as InternalDimension, Question } from "@/lib/types";
import type { Dimension as FacingDimension } from "./assessment-scenarios.ts";

/**
 * Adapter: authored scenarios (user-facing D/I/S/A) → internal question bank
 * (D/I/S/C). The database, scoring pipeline and stored results all key
 * Analytical as "C"; only authoring and display use "A". Keeping the
 * translation in exactly one place is what lets the interface say
 * "Analytical" without migrating years of result rows.
 *
 * Content lives in ./assessment-scenarios.ts — edit there, not here.
 *
 * Type-only imports from "@/lib/types" are erased before execution, which is
 * what lets the Node test runner import this module without path aliases.
 */

const INTERNAL_DIMENSION: Record<FacingDimension, InternalDimension> = {
  D: "D",
  I: "I",
  S: "S",
  A: "C",
};

export const discQuestions: Question[] = assessmentScenarios.map(
  (scenario, index) => ({
    id: scenario.id,
    index,
    prompt: scenario.prompt,
    options: scenario.options.map((option) => ({
      id: option.id,
      label: option.text,
      dimension: INTERNAL_DIMENSION[option.dimension],
    })) as Question["options"],
  }),
);

export const TOTAL_QUESTIONS = discQuestions.length;
