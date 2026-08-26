/**
 * Where an invited participant goes once onboarding is done.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS IS ITS OWN MODULE.
 *
 * `completeInvitedOnboarding` ended in an unconditional `redirect("/app")`.
 * That is correct for a DISC invitation and wrong for every other product: a
 * person who scanned a Wellbeing Pulse code, signed in with Google and filled
 * in their name was delivered to the DISC participant dashboard — a different
 * product, with a DISC assessment card on it, and no way back to the campaign
 * they were actually invited to.
 *
 * The join context already carries `assessmentType`, resolved inside the
 * database by `resolve_join_token`. So the product is KNOWN at that moment and
 * was simply not consulted. This function is the consultation, kept pure so
 * the routing table is a unit test rather than a browser journey.
 *
 * WHY NOT SNIFF THE URL.
 *
 * Deciding the product by testing whether a path starts with "/wellbeing"
 * infers structured information from a string that a caller may control. The
 * campaign type is authoritative, server-resolved and already in hand; the URL
 * is neither.
 *
 * WHY THE INVITATION AND NOT THE PULSE ITSELF.
 *
 * A wellbeing participant is returned to `/wellbeing/join/{token}`, not
 * straight to `/wellbeing?team=…`. The token is the authorization: that page
 * is where membership is accepted from it, where campaign readiness is
 * checked, and where a campaign that is not open yet says so. Jumping past it
 * to the pulse would mean trusting a team id we did not verify the person was
 * invited to — the exact thing the token exists to prevent.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Where a DISC participant has always landed. Unchanged, deliberately. */
export const DISC_PARTICIPANT_HOME = "/app";

/**
 * Where a wellbeing participant goes when the token is unusable. Never
 * `/app`: a wellbeing participant seeing the DISC dashboard is the defect
 * this module exists to remove, and a broken token does not make it correct.
 */
export const WELLBEING_PARTICIPANT_HOME = "/wellbeing";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The post-onboarding destination for an invited participant.
 *
 * `assessmentType` comes from the join context. `token` is interpolated into a
 * path, so it is re-validated as a UUID here even though the caller parses it
 * too — a path segment built from unvalidated input is how a redirect target
 * stops being the redirect target you wrote.
 */
export function invitedJoinDestination(
  assessmentType: string | null | undefined,
  token: string,
): string {
  if (assessmentType !== "wellbeing") return DISC_PARTICIPANT_HOME;
  if (!UUID.test(token)) return WELLBEING_PARTICIPANT_HOME;
  return `/wellbeing/join/${token}`;
}

/**
 * Is this a path we may redirect to after authentication?
 *
 * Same rule as `isSafeNext` in lib/auth/intent.ts, restated here so a caller
 * that has a join token but no auth intent does not have to reach across
 * modules for it. Relative, same-origin, no protocol-relative `//host`, no
 * backslash — browsers normalise `/\evil.com` to `//evil.com`.
 */
export function isSafeJoinNext(next: string | null | undefined): boolean {
  if (!next) return false;
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//")) return false;
  if (next.includes("\\")) return false;
  return true;
}
