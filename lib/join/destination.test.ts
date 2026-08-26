import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DISC_PARTICIPANT_HOME,
  WELLBEING_PARTICIPANT_HOME,
  invitedJoinDestination,
  isSafeJoinNext,
} from "./destination.ts";

/**
 * Where an invited participant is delivered after onboarding.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE DEFECT THESE HOLD SHUT.
 *
 * `completeInvitedOnboarding` ended in an unconditional `redirect("/app")`.
 * A person who scanned a Wellbeing Pulse code, authenticated with Google and
 * completed onboarding was delivered to the DISC participant dashboard — the
 * wrong product entirely, with no route back to the campaign they were
 * invited to. The join context knew the campaign type the whole time.
 *
 * The routing table is a pure function precisely so this is six assertions
 * rather than six browser journeys.
 * ─────────────────────────────────────────────────────────────────────
 */

const TOKEN = "37aee8e9-fa63-420a-84b4-0017e4801eb9";

/* ── 1 · the product decides, and DISC is untouched ──────────────────── */

test("a DISC invitation still ends on the DISC dashboard", () => {
  assert.equal(invitedJoinDestination("disc", TOKEN), "/app");
  assert.equal(invitedJoinDestination("disc", TOKEN), DISC_PARTICIPANT_HOME);
});

test("focus and combined invitations are DISC-side and unchanged", () => {
  // The fix must not quietly re-route every non-wellbeing product while
  // fixing one of them.
  assert.equal(invitedJoinDestination("focus", TOKEN), "/app");
  assert.equal(invitedJoinDestination("combined", TOKEN), "/app");
});

test("an unknown or absent type falls back to the DISC dashboard", () => {
  // Wellbeing is opt-in by explicit type. A null assessment_type is an
  // ordinary team, and must not be captured by the wellbeing branch.
  assert.equal(invitedJoinDestination(null, TOKEN), "/app");
  assert.equal(invitedJoinDestination(undefined, TOKEN), "/app");
  assert.equal(invitedJoinDestination("something_new", TOKEN), "/app");
});

/* ── 2 · a wellbeing participant never reaches /app ──────────────────── */

test("a wellbeing invitation returns to its own invitation, not /app", () => {
  const destination = invitedJoinDestination("wellbeing", TOKEN);
  assert.equal(destination, `/wellbeing/join/${TOKEN}`);
  assert.notEqual(destination, "/app");
});

test("the wellbeing destination is the TOKEN, never a team id", () => {
  // The token is the authorization. Routing to `/wellbeing?team=…` from here
  // would mean trusting a team id nobody proved this person was invited to.
  const destination = invitedJoinDestination("wellbeing", TOKEN);
  assert.ok(destination.startsWith("/wellbeing/join/"));
  assert.ok(!destination.includes("?team="));
});

test("no wellbeing destination is ever the DISC dashboard, whatever the token", () => {
  for (const token of [TOKEN, "", "not-a-uuid", "../app", "%2e%2e", "x".repeat(200)]) {
    const destination = invitedJoinDestination("wellbeing", token);
    assert.notEqual(destination, "/app", `token ${JSON.stringify(token)} escaped to /app`);
    assert.ok(destination.startsWith("/wellbeing"), "and stays inside the wellbeing product");
  }
});

/* ── 3 · the token cannot become a redirect of its own ───────────────── */

test("a malformed token degrades to the wellbeing home, not an injected path", () => {
  // A path segment built from unvalidated input stops being the path you
  // wrote. Anything that is not a UUID is refused outright.
  assert.equal(invitedJoinDestination("wellbeing", "../../app"), WELLBEING_PARTICIPANT_HOME);
  assert.equal(invitedJoinDestination("wellbeing", "//evil.com"), WELLBEING_PARTICIPANT_HOME);
  assert.equal(
    invitedJoinDestination("wellbeing", "https://evil.com"),
    WELLBEING_PARTICIPANT_HOME,
  );
  assert.equal(invitedJoinDestination("wellbeing", ""), WELLBEING_PARTICIPANT_HOME);
});

test("only a well-formed uuid is interpolated into the path", () => {
  assert.equal(invitedJoinDestination("wellbeing", TOKEN), `/wellbeing/join/${TOKEN}`);
  // Upper case is still a valid UUID.
  assert.equal(
    invitedJoinDestination("wellbeing", TOKEN.toUpperCase()),
    `/wellbeing/join/${TOKEN.toUpperCase()}`,
  );
  // One character short, one too long, and a UUID with something appended.
  for (const bad of [TOKEN.slice(0, -1), `${TOKEN}0`, `${TOKEN}/../../app`, `${TOKEN}?x=1`]) {
    assert.equal(invitedJoinDestination("wellbeing", bad), WELLBEING_PARTICIPANT_HOME);
  }
});

/* ── 4 · open-redirect rejection ─────────────────────────────────────── */

test("a malicious next destination is rejected", () => {
  for (const hostile of [
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "http://localhost:3000/app",
    "",
    null,
    undefined,
  ]) {
    assert.equal(isSafeJoinNext(hostile), false, `${String(hostile)} must be rejected`);
  }
});

test("an ordinary relative destination is accepted", () => {
  for (const safe of [
    "/app",
    "/wellbeing",
    `/wellbeing/join/${TOKEN}`,
    "/wellbeing?team=abc",
    "/onboarding?join=abc",
  ]) {
    assert.equal(isSafeJoinNext(safe), true, `${safe} must be accepted`);
  }
});
