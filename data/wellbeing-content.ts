import type { WellbeingMovement } from "../lib/scoring/wellbeing.ts";

/**
 * Wellbeing Pulse — every word the product says about a score.
 *
 * Copy lives here rather than in components for the same reason DISC copy
 * lives in data/insight-maps.ts: it has to be reviewable in one place, and in
 * this module it also has to be SCREENED in one place. Every string below is
 * checked by data/wellbeing-content.test.ts against lib/wellbeing/language.ts,
 * so a diagnostic, alarming, selection-flavoured or causal phrase fails the
 * build rather than reaching a participant.
 *
 * Tone: calm, plain, and short. A person who has just answered twelve
 * questions about how they have been feeling should not meet a wall of
 * hedging, and should not meet a red screen either.
 */

export const WELLBEING_PRODUCT_NAME = "Wellbeing Pulse";
export const WELLBEING_PRODUCT_DESCRIPTION = "GHQ-12 wellbeing screening";

/** Shown on every result, every report and every history view. */
export const SCREENING_DISCLAIMER =
  "GHQ-12 is a screening questionnaire and does not provide a diagnosis.";

/** The longer form, for the report and the result page footer. */
export const SCREENING_DISCLAIMER_LONG =
  "GHQ-12 is a screening questionnaire and does not provide a diagnosis. It describes " +
  "how you have been feeling recently compared with usual, and nothing more. It is not " +
  "a medical, clinical or employment-selection instrument, and your responses are never " +
  "shared with your manager.";

/** Consent, in the participant's own terms. */
export const CONSENT_HEADING = "Taking part is your choice";
export const CONSENT_BODY: readonly string[] = [
  "Wellbeing Pulse asks twelve short questions about how you have been feeling over the last few weeks compared with usual. It takes about three minutes.",
  "Your individual answers and your score are private to you. Your manager, your team facilitator and platform administrators cannot see them — not your score, and not any single answer.",
  "Results are only ever reported to your organisation as group figures, and only when a group is large enough that no one in it can be identified.",
  "You can stop at any point, and you do not have to take part at all.",
];
export const CONSENT_AGREE = "I understand, and I choose to take part";
export const CONSENT_DECLINE = "I would rather not take part";
export const CONSENT_DECLINED_HEADING = "That is completely fine";
export const CONSENT_DECLINED_BODY =
  "Nothing has been recorded and no one is told that you declined. You can come back and take the Wellbeing Pulse whenever you want to.";

/* ── the result ─────────────────────────────────────────────────────── */

export const RESULT_HEADING = "Your Wellbeing Pulse";
export const SCORE_LABEL = "GHQ-12 screening score";

export const thresholdLine = (threshold: number): string =>
  `Current screening threshold: ${threshold}`;

/** §8 — the two outcomes, in the approved wording. */
export const BELOW_THRESHOLD_HEADLINE = "Below the current screening threshold";
export const BELOW_THRESHOLD_BODY =
  "Your responses are below the current GHQ-12 screening threshold.";
export const BELOW_THRESHOLD_DETAIL =
  "That means the number of areas where you reported things being harder than usual is " +
  "lower than the level this organisation currently uses as a prompt to check in. It is a " +
  "snapshot of the last few weeks, not a statement about you.";

export const ABOVE_THRESHOLD_HEADLINE = "At or above the current screening threshold";
export const ABOVE_THRESHOLD_BODY =
  "Your responses are at or above the current GHQ-12 screening threshold and indicate " +
  "more recent difficulty than usual across several wellbeing areas.";
export const ABOVE_THRESHOLD_DETAIL =
  "Many people score here at some point, and it can move a great deal from month to month. " +
  "It is a prompt to notice how you have been, not a finding about your health. If you would " +
  "like to talk to someone, your organisation's own support routes are the right place to start.";

export const outcomeCopy = (atOrAbove: boolean) =>
  atOrAbove
    ? {
        headline: ABOVE_THRESHOLD_HEADLINE,
        body: ABOVE_THRESHOLD_BODY,
        detail: ABOVE_THRESHOLD_DETAIL,
      }
    : {
        headline: BELOW_THRESHOLD_HEADLINE,
        body: BELOW_THRESHOLD_BODY,
        detail: BELOW_THRESHOLD_DETAIL,
      };

export const SCORE_MEANING =
  "The score counts how many of the twelve areas you described as harder than usual " +
  "recently. It runs from 0 to 12. A higher number means more areas felt harder than usual, " +
  "compared with how things normally are for you.";

/* ── history and movement ───────────────────────────────────────────── */

export const HISTORY_HEADING = "My Wellbeing History";
export const HISTORY_EMPTY =
  "Your completed Wellbeing Pulses will appear here, so you can see how things have moved over time.";
export const HISTORY_SINGLE =
  "This is your first Wellbeing Pulse. When you complete another one, you will be able to see how the two compare.";

/** §7 — movement is direction and a number, never an interpretation. */
export const MOVEMENT_LABEL: Record<WellbeingMovement, string> = {
  lower: "Lower than your previous pulse",
  higher: "Higher than your previous pulse",
  similar: "Similar to your previous pulse",
};

export function movementDetail(movement: WellbeingMovement, delta: number): string {
  const points = Math.abs(delta) === 1 ? "1 point" : `${Math.abs(delta)} points`;
  if (movement === "similar") {
    return "Your score is the same as it was last time.";
  }
  return movement === "lower"
    ? `Your score is ${points} lower than your previous pulse.`
    : `Your score is ${points} higher than your previous pulse.`;
}

/**
 * The caveat that goes with every comparison. There is no validated
 * minimum-change threshold for GHQ-12 at the individual level, so the product
 * reports the arithmetic and declines to interpret it.
 */
export const MOVEMENT_CAVEAT =
  "Scores move around for all sorts of everyday reasons. A change from one pulse to the " +
  "next describes your answers on those two days — it does not measure whether anything " +
  "has got better or worse.";

/* ── report delivery ────────────────────────────────────────────────── */

export const EMAIL_OPT_IN_LABEL = "Email my report to me";
export const EMAIL_OPT_IN_HELP =
  "Optional. We will send a short private message with a secure link to your report. " +
  "Your score is never put in the subject line or the web address.";
export const EMAIL_SUBJECT = "Your Wellbeing Pulse report is ready";
export const EMAIL_SENT = "Your report is on its way.";
export const EMAIL_NOT_DELIVERED =
  "We could not send your report just now. Nothing was sent, and you can still download it here.";

/* ── management analytics ───────────────────────────────────────────── */

export const SUPPRESSION_NOTICE = "Insufficient responses to protect confidentiality";
export const SUPPRESSION_EXPLANATION =
  "Group figures are only shown when enough people have completed the pulse that no " +
  "individual can be identified from them — including by comparing one group against another.";

export const AGGREGATE_ONLY_NOTICE =
  "Wellbeing Pulse reporting is group-level only. Individual scores and individual answers " +
  "are not available to facilitators, administrators or anyone else in this workspace.";

export const NO_COMBINATION_NOTICE =
  "Wellbeing Pulse is reported on its own. It is never added to, averaged with or compared " +
  "against DISC or Focus Pulse results, and it is never used to order or compare people.";

export const TREND_CAVEAT =
  "These charts show how group figures moved between pulses. They describe what changed, " +
  "not why it changed.";

export const THRESHOLD_POLICY_NOTE =
  "GHQ-12 screening thresholds vary between populations, settings and languages. The " +
  "threshold shown here is the one this organisation has configured, and it should be " +
  "reviewed for the workforce it is applied to. Every completed pulse stores the threshold " +
  "that was in force at the time, so changing it later does not alter past results.";

export const ITEM_SIGNAL_NOTE =
  "Each column is one questionnaire item, reported as the share of responses indicating " +
  "more difficulty than usual. Items are shown individually and are never grouped into " +
  "named categories.";
