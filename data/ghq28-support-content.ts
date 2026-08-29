/**
 * Participant-facing support information for a positive GHQ-28 Section D.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ INTERIM APPROVAL — INTERNAL USER TESTING ONLY.
 *
 * The wording below was approved on 2026-08-29 by the Occupational Health
 * facilitator directing this engagement, for INTERNAL USER TESTING ONLY. It is
 * NOT final clinical-governance sign-off, and it does not authorise external or
 * commercial release. A qualified clinician must review and approve the exact
 * text before GHQ-28 reaches participants outside this internal test.
 *
 * `GHQ28_SUPPORT_APPROVED` records that the safeguard may now serve;
 * `GHQ28_SUPPORT_APPROVAL_STATE` records what KIND of approval it has, so the
 * distinction survives being read quickly by somebody deciding on rollout.
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
 * Whether the wording below has been approved to serve.
 *
 * TRUE under the interim internal-test approval described above. The result
 * surface renders the safeguard whatever this says — showing nothing would be
 * the worse failure — and this flag gates whether GHQ-28 may be served to a
 * participant at all.
 */
export const GHQ28_SUPPORT_APPROVED = true;

/**
 * What kind of approval the wording carries.
 *
 * A boolean cannot distinguish "a clinician signed this off for general use"
 * from "the engagement's OH facilitator accepted it so internal testing could
 * proceed". That difference decides whether GHQ-28 may go beyond this test, so
 * it is recorded as its own value rather than inferred from a comment.
 */
export type Ghq28SupportApprovalState =
  /** No approval of any kind. The safeguard may not serve. */
  | "unapproved"
  /**
   * Accepted by the engagement's Occupational Health facilitator so INTERNAL
   * USER TESTING can proceed. Permits participant serving inside that test.
   * Does NOT permit external or commercial release.
   */
  | "interim_internal_test"
  /**
   * Full clinical-governance sign-off of the exact wording. The only state
   * that clears GHQ-28 for release beyond the internal test.
   */
  | "clinical_governance";

/**
 * The state that would clear GHQ-28 for external release. Named rather than
 * written inline so the comparison cannot quietly become the interim one.
 */
export const GHQ28_FINAL_APPROVAL_STATE: Ghq28SupportApprovalState = "clinical_governance";

// Typed as the union, not `as const`, deliberately: a literal type makes
// `!== "clinical_governance"` a compile error, which would delete the very
// comparison the external-release gate is built on.
export const GHQ28_SUPPORT_APPROVAL_STATE: Ghq28SupportApprovalState = "interim_internal_test";

/** Shown on facilitator-facing governance surfaces, never to a participant. */
export const GHQ28_SUPPORT_APPROVAL_NOTE =
  "Interim wording approved for internal user testing by the engagement's Occupational " +
  "Health facilitator on 2026-08-29. Final clinical-governance sign-off is still required " +
  "before GHQ-28 is offered outside this internal test.";

export const GHQ28_SUPPORT_HEADING = "Support is available to you";

/**
 * The body, shown only to the participant on their own result.
 *
 * Sentence by sentence: what prompted it, that support exists, that nothing
 * was shared, and that the choice is theirs. No claim about their health
 * appears anywhere in it.
 */
export const GHQ28_SUPPORT_BODY =
  "Your responses suggest that you may benefit from speaking with someone about how you " +
  "are feeling. This questionnaire is not a diagnosis and cannot tell you what your " +
  "answers mean.";

/** Stated plainly, because a participant will reasonably wonder. */
export const GHQ28_SUPPORT_PRIVACY_NOTE =
  "Your individual answers and score remain private to you. Nobody has been notified, and no " +
  "one at your organisation can see how you answered any question.";

/** What the participant may do, framed as options rather than instructions. */
export const GHQ28_SUPPORT_NEXT_STEPS =
  "If you feel unsafe, think you may harm yourself, or need urgent support, please seek " +
  "immediate help from your local emergency service or nearest emergency department. " +
  "You may also contact your organisation's Occupational Health team or another qualified " +
  "healthcare professional for confidential support.";

/**
 * May the Section D safeguard actually be shown to a participant?
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS IS A FUNCTION AND NOT THE BOOLEAN ABOVE.
 *
 * `GHQ28_SUPPORT_APPROVED` was documented as "gates whether GHQ-28 may be
 * served to a participant at all". It did not. Nothing in the serving gate
 * ever read it — the only consumer was the result page, which decides whether
 * to RENDER the panel long after the participant has already answered Section
 * D. So the safeguard's approval and the questionnaire's availability were two
 * unconnected switches, and the dangerous combination — GHQ-28 servable, the
 * support wording withdrawn — was reachable by editing one line.
 *
 * The approval is therefore expressed as the complete condition, and
 * `canServeToParticipants` reads it. Approval, a KNOWN approval state, and
 * copy that actually exists: all three, or GHQ-28 does not serve.
 * ─────────────────────────────────────────────────────────────────────
 */
export function ghq28SupportPathwayApproved(): boolean {
  if (GHQ28_SUPPORT_APPROVED !== true) return false;

  // An unrecognised or missing state is not an approval. Fail closed, so a
  // future state added without updating this function cannot open the gate.
  const state: Ghq28SupportApprovalState = GHQ28_SUPPORT_APPROVAL_STATE;
  if (state !== "interim_internal_test" && state !== "clinical_governance") return false;

  // Approved copy that is not there cannot be shown. A participant who answers
  // Section D positively and sees an empty panel is the failure this exists to
  // prevent, so emptiness is treated as absence of approval.
  return [
    GHQ28_SUPPORT_HEADING,
    GHQ28_SUPPORT_BODY,
    GHQ28_SUPPORT_PRIVACY_NOTE,
    GHQ28_SUPPORT_NEXT_STEPS,
  ].every((text) => typeof text === "string" && text.trim().length > 0);
}

/**
 * Does the support pathway carry FINAL clinical-governance sign-off?
 *
 * Separate from the question above, and the separation is the whole point: the
 * interim approval opens internal testing and nothing else.
 */
export function ghq28SupportClinicallyApproved(): boolean {
  return ghq28SupportPathwayApproved() && GHQ28_SUPPORT_APPROVAL_STATE === GHQ28_FINAL_APPROVAL_STATE;
}
