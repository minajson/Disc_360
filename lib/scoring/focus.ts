import { focusQuestions } from "../../data/focus-questions.ts";

/**
 * Focus Pulse scoring — pure, deterministic, tested. The only entry point is
 * `computeFocusResult`. It never touches I/O and never uses randomness, so the
 * same answers always produce the same result.
 *
 * Non-clinical throughout: the four dimensions describe attention *patterns*,
 * not a dopamine level, a deficiency or any diagnosis.
 */

export class FocusScoringError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "FocusScoringError";
  }
}

export interface FocusScores {
  /** Acting before consciously deciding. */
  automaticity: number;
  /** Susceptibility to being pulled off task. */
  distraction: number;
  /** How busy/overloaded the mind feels. */
  mentalLoad: number;
  /** Readiness to recover focus (higher = recovers more easily). */
  recovery: number;
}

export type LoopKey = "social" | "messages" | "movement" | "easier" | "stays";
export type NotifKey = "immediate" | "finishes" | "batches" | "off";
export type EnergyKey = "morning" | "post_lunch" | "late_afternoon" | "evening" | "steady";
export type ResetKey = "movement" | "quiet" | "priorities" | "talking" | "deadline";

export type FocusPatternCode =
  | "intentional_focuser"
  | "responsive_multitasker"
  | "socially_stimulated"
  | "deadline_activator"
  | "quiet_deep_worker"
  | "overloaded_switcher";

export interface FocusResult {
  scores: FocusScores;
  patternCode: FocusPatternCode;
  primaryLoop: LoopKey;
  notificationPattern: NotifKey;
  energyPattern: EnergyKey;
  preferredReset: ResetKey;
}

export interface FocusAnswerInput {
  /** question external_id */
  questionId: string;
  /** option external_id (single-select questions) */
  optionId?: string | null;
  /** value (scale questions) */
  scaleValue?: number | null;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/* ── weight tables, keyed by option external_id ── */

const Q1_AUTOMATICITY: Record<string, number> = {
  q1_never: 0,
  q1_few: 25,
  q1_several: 55,
  q1_frequent: 80,
  q1_automatic: 100,
};

const Q2: Record<string, { dist: number; load: number; loop: LoopKey }> = {
  q2_social: { dist: 90, load: 70, loop: "social" },
  q2_messages: { dist: 85, load: 65, loop: "messages" },
  q2_movement: { dist: 50, load: 40, loop: "movement" },
  q2_easier: { dist: 60, load: 65, loop: "easier" },
  q2_stay: { dist: 12, load: 25, loop: "stays" },
};

const Q3: Record<string, { auto: number; dist: number; notif: NotifKey }> = {
  q3_immediate: { auto: 90, dist: 95, notif: "immediate" },
  q3_finish: { auto: 45, dist: 55, notif: "finishes" },
  q3_planned: { auto: 20, dist: 25, notif: "batches" },
  q3_disabled: { auto: 5, dist: 5, notif: "off" },
};

const Q4_ENERGY: Record<string, EnergyKey> = {
  q4_morning: "morning",
  q4_lunch: "post_lunch",
  q4_afternoon: "late_afternoon",
  q4_evening: "evening",
  q4_steady: "steady",
};

const Q6: Record<string, { reset: ResetKey; recovery: number }> = {
  q6_movement: { reset: "movement", recovery: 80 },
  q6_quiet: { reset: "quiet", recovery: 85 },
  q6_priorities: { reset: "priorities", recovery: 78 },
  q6_talking: { reset: "talking", recovery: 70 },
  q6_deadline: { reset: "deadline", recovery: 58 },
};

const REQUIRED_IDS = focusQuestions.map((q) => q.id);

/**
 * Builds the FocusResult from six answers. Throws FocusScoringError when the
 * answer set is incomplete or references unknown ids — never guesses.
 */
export function computeFocusResult(answers: FocusAnswerInput[]): FocusResult {
  const byQuestion = new Map(answers.map((a) => [a.questionId, a]));

  for (const id of REQUIRED_IDS) {
    if (!byQuestion.has(id)) {
      throw new FocusScoringError("INCOMPLETE_ANSWERS", `Missing answer for ${id}`);
    }
  }

  const option = (questionId: string): string => {
    const value = byQuestion.get(questionId)?.optionId;
    if (!value) throw new FocusScoringError("MISSING_OPTION", `No option for ${questionId}`);
    return value;
  };

  const q1 = Q1_AUTOMATICITY[option("q1_pickup")];
  const q2 = Q2[option("q2_difficult")];
  const q3 = Q3[option("q3_notification")];
  const q4 = Q4_ENERGY[option("q4_energy")];
  const q6 = Q6[option("q6_reset")];

  const scaleRaw = byQuestion.get("q5_noise")?.scaleValue;
  if (scaleRaw == null) {
    throw new FocusScoringError("MISSING_SCALE", "No value for q5_noise");
  }
  if (!q1 && q1 !== 0) throw new FocusScoringError("UNKNOWN_OPTION", "q1_pickup");
  if (!q2 || !q3 || !q4 || !q6) throw new FocusScoringError("UNKNOWN_OPTION", "focus option");
  if (scaleRaw < 1 || scaleRaw > 10) {
    throw new FocusScoringError("SCALE_OUT_OF_RANGE", `q5_noise ${scaleRaw}`);
  }

  // 1–10 → 0–100.
  const q5 = ((scaleRaw - 1) / 9) * 100;

  const automaticity = clamp(0.65 * q1 + 0.35 * q3.auto);
  const distraction = clamp(0.55 * q2.dist + 0.45 * q3.dist);
  const mentalLoad = clamp(0.75 * q5 + 0.25 * q2.load);
  const recovery = clamp(
    q6.recovery +
      (q4 === "steady" ? 12 : 0) -
      (mentalLoad - 50) * 0.35 -
      (distraction > 70 ? 8 : 0),
  );

  const scores: FocusScores = { automaticity, distraction, mentalLoad, recovery };

  return {
    scores,
    patternCode: derivePattern(scores, q2.loop, q3.notif, q6.reset),
    primaryLoop: q2.loop,
    notificationPattern: q3.notif,
    energyPattern: q4,
    preferredReset: q6.reset,
  };
}

/**
 * Deterministic pattern from the profile. Precedence is the tie-break: the
 * first matching rule wins, and rule 6 is the balanced default.
 */
export function derivePattern(
  scores: FocusScores,
  loop: LoopKey,
  notif: NotifKey,
  reset: ResetKey,
): FocusPatternCode {
  const { automaticity, distraction, mentalLoad } = scores;

  // 1 — Overloaded Switcher: a busy mind and high pull off task together.
  if (mentalLoad >= 65 && distraction >= 60) return "overloaded_switcher";

  // 2 — Deadline Activator: recovers mainly through external pressure.
  if (reset === "deadline") return "deadline_activator";

  // 3 — Socially Stimulated Worker: the pull is toward people/messages.
  if ((loop === "social" || loop === "messages") && distraction >= 45) {
    return "socially_stimulated";
  }

  // 4 — Responsive Multitasker: quick, automatic responder to signals.
  if (automaticity >= 60 && (notif === "immediate" || notif === "finishes")) {
    return "responsive_multitasker";
  }

  // 5 — Quiet Deep Worker: low pull, prefers quiet or rarely automatic.
  if (distraction <= 40 && (reset === "quiet" || automaticity <= 40) && mentalLoad <= 60) {
    return "quiet_deep_worker";
  }

  // 6 — Intentional Focuser: balanced, not dominated by any loop.
  return "intentional_focuser";
}
