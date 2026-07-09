import type { Question, Result } from "../types/index.ts";
import {
  computeNet,
  computeRawScores,
  normalizeScores,
  type AnswerInput,
} from "./pipeline.ts";
import { deriveArchetype } from "./archetype.ts";
import { segmentAllIntensities } from "./intensity.ts";

export interface ComputeResultInput {
  resultId: string;
  sessionId: string;
  userId: string;
  answers: AnswerInput[];
  questions: Question[];
  /** Injected so the pipeline stays pure and deterministic. */
  createdAt: string;
}

/**
 * The single scoring entry point the API layer calls:
 * raw tallies → net → normalized → archetype → intensity bands.
 * Throws ScoringError on invalid answer sets.
 */
export function computeResult(input: ComputeResultInput): Result {
  const raw = computeRawScores(input.answers, input.questions);
  const net = computeNet(raw);
  const normalized = normalizeScores(net, input.questions.length);
  const archetype = deriveArchetype(normalized);

  return {
    id: input.resultId,
    sessionId: input.sessionId,
    userId: input.userId,
    rawMost: raw.most,
    rawLeast: raw.least,
    net,
    normalized,
    archetypeCode: archetype.code,
    primaryDimension: archetype.primary,
    secondaryDimension: archetype.secondary,
    intensity: segmentAllIntensities(normalized),
    createdAt: input.createdAt,
  };
}
