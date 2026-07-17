import type { Question, Result } from "../types/index.ts";
import {
  computeDistribution,
  computeNet,
  computeRawScores,
  normalizeScores,
  type AnswerInput,
} from "./pipeline.ts";
import { deriveArchetype, deriveHybridType } from "./archetype.ts";
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
 * raw tallies → net → normalized → distribution → archetype → intensity.
 * Throws ScoringError on invalid answer sets.
 *
 * Two score scales leave this function by design. `normalized` is the
 * per-dimension intensity the archetype thresholds and stored columns use;
 * `distribution` is the share-of-100 split shown to participants. See
 * pipeline.ts for why they differ.
 */
export function computeResult(input: ComputeResultInput): Result {
  const raw = computeRawScores(input.answers, input.questions);
  const net = computeNet(raw);
  const normalized = normalizeScores(net, input.questions.length);
  const distribution = computeDistribution(net, input.questions.length);
  const archetype = deriveArchetype(normalized);

  return {
    id: input.resultId,
    sessionId: input.sessionId,
    userId: input.userId,
    rawMost: raw.most,
    rawLeast: raw.least,
    net,
    normalized,
    distribution,
    archetypeCode: archetype.code,
    hybridType: deriveHybridType(normalized),
    primaryDimension: archetype.primary,
    secondaryDimension: archetype.secondary,
    intensity: segmentAllIntensities(normalized),
    createdAt: input.createdAt,
  };
}
