import type { InstrumentKey } from "./wellbeing-instruments.ts";
import { DISC_WELLBEING_DISCLAIMER_LONG } from "./disc360-wellbeing-content.ts";
import { WHO5_DISCLAIMER_LONG } from "./who5-content.ts";

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
/**
 * The product descriptor, used where no instrument is resolved yet — the join
 * page a participant reaches before signing in, and the shell's metadata.
 *
 * Deliberately instrument-NEUTRAL. It said "GHQ-12 wellbeing screening" from
 * the single-instrument era, which told every participant they were about to
 * answer GHQ-12 whatever their campaign actually ran — and GHQ-12 is not
 * currently servable at all. A surface that knows its instrument should name
 * it from the registry instead of reusing this.
 */
export const WELLBEING_PRODUCT_DESCRIPTION = "Workplace wellbeing check-in";

/**
 * The ACCOUNT consent shown during onboarding to somebody who arrived on a
 * Wellbeing Pulse invitation.
 *
 * Onboarding is shared by both products, and its consent read "I consent to
 * DISC360 processing my assessment answers to build my behavioral profile" —
 * which a wellbeing participant was required to tick to continue. It describes
 * a behavioural assessment they are not taking, and it is the one consent a
 * wellbeing journey must never ask for.
 *
 * This covers what onboarding actually collects: the account. Consent for the
 * check-in itself is asked separately, on the pulse, where the instrument and
 * its length are known — see `consentIntro`.
 *
 * Split either side of the privacy link so the component composes it rather
 * than performing surgery on a sentence.
 */
export const WELLBEING_ACCOUNT_CONSENT_LEAD =
  "I consent to DISC360 creating an account for me so I can take part in this " +
  "wellbeing check-in, as described in the";
export const WELLBEING_ACCOUNT_CONSENT_TAIL =
  ". Your answers stay private to you. Required.";

/** Shown on every result, every report and every history view. */
export const SCREENING_DISCLAIMER =
  "GHQ-12 is a screening questionnaire and does not provide a diagnosis.";

/** The longer form, for the report and the result page footer. */
/**
 * GHQ-28's own disclaimer.
 *
 * GHQ-28 used to inherit GHQ-12's, which names GHQ-12 in its first four words.
 * A participant answering twenty-eight questions was told they had taken a
 * twelve-item questionnaire — the instrument is half the meaning of the
 * result, and misnaming it to the one person entitled to know is not a
 * cosmetic error.
 */
export const GHQ28_DISCLAIMER_LONG =
  "GHQ-28 is a screening questionnaire and does not provide a diagnosis. It describes " +
  "how you have been feeling recently compared with usual, and nothing more. Its four " +
  "sections are profile dimensions, not separate findings, and none of them names a " +
  "condition. It is not a medical, clinical or employment-selection instrument, and your " +
  "responses are never shared with your manager.";

export const SCREENING_DISCLAIMER_LONG =
  "GHQ-12 is a screening questionnaire and does not provide a diagnosis. It describes " +
  "how you have been feeling recently compared with usual, and nothing more. It is not " +
  "a medical, clinical or employment-selection instrument, and your responses are never " +
  "shared with your manager.";

/** Consent, in the participant's own terms. */
export const CONSENT_HEADING = "Taking part is your choice";

/**
 * The three paragraphs that are true of every instrument.
 *
 * The first paragraph — how many questions, how long — is NOT here, because it
 * is not the same for all four. It was hard-coded as "twelve short questions
 * … about three minutes", which is right for GHQ-12 and DISC360 Wellbeing and
 * wrong for WHO-5 (five items) and GHQ-28 (twenty-eight). Consent has to
 * describe what is actually being asked, so that sentence is built from the
 * campaign's own instrument by `consentIntro()`.
 */
export const CONSENT_BODY: readonly string[] = [
  "Your individual answers and your score are private to you. Your manager, your team facilitator and platform administrators cannot see them — not your score, and not any single answer.",
  "Results are only ever reported to your organisation as group figures, and only when a group is large enough that no one in it can be identified.",
  "You can stop at any point, and you do not have to take part at all.",
];

/**
 * The opening sentence of consent, for one instrument.
 *
 * Deliberately takes the item count and duration rather than the instrument
 * key: this module ships participant copy and must not grow a dependency on
 * the instrument registry, which carries licensing state.
 */
export function consentIntro(itemCount: number, minutesToComplete: string): string {
  return `This check-in asks ${itemCount} short question${
    itemCount === 1 ? "" : "s"
  } about how you have been feeling recently. It takes about ${minutesToComplete}.`;
}
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

/* ── GHQ-28's own wording ───────────────────────────────────────────── */

/**
 * ─────────────────────────────────────────────────────────────────────
 * WHY GHQ-28 NEEDED ITS OWN STRINGS RATHER THAN GHQ-12'S.
 *
 * `outcomeCopy`, `SCORE_LABEL` and `SCORE_MEANING` above are GHQ-12's
 * approved wording, and they NAME GHQ-12 and its 0–12 range. Both GHQ
 * questionnaires were being sent through them, so a participant who answered
 * twenty-eight questions was told, on their own result and in their own
 * downloaded report:
 *
 *   · "GHQ-12 screening score"
 *   · "below the current GHQ-12 screening threshold"
 *   · "counts how many of the twelve areas … runs from 0 to 12"
 *
 * with a figure that can reach 28. The questionnaire is half the meaning of a
 * screening result, and misnaming it to the one person entitled to know is not
 * a cosmetic error — it is the same class of defect that put GHQ-12's
 * disclaimer under a GHQ-28 result and was fixed by `GHQ28_DISCLAIMER_LONG`.
 *
 * The wording below mirrors GHQ-12's structure exactly, with GHQ-28's name and
 * range. The shared sentences — the ones that describe what a threshold is and
 * what a snapshot is not — are reused verbatim, because they are true of both
 * and re-stating them differently would be a second approval to obtain.
 * ─────────────────────────────────────────────────────────────────────
 */
export const GHQ28_SCORE_LABEL = "GHQ-28 screening score";

export const GHQ28_BELOW_THRESHOLD_BODY =
  "Your responses are below the current GHQ-28 screening threshold.";
export const GHQ28_ABOVE_THRESHOLD_BODY =
  "Your responses are at or above the current GHQ-28 screening threshold and indicate " +
  "more recent difficulty than usual across several wellbeing areas.";

export const GHQ28_SCORE_MEANING =
  "The score counts how many of the twenty-eight areas you described as harder than usual " +
  "recently. It runs from 0 to 28. A higher number means more areas felt harder than usual, " +
  "compared with how things normally are for you.";

/** The two GHQ questionnaires, each in its own words. */
export function ghqScoreLabel(instrumentKey: "ghq12" | "ghq28"): string {
  return instrumentKey === "ghq28" ? GHQ28_SCORE_LABEL : SCORE_LABEL;
}

export function ghqScoreMeaning(instrumentKey: "ghq12" | "ghq28"): string {
  return instrumentKey === "ghq28" ? GHQ28_SCORE_MEANING : SCORE_MEANING;
}

export function ghqOutcomeCopy(
  instrumentKey: "ghq12" | "ghq28",
  atOrAbove: boolean,
): { headline: string; body: string; detail: string } {
  const base = outcomeCopy(atOrAbove);
  if (instrumentKey === "ghq12") return base;
  return {
    // The headline and the detail name no questionnaire, so they are true of
    // both and are shared rather than duplicated with a different phrasing.
    headline: base.headline,
    body: atOrAbove ? GHQ28_ABOVE_THRESHOLD_BODY : GHQ28_BELOW_THRESHOLD_BODY,
    detail: base.detail,
  };
}

export const SCORE_MEANING =
  "The score counts how many of the twelve areas you described as harder than usual " +
  "recently. It runs from 0 to 12. A higher number means more areas felt harder than usual, " +
  "compared with how things normally are for you.";

/* ── what happens next ──────────────────────────────────────────────── */

/**
 * The section that follows the score, on every instrument.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY IT SAYS "THERE IS NOTHING YOU HAVE TO DO".
 *
 * A screening result with a prescriptive next step reads as an instruction
 * issued by an employer on the strength of a health questionnaire. This
 * product cannot make a clinical judgement and must not act like it has: the
 * one honest next step is the participant's own choice.
 *
 * It is also short on purpose. The mobile result was a wall of prose that a
 * participant had to scroll through before finding out anything; whatever is
 * long belongs behind "Understand my result", and what stays on the page has
 * to earn its place.
 * ─────────────────────────────────────────────────────────────────────
 */
export const NEXT_STEP_HEADING = "Your next step";
export const NEXT_STEP_BODY =
  "There is nothing you have to do with this. Some people find it useful to notice what has " +
  "felt harder than usual recently and what has helped; others would rather leave it here. " +
  "Both are fine.";

/** Added only where the organisation has a support route to point at. */
export const NEXT_STEP_WITH_SUPPORT =
  "If you would like to talk to someone, confidential support is available to you below.";

/* ── privacy, on the result itself ──────────────────────────────────── */

export const RESULT_PRIVACY_HEADING = "Who can see this";
export const RESULT_PRIVACY_BODY =
  "Only you. Your answers and your score are not visible to your manager, your facilitator or " +
  "platform administrators. Reporting to your organisation uses combined figures across groups " +
  "of people, and no group is reported unless it is large enough that nobody in it can be " +
  "picked out.";

/** The expander label. One phrase, so it is recognisable across instruments. */
export const UNDERSTAND_RESULT_LABEL = "Understand my result";

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

/**
 * The long-form disclaimer for an instrument, chosen by the instrument.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY A RESOLVER RATHER THAN A TERNARY AT EACH CALL SITE.
 *
 * Both the landing page and the result page used to branch two ways:
 * DISC360 Wellbeing, or "everything else". Everything else meant GHQ-12's
 * text, which opens with the words "GHQ-12 is a screening questionnaire" — so
 * WHO-5 and GHQ-28 participants were told, in the one place that describes
 * what they just answered, that they had taken a different questionnaire.
 *
 * A two-way branch cannot survive a fourth instrument. This is exhaustive, so
 * adding one is a compile error rather than a silent mislabelling.
 * ─────────────────────────────────────────────────────────────────────
 */
export function participantDisclaimerFor(instrumentKey: InstrumentKey): string {
  switch (instrumentKey) {
    case "ghq12":
      return SCREENING_DISCLAIMER_LONG;
    case "ghq28":
      return GHQ28_DISCLAIMER_LONG;
    case "who5":
      return WHO5_DISCLAIMER_LONG;
    case "disc360_wellbeing_v1":
      return DISC_WELLBEING_DISCLAIMER_LONG;
  }
}
