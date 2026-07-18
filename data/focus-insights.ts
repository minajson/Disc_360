import type {
  EnergyKey,
  FocusPatternCode,
  LoopKey,
  NotifKey,
  ResetKey,
} from "@/lib/scoring/focus";

/**
 * Display copy for Focus Pulse results — labels for the derived keys, plus a
 * name, summary and three practical recommendations per pattern.
 *
 * Careful, non-clinical language: attention pattern, stimulation habit,
 * distraction loop, mental load, focus recovery. Never dopamine, deficiency,
 * addiction or diagnosis. Everything is phrased as a possibility.
 */

export const LOOP_LABELS: Record<LoopKey, string> = {
  social: "Social feeds & news",
  messages: "Messages & email",
  movement: "Movement & food",
  easier: "Easier tasks",
  stays: "Stays on task",
};

export const NOTIFICATION_LABELS: Record<NotifKey, string> = {
  immediate: "Immediate checker",
  finishes: "Finishes the thought first",
  batches: "Batches at breaks",
  off: "Notifications mostly off",
};

export const ENERGY_LABELS: Record<EnergyKey, string> = {
  morning: "Morning dip",
  post_lunch: "Post-lunch dip",
  late_afternoon: "Late-afternoon dip",
  evening: "Evening dip",
  steady: "Steady through the day",
};

export const RESET_LABELS: Record<ResetKey, string> = {
  movement: "Movement",
  quiet: "Quiet, notification-free time",
  priorities: "A clear priority list",
  talking: "Talking it through",
  deadline: "A deadline or external pressure",
};

export interface FocusDimensionMeta {
  key: "automaticity" | "distraction" | "mentalLoad" | "recovery";
  label: string;
  description: string;
  /** CSS color token for charts. */
  color: string;
}

export const FOCUS_DIMENSION_META: FocusDimensionMeta[] = [
  {
    key: "automaticity",
    label: "Automaticity",
    description: "How often attention shifts before you consciously decide.",
    color: "var(--color-disc-d)",
  },
  {
    key: "distraction",
    label: "Distraction susceptibility",
    description: "How readily focus is pulled toward other signals.",
    color: "var(--color-disc-i)",
  },
  {
    key: "mentalLoad",
    label: "Mental load",
    description: "How busy or full the mind feels right now.",
    color: "var(--color-disc-c)",
  },
  {
    key: "recovery",
    label: "Recovery readiness",
    description: "How easily focus returns after an interruption.",
    color: "var(--color-disc-s)",
  },
];

export interface FocusPatternMeta {
  code: FocusPatternCode;
  name: string;
  summary: string;
  recommendations: [string, string, string];
}

export const FOCUS_PATTERNS: Record<FocusPatternCode, FocusPatternMeta> = {
  intentional_focuser: {
    code: "intentional_focuser",
    name: "Intentional Focuser",
    summary:
      "Your attention tends to stay where you place it, and interruptions rarely take over. Focus is a habit you already protect.",
    recommendations: [
      "Keep one protected deep-work block a day — you already use it well.",
      "Notice the moments a strong pull does land, and name what triggered it.",
      "Share what works for you; you can model calm focus for the team.",
    ],
  },
  responsive_multitasker: {
    code: "responsive_multitasker",
    name: "Responsive Multitasker",
    summary:
      "You respond quickly to incoming signals, which keeps things moving but can fragment deep work. The habit is speed, not fault.",
    recommendations: [
      "Try one 25-minute block with notifications paused, then check in a batch.",
      "Move the most cognitively demanding task to your sharpest hour.",
      "Agree response-time norms with your team so 'later' feels safe.",
    ],
  },
  socially_stimulated: {
    code: "socially_stimulated",
    name: "Socially Stimulated Worker",
    summary:
      "Interaction gives you energy, and messages or feeds are your usual pull when work gets hard. Connection is a strength worth channelling.",
    recommendations: [
      "Batch messages into two or three windows rather than a constant trickle.",
      "Use a quick chat to unblock a hard task on purpose, then close the tab.",
      "Protect one focus window where you are reachable only for emergencies.",
    ],
  },
  deadline_activator: {
    code: "deadline_activator",
    name: "Deadline Activator",
    summary:
      "External pressure is what most reliably brings your focus online. Useful in bursts, but it can leave calm work harder to start.",
    recommendations: [
      "Set your own interim deadlines so pressure arrives before the last minute.",
      "Break large tasks into short, time-boxed sprints with a visible finish.",
      "Pair a dull task with a real commitment to someone to create traction.",
    ],
  },
  quiet_deep_worker: {
    code: "quiet_deep_worker",
    name: "Quiet Deep Worker",
    summary:
      "You focus best in quiet, low-interruption conditions and rarely act on autopilot. Sudden switching is what costs you most.",
    recommendations: [
      "Guard quiet blocks explicitly; treat them as meetings that can't move.",
      "Ask for changes and context ahead of time rather than in the moment.",
      "Give yourself a short transition after unexpected switches before diving back.",
    ],
  },
  overloaded_switcher: {
    code: "overloaded_switcher",
    name: "Overloaded Switcher",
    summary:
      "Right now your mind feels full and attention is pulled in several directions at once. This is a load pattern, not a limitation — and it eases.",
    recommendations: [
      "Write everything down once to empty the mental buffer, then pick one thing.",
      "Reduce open inputs: close tabs, silence non-urgent notifications for an hour.",
      "Add one real recovery break; short movement resets attention faster than pushing on.",
    ],
  },
};
