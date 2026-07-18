import { LOOP_LABELS, NOTIFICATION_LABELS } from "../../data/focus-insights.ts";
import { clampScore } from "./geometry.ts";
import type { FocusScores, LoopKey, NotifKey } from "../scoring/focus.ts";

/**
 * Distraction factors for the Focus Lens and Fusion map — a presentation-layer
 * projection of the stored Focus result. No new scoring happens here: every
 * strength is either a stored dimension or the same option weighting the
 * scorer itself applies (the notification map mirrors lib/scoring/focus.ts).
 */

export interface DistractionFactor {
  label: string;
  /** 0–100 pull strength — drives marker size, ring proximity and opacity. */
  strength: number;
}

/** Mirrors the Q3 automaticity weights in lib/scoring/focus.ts. */
const NOTIFICATION_STRENGTH: Record<NotifKey, number> = {
  immediate: 90,
  finishes: 55,
  batches: 25,
  off: 8,
};

export interface FocusFactorInput {
  scores: FocusScores;
  primaryLoop: LoopKey;
  notificationPattern: NotifKey;
}

/**
 * The strongest attention pulls for this profile, strongest first, capped at
 * four so labels never crowd the visual.
 */
export function deriveDistractionFactors(input: FocusFactorInput): DistractionFactor[] {
  const factors: DistractionFactor[] = [
    {
      label: LOOP_LABELS[input.primaryLoop],
      strength: clampScore(input.scores.distraction),
    },
    {
      label: NOTIFICATION_LABELS[input.notificationPattern],
      strength: clampScore(NOTIFICATION_STRENGTH[input.notificationPattern]),
    },
    {
      label: "Mental load",
      strength: clampScore(input.scores.mentalLoad),
    },
    {
      label: "Autopilot checking",
      strength: clampScore(input.scores.automaticity),
    },
  ];

  return factors.sort((a, b) => b.strength - a.strength).slice(0, 4);
}
