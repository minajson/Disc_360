import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { invitedJoinDestination } from "../join/destination.ts";

/**
 * The first-time participant's journey, which is where the product boundary
 * was still leaking after the join route was fixed.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT WAS STILL WRONG.
 *
 * Redirecting the printed QR to `/wellbeing/join/{token}` fixes the journey
 * for somebody who already has an account. A first-time participant does not:
 * they are sent to `/onboarding?join={token}` so consent precedes membership,
 * and onboarding ended in an unconditional `redirect("/app")`.
 *
 * So the corrected route delivered a Wellbeing Pulse participant to the DISC
 * participant dashboard — the exact destination the redirect existed to
 * prevent, two screens later.
 *
 * A second leak sat on the same screen. Onboarding's required consent read
 * "I consent to DISC360 processing my assessment answers to build my
 * behavioral profile". A wellbeing participant had to tick it to continue.
 *
 * Both are journey faults: every individual page looked right.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");
/** Comment lines stripped: these files EXPLAIN the rules in prose. */
const code = (path: string) =>
  read(path)
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
    })
    .join("\n");

const TOKEN = "37aee8e9-fa63-420a-84b4-0017e4801eb9";

/* ── 1 · the four first-time journeys ────────────────────────────────── */
//
// Provider is deliberately not a variable below. Google and email differ only
// in how the session is created; by the time onboarding completes, both are an
// authenticated user holding a join token, and the destination is decided by
// the campaign type alone. That is the property worth pinning — a routing rule
// that depended on the provider would be a bug.

test("a new Google user on a DISC invitation lands on the DISC dashboard", () => {
  assert.equal(invitedJoinDestination("disc", TOKEN), "/app");
});

test("a new Google user on a Wellbeing invitation never lands on /app", () => {
  const destination = invitedJoinDestination("wellbeing", TOKEN);
  assert.equal(destination, `/wellbeing/join/${TOKEN}`);
  assert.notEqual(destination, "/app");
});

test("a new email user on a DISC invitation lands on the DISC dashboard", () => {
  assert.equal(invitedJoinDestination("disc", TOKEN), "/app");
});

test("a new email user on a Wellbeing invitation never lands on /app", () => {
  assert.notEqual(invitedJoinDestination("wellbeing", TOKEN), "/app");
});

test("an existing user on a Wellbeing invitation returns to the campaign", () => {
  // Already-onboarded users are redirected out of /onboarding. That branch
  // sent everybody to /app, including wellbeing participants arriving with a
  // token in hand.
  const page = code("app/onboarding/page.tsx");
  assert.match(
    page,
    /if \(profile\.onboarded_at\) \{[\s\S]{0,400}invitedJoinDestination\(joinContext\.assessmentType, join\)/,
    "an onboarded visitor holding a join token must be routed by campaign type",
  );
  assert.ok(
    !/if \(profile\.onboarded_at\) redirect\("\/app"\);/.test(page),
    "the unconditional /app redirect must be gone",
  );
});

/* ── 2 · the action consults the campaign, not the URL ───────────────── */

test("completeInvitedOnboarding routes by the campaign type it already has", () => {
  const action = code("lib/actions/onboarding.ts");
  const invited = action.slice(
    action.indexOf("export async function completeInvitedOnboarding"),
    action.indexOf("const joinSchema"),
  );
  assert.ok(invited.length > 0, "the invited action must exist");
  assert.match(
    invited,
    /redirect\(invitedJoinDestination\(context\.assessmentType, parsedToken\.data\.join_token\)\)/,
    "the destination comes from the resolved campaign and the validated token",
  );
  assert.ok(
    !/redirect\("\/app"\);/.test(invited),
    "the unconditional DISC redirect must be gone from the invited path",
  );
});

test("the product is never inferred from a URL string", () => {
  // Structured campaign context exists; sniffing a path for "/wellbeing" would
  // derive it from something a caller can influence instead.
  const action = code("lib/actions/onboarding.ts");
  const destination = code("lib/join/destination.ts");
  for (const source of [action, destination]) {
    assert.ok(
      !/startsWith\("\/wellbeing"\)|includes\("\/wellbeing"\)/.test(source),
      "the product must come from assessmentType, not from a path test",
    );
  }
  assert.match(destination, /assessmentType !== "wellbeing"/, "the campaign type decides");
});

test("membership is still resolved server-side from the token", () => {
  const action = code("lib/actions/onboarding.ts");
  const invited = action.slice(
    action.indexOf("export async function completeInvitedOnboarding"),
    action.indexOf("const joinSchema"),
  );
  // Unchanged by the routing fix, and worth pinning: the redirect moved, the
  // authorization did not.
  assert.match(invited, /invitedSchema\.safeParse/, "the token is validated");
  assert.match(invited, /getJoinContext\(parsedToken\.data\.join_token\)/, "and resolved server-side");
  assert.match(invited, /attachMembership\(\s*context\.teamId/, "membership comes from that context");
  assert.ok(
    !/formData\.get\("team_id"\)/.test(invited),
    "a client-supplied team id must never grant membership",
  );
});

/* ── 3 · no DISC consent inside the wellbeing journey ────────────────── */

test("the onboarding consent is product-aware", () => {
  const flow = code("components/onboarding/OnboardingFlow.tsx");
  assert.match(flow, /isWellbeing: boolean/, "the invitation carries its product");
  assert.match(
    flow,
    /consentBody=\{\s*invitation\.isWellbeing \?/,
    "and the invited form chooses the consent from it",
  );
  assert.match(
    flow,
    /WELLBEING_ACCOUNT_CONSENT_LEAD/,
    "the wellbeing wording comes from the wellbeing content module",
  );
});

test("the wellbeing consent asks for nothing behavioural", () => {
  const content = read("data/wellbeing-content.ts");
  const lead = content.slice(content.indexOf("export const WELLBEING_ACCOUNT_CONSENT_LEAD"));
  const consent = lead.slice(0, lead.indexOf("/** Shown on every result"));
  for (const forbidden of [
    "behavioral profile",
    "behavioural profile",
    "assessment answers",
    "DISC360 assessment",
    "24 quick scenarios",
  ]) {
    assert.ok(
      !consent.toLowerCase().includes(forbidden.toLowerCase()),
      `the wellbeing account consent must not mention "${forbidden}"`,
    );
  }
});

test("the DISC consent is unchanged for every DISC pathway", () => {
  // The fix is additive. A DISC participant must still be asked exactly what
  // they were always asked.
  const flow = code("components/onboarding/OnboardingFlow.tsx");
  assert.match(
    flow,
    /I consent to DISC360 processing my assessment answers to build my\s*behavioral profile/,
    "the DISC consent remains the default",
  );
  assert.match(flow, /consentBody \?\? \(/, "and is what renders when no override is passed");
});

/* ── 4 · the invitation names the right product ──────────────────────── */

test("a wellbeing invitation is not labelled from the DISC product map", () => {
  const page = code("app/onboarding/page.tsx");
  // ASSESSMENT_LABELS covers disc/focus/combined only, so a wellbeing campaign
  // indexed into it rendered `undefined`.
  assert.match(
    page,
    /assessmentType === "wellbeing"\s*\?\s*WELLBEING_PRODUCT_NAME/,
    "a wellbeing campaign is named from the wellbeing product content",
  );
  assert.match(page, /ASSESSMENT_LABELS\[[^\]]+\] \?\? null/, "and the DISC map can no longer leak undefined");
});

/* ── 5 · the campaign survives EMAIL sign-up, not just Google ────────── */
//
// Found by the journey test, and invisible to every other check: OAuth
// forwarded `next` correctly, so the deep link was verified for Google and
// never for email. `SignUpForm` dropped it in both of its branches, so
// "Continue with email" on a Wellbeing Pulse invitation delivered someone who
// had just scanned a printed code into generic onboarding — where they are
// asked for a team code they do not have.
//
// The confirmation branch is the one that matters in production, because
// production runs WITH email confirmations: that emailed link is the journey.

test("email sign-up carries the invitation through the confirmation link", () => {
  const form = code("components/auth/SignUpForm.tsx");
  assert.match(
    form,
    /const requestedNext = searchParams\.get\("next"\)/,
    "the destination the person arrived with must be read",
  );
  assert.match(
    form,
    /if \(safeNext\) callback\.searchParams\.set\("next", safeNext\)/,
    "and put on the callback, or the confirmation email loses the campaign",
  );
});

test("email sign-up without confirmations goes to the invitation, not generic onboarding", () => {
  const form = code("components/auth/SignUpForm.tsx");
  assert.match(
    form,
    /router\.push\(safeNext \?\? onboardingDestination\(intent\)\)/,
    "the invitation wins when there is one; onboarding remains the fallback",
  );
  assert.ok(
    !/router\.push\(onboardingDestination\(intent\)\);/.test(form),
    "the unconditional push that dropped the campaign must be gone",
  );
});

test("the sign-up destination is validated, never trusted", () => {
  const form = code("components/auth/SignUpForm.tsx");
  assert.match(form, /isSafeNext\(requestedNext\)/, "an open redirect via a crafted sign-up link");
  // The shared rule, not a second hand-rolled one that can drift from it.
  assert.match(form, /from "@\/lib\/auth\/intent"/);
});

test("both authentication routes off an invitation preserve it", () => {
  // OAuth already did; email did not. Pinning them together is the point —
  // one provider working is what hid this.
  const oauth = code("components/auth/OAuthButtons.tsx");
  assert.match(oauth, /callback\.searchParams\.set\("next", next\)/);
  const form = code("components/auth/SignUpForm.tsx");
  assert.match(form, /callback\.searchParams\.set\("next", safeNext\)/);
});
