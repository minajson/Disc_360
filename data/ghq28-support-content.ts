/**
 * Participant-facing support information for a positive GHQ-28 Section D.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ PENDING OCCUPATIONAL HEALTH SIGN-OFF.
 *
 * The wording below has NOT been approved by a clinician. It is drafted to be
 * safe by default and traceable to the supplied guide, so that the safeguard
 * exists rather than being deferred — but an Occupational Health Physician
 * must review and approve the exact text before this reaches a real
 * participant. `GHQ28_SUPPORT_APPROVED` records that state in code, and a test
 * asserts the flag matches reality.
 *
 * WHAT THIS IS.
 *
 * GHQ-28's Section D asks directly about not wanting to live. The supplied
 * assessment guide requires that a positive answer there be followed by
 * professional evaluation. This product cannot notify anybody — individual
 * results are private to the participant by design — so the product owner's
 * decision is to put the support information in front of the ONE person who
 * can act on it and who already knows what they answered.
 *
 * WHAT THE WORDING MAY AND MAY NOT DO.
 *
 * May: acknowledge the answers, say support exists, say plainly that nothing
 * was shared, and leave the next step with the participant.
 *
 * May NOT: state or imply a diagnosis, name a condition, quantify risk, tell
 * the participant what they are, or claim urgency on their behalf. Every one
 * of those would be this product making a clinical judgement it is not
 * qualified or permitted to make.
 *
 * DELIBERATELY NO HELPLINE NUMBER.
 *
 * A wrong or out-of-country crisis number is worse than none, and this
 * platform is multi-organisation and multi-jurisdiction. The organisation's
 * own support route is the thing worth naming, and that belongs in
 * configuration approved by the organisation — not hard-coded here from a
 * guess about where the participant is.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Whether a clinician has approved the wording below.
 *
 * FALSE until an Occupational Health Physician signs it off. The result
 * surface still renders the safeguard — showing nothing would be the worse
 * failure — but the facilitator-facing readiness surface reports GHQ-28 as
 * carrying unapproved participant copy, so the gap is visible to somebody who
 * can close it rather than sitting silently in a file.
 */
export const GHQ28_SUPPORT_APPROVED = false;

export const GHQ28_SUPPORT_HEADING = "Support is available to you";

/**
 * The body, shown only to the participant on their own result.
 *
 * Sentence by sentence: what prompted it, that support exists, that nothing
 * was shared, and that the choice is theirs. No claim about their health
 * appears anywhere in it.
 */
export const GHQ28_SUPPORT_BODY =
  "Some of your answers touched on feelings that people often find hard to talk about. " +
  "This questionnaire cannot tell you what they mean, and it is not a diagnosis — but " +
  "support is available, and talking to a health professional is a reasonable next step if " +
  "any of it felt true for you.";

/** Stated plainly, because a participant will reasonably wonder. */
export const GHQ28_SUPPORT_PRIVACY_NOTE =
  "Your individual answers and score remain private to you. Nobody has been notified, and no " +
  "one at your organisation can see how you answered any question.";

/** What the participant may do, framed as options rather than instructions. */
export const GHQ28_SUPPORT_NEXT_STEPS =
  "You can speak to your own doctor, or to whoever provides occupational health or employee " +
  "support at your organisation. If you feel unsafe now, contact your local emergency services " +
  "or a crisis line in your country.";
