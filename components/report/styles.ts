/**
 * Shared button classes for the participant report actions.
 *
 * Deliberately in a module with no "use client" directive. A plain string
 * exported from a client module does not survive the server/client boundary —
 * a server component importing it receives a client reference, not the value,
 * and the class silently lands in the DOM as a stringified proxy. These
 * constants are used from both sides, so they live where both can read them.
 *
 * `min-h-11` is the floor deliberately: 44px is the smallest comfortable tap
 * target, and these are the controls someone reaches for on a phone right
 * after finishing an assessment.
 */

export const REPORT_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-hairline bg-paper px-4 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical";

export const REPORT_BUTTON_PRIMARY =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-botanical px-5 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep";
