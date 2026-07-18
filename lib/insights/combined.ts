import type { Dimension } from "@/lib/types";
import type { FocusResult } from "@/lib/scoring/focus";

/**
 * Behaviour × attention interaction insights — pure and rule-based.
 *
 * Connects a DISC profile with a Focus profile. Every line is phrased as a
 * possibility, never a diagnosis. The DISC primary uses the internal key
 * ("C" = Analytical); callers render the display letter.
 */

export interface CombinedInsights {
  /** The headline behaviour × attention interactions that apply. */
  interactions: string[];
  strengths: string[];
  blindSpots: string[];
  communicationRecommendations: string[];
  focusRecommendations: string[];
  /** For a manager or colleague supporting this person. */
  supportSuggestions: string[];
}

const HIGH = 60;

/** Whether a Focus dimension is prominent enough to interact. */
const isHigh = (value: number) => value >= HIGH;

export function combinedInsights(
  discPrimary: Dimension,
  focus: FocusResult,
): CombinedInsights {
  const { scores, primaryLoop, preferredReset } = focus;
  const interactions: string[] = [];
  const strengths: string[] = [];
  const blindSpots: string[] = [];
  const communication: string[] = [];
  const focusRecs: string[] = [];
  const support: string[] = [];

  const messagePull = primaryLoop === "messages" || primaryLoop === "social";

  // The four signature interactions from the product brief.
  if (discPrimary === "D" && isHigh(scores.distraction)) {
    interactions.push(
      "May respond quickly to urgent signals and lose protected focus time.",
    );
    strengths.push("Fast to act on what matters and unblock the team.");
    blindSpots.push("Urgency can crowd out the deep, uninterrupted work.");
    focusRecs.push("Pre-commit one protected block a day where urgent still waits.");
  }

  if (discPrimary === "I" && (messagePull || isHigh(scores.distraction))) {
    interactions.push(
      "May gain energy from interaction but experience fragmented deep work.",
    );
    strengths.push("Draws energy and momentum from people and conversation.");
    blindSpots.push("Constant responsiveness can fragment concentrated work.");
    focusRecs.push("Batch messages into a few windows so deep work stays whole.");
  }

  if (discPrimary === "S" && (isHigh(scores.mentalLoad) || focus.energyPattern !== "steady")) {
    interactions.push(
      "May need transition time after unexpected changes.",
    );
    strengths.push("Brings steadiness and dependable follow-through.");
    blindSpots.push("Sudden context switches can disrupt rhythm and recovery.");
    focusRecs.push("Ask for changes with lead time; take a short reset after a switch.");
  }

  if (discPrimary === "C" && (isHigh(scores.mentalLoad) || isHigh(scores.automaticity))) {
    interactions.push(
      "May become caught in repeated checking or refinement.",
    );
    strengths.push("Protects quality and catches what others miss.");
    blindSpots.push("Checking and refining can loop past the point of value.");
    focusRecs.push("Set a 'good enough' checkpoint before a final pass.");
  }

  // A general interaction so every profile gets at least one line.
  if (interactions.length === 0) {
    interactions.push(
      "Your behavioural style and attention pattern are currently well matched — few strong pulls compete with how you like to work.",
    );
    strengths.push("Behaviour and attention are working together, not against each other.");
  }

  // Communication recommendation keyed on the behavioural primary.
  const commByDim: Record<Dimension, string> = {
    D: "Say the headline and the deadline first; detail can follow.",
    I: "Open with the why and the people; keep energy in the room.",
    S: "Signal changes early and confirm everyone is comfortable.",
    C: "Lead with the evidence and the standard; give time to review.",
  };
  communication.push(commByDim[discPrimary]);
  if (messagePull) {
    communication.push("Agree response-time norms so 'I'll reply later' feels safe.");
  }

  // Focus recommendation from the preferred reset (always at least one).
  const resetRec: Record<FocusResult["preferredReset"], string> = {
    movement: "Use a short walk between deep-work blocks to reset attention.",
    quiet: "Protect quiet, notification-free windows as real appointments.",
    priorities: "Start the day by naming the one task that must move.",
    talking: "Use a quick conversation to unblock, then close the channel.",
    deadline: "Set interim deadlines so focus arrives before the last minute.",
  };
  focusRecs.push(resetRec[preferredReset]);

  // Support suggestions for a manager/colleague.
  support.push(
    `When supporting this person, ${commByDim[discPrimary].toLowerCase()}`,
  );
  if (isHigh(scores.mentalLoad)) {
    support.push("Help protect focus time and reduce competing inputs when load is high.");
  } else {
    support.push("Keep interruptions predictable and batched where you can.");
  }

  return {
    interactions,
    strengths,
    blindSpots: blindSpots.length ? blindSpots : ["No strong tension between style and attention right now."],
    communicationRecommendations: communication,
    focusRecommendations: focusRecs,
    supportSuggestions: support,
  };
}
