/**
 * Confidential support — the words, for every participant, at every score.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE RULE THIS FILE EXISTS TO ENFORCE.
 *
 * Employee Assistance Programme and Occupational Health access is a benefit an
 * organisation provides to EVERYONE it employs. It does not depend on a job
 * category, a grade, a department, a team, whether somebody works in an office
 * or in the field, what they scored, or which side of a screening threshold
 * they fell.
 *
 * So this card appears on EVERY result for an organisation that has configured
 * a support route. If it appeared only above a threshold, an employee would
 * learn — correctly, from the product's own behaviour — that support is for
 * people the questionnaire has classified. That belief is wrong, it stigmatises
 * the people who most need the service, and it suppresses exactly the
 * help-seeking the programme exists to enable.
 *
 * A score may change the card's PROMINENCE. It never changes its presence.
 *
 * WHAT THE WORDING MAY NOT DO.
 *
 * It may not say why the reader is being shown it, because there is no why —
 * everybody is. It may not name a condition, imply one, quantify risk, or
 * suggest the organisation knows anything about this person's answers. The
 * decision to make contact belongs to the reader, and the sentence is written
 * so that using the service is an ordinary thing an ordinary employee does.
 *
 * NOTHING IS RECORDED.
 *
 * Opening this card, expanding it, or following one of its routes writes
 * nothing anywhere. There is no analytics event, no audit row and no column to
 * hold one. Support use is not data, is not reported to managers, and does not
 * appear in any facilitator view.
 * ─────────────────────────────────────────────────────────────────────
 */

export const SUPPORT_HEADING = "Confidential support available to you";

/**
 * The lead sentence, composed with the organisation's name.
 *
 * "would like to" rather than "need to": needing help is a judgement about the
 * reader that this product has no standing to make, and wanting to talk to
 * somebody requires no justification.
 */
export function supportLead(organisationName: string | null): string {
  const owner = organisationName ? `${organisationName}'s` : "your organisation's";
  return (
    `If you would like to talk to someone, confidential support is available through ${owner} ` +
    "Employee Assistance Programme (EAP) and Occupational Health services."
  );
}

/** When only one of the two routes is configured, the sentence names that one. */
export function supportLeadForSingle(
  organisationName: string | null,
  service: string,
): string {
  const owner = organisationName ? `${organisationName}'s` : "your organisation's";
  return `If you would like to talk to someone, confidential support is available through ${owner} ${service}.`;
}

/**
 * The line that answers the question every reader actually has.
 *
 * Not "your data is secure" — the specific worry, named and answered: does
 * contacting them tell anybody what I answered?
 */
export const SUPPORT_PRIVACY_NOTE =
  "Getting in touch is your choice and stays between you and the service. Your manager and " +
  "your facilitator are not told, and your answers to this questionnaire are not shared with " +
  "anyone, including the services above.";

/** Available to everybody, said plainly, so nobody has to wonder. */
export const SUPPORT_UNIVERSAL_NOTE =
  "These services are available to everyone, whatever your role and whatever this check-in " +
  "showed. You do not need a referral or a reason.";

export const SUPPORT_ACTION_LABEL = {
  eap: "Contact EAP",
  occupational_health: "Contact Occupational Health",
} as const;

export const SUPPORT_SERVICE_NAME = {
  eap: "Employee Assistance Programme",
  occupational_health: "Occupational Health",
} as const;

/**
 * What a facilitator or governance holder sees where support has not been set
 * up yet.
 *
 * Deliberately NOT shown to a participant. A card reading "your organisation
 * has not configured support" tells somebody who may be having a hard time
 * that the door they were about to try is not there, which is worse than the
 * product staying quiet. It is an administrative gap, and it is reported on
 * the administrative surface.
 */
export const SUPPORT_UNCONFIGURED_ADMIN_NOTE =
  "No support route has been set up for this organisation yet, so participants are not shown " +
  "one. Add the organisation's own EAP and Occupational Health details — a wrong or " +
  "out-of-country number is worse than none, so nothing is filled in by default.";

/** Every participant-facing string here, for the language screen. */
export const SUPPORT_PARTICIPANT_COPY: readonly string[] = [
  SUPPORT_HEADING,
  supportLead("Renaissance Africa"),
  supportLead(null),
  supportLeadForSingle("Renaissance Africa", SUPPORT_SERVICE_NAME.eap),
  supportLeadForSingle(null, SUPPORT_SERVICE_NAME.occupational_health),
  SUPPORT_PRIVACY_NOTE,
  SUPPORT_UNIVERSAL_NOTE,
  SUPPORT_ACTION_LABEL.eap,
  SUPPORT_ACTION_LABEL.occupational_health,
];
