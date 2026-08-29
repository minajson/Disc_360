/**
 * Turning a database admission refusal into something a participant can read.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THE REFUSAL COMES FROM THE DATABASE AT ALL.
 *
 * Capacity, lifecycle and provenance are enforced by 00047's trigger, inside
 * the INSERT, with the campaign row locked before it counts. That is not
 * belt-and-braces over an application check — it is the only place the rule
 * can actually hold. Two participants racing for the last place both read
 * "one place left" and both pass any check made outside the transaction; only
 * the lock makes the final place gettable exactly once.
 *
 * So the application does not decide admission. It translates the decision.
 *
 * WHY HINTS AND NOT MESSAGE TEXT.
 *
 * Each `raise` sets a stable machine-readable `hint`. Matching the prose
 * instead would turn a reworded exception into an unhandled database error in
 * front of a participant — and the prose contains ids and counts that must not
 * reach one.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Marker → the sentence a participant sees. Nothing else is exposed. */
const REFUSALS: Record<string, string> = {
  CAMPAIGN_CAPACITY_REACHED: "This campaign has reached its participant capacity.",
  CAMPAIGN_NOT_OPEN: "This campaign is no longer accepting responses.",
  CAMPAIGN_EXPIRED: "This campaign has ended, so it is no longer accepting responses.",
  CAMPAIGN_NOT_FOUND: "This campaign could not be found.",
  // A mismatch is a configuration or tampering fault, never the participant's
  // doing. They are told the pulse cannot be started — not which of the two it
  // was, and never the instrument or version that disagreed.
  CAMPAIGN_INSTRUMENT_MISMATCH: "This Wellbeing Pulse could not be started.",
  CAMPAIGN_VERSION_MISMATCH: "This Wellbeing Pulse could not be started.",
};

/**
 * The participant-facing refusal for a failed insert, or null if the error was
 * not an admission decision.
 *
 * Null means "this was a real fault" and the caller should say so generically,
 * rather than dressing a database outage up as a full campaign.
 */
export function campaignAdmissionRefusal(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { hint?: string | null; message?: string | null };

  for (const [marker, message] of Object.entries(REFUSALS)) {
    if (candidate.hint === marker) return message;
    // PostgREST does not always forward `hint`, so fall back to the marker
    // wherever it lands. Both are set by the same `raise`.
    if (typeof candidate.message === "string" && candidate.message.includes(marker)) {
      return message;
    }
  }
  return null;
}

/** Every marker this module knows how to translate, for the tests. */
export const ADMISSION_MARKERS = Object.keys(REFUSALS);
