/**
 * Focus & Digital Dopamine Pulse — question bank (content).
 *
 * Six questions, one per screen, target completion under 90 seconds. This file
 * holds only what the participant sees; the scoring weights live in
 * lib/scoring/focus.ts keyed by these external ids. Postgres is the runtime
 * source (focus_questions / focus_options, seeded from this file); edit here,
 * then regenerate the seed.
 *
 * Non-clinical by contract: no option or prompt references dopamine, addiction
 * or diagnosis.
 */

export type FocusQuestionKind = "single" | "scale";

export interface FocusOption {
  /** external_id — stable scoring key. */
  id: string;
  label: string;
}

export interface FocusQuestion {
  /** external_id — stable scoring key. */
  id: string;
  position: number;
  prompt: string;
  kind: FocusQuestionKind;
  /** single-select options. */
  options?: FocusOption[];
  /** scale bounds + endpoint labels. */
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
}

export const focusQuestions: readonly FocusQuestion[] = [
  {
    id: "q1_pickup",
    position: 0,
    prompt: "How often do you pick up your phone without consciously deciding to?",
    kind: "single",
    options: [
      { id: "q1_never", label: "Almost never" },
      { id: "q1_few", label: "A few times a day" },
      { id: "q1_several", label: "Several times a day" },
      { id: "q1_frequent", label: "Very frequently" },
      { id: "q1_automatic", label: "It feels almost automatic" },
    ],
  },
  {
    id: "q2_difficult",
    position: 1,
    prompt: "When a work task becomes difficult or uncomfortable, what do you usually do first?",
    kind: "single",
    options: [
      { id: "q2_social", label: "Open social media, news or another browser tab" },
      { id: "q2_messages", label: "Check messages or email" },
      { id: "q2_movement", label: "Get food, coffee or leave the desk" },
      { id: "q2_easier", label: "Switch to a smaller, easier task" },
      { id: "q2_stay", label: "Stay with the task until I make progress" },
    ],
  },
  {
    id: "q3_notification",
    position: 2,
    prompt: "When a notification appears while you are concentrating, what usually happens?",
    kind: "single",
    options: [
      { id: "q3_immediate", label: "I check it immediately" },
      { id: "q3_finish", label: "I finish my current thought, then check" },
      { id: "q3_planned", label: "I wait until a planned break" },
      { id: "q3_disabled", label: "Most notifications are disabled" },
    ],
  },
  {
    id: "q4_energy",
    position: 3,
    prompt: "When does your concentration usually decline most sharply?",
    kind: "single",
    options: [
      { id: "q4_morning", label: "Before midday" },
      { id: "q4_lunch", label: "Just after lunch" },
      { id: "q4_afternoon", label: "Late afternoon" },
      { id: "q4_evening", label: "Evening" },
      { id: "q4_steady", label: "My energy is generally steady" },
    ],
  },
  {
    id: "q5_noise",
    position: 4,
    prompt: "How noisy does your mind feel right now?",
    kind: "scale",
    scaleMin: 1,
    scaleMax: 10,
    scaleMinLabel: "Calm and clear",
    scaleMaxLabel: "Overloaded and constantly switching",
  },
  {
    id: "q6_reset",
    position: 5,
    prompt: "What helps you regain focus most effectively?",
    kind: "single",
    options: [
      { id: "q6_movement", label: "A short walk or physical movement" },
      { id: "q6_quiet", label: "Quiet time without notifications" },
      { id: "q6_priorities", label: "A clear priority list" },
      { id: "q6_talking", label: "Talking the problem through with someone" },
      { id: "q6_deadline", label: "A deadline or external pressure" },
    ],
  },
] as const;

export const FOCUS_QUESTION_COUNT = focusQuestions.length;

/** External id → question, for validation and lookups. */
export const focusQuestionById = new Map(focusQuestions.map((q) => [q.id, q]));
