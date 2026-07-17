import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authErrorMessage,
  AUTH_ERROR_MESSAGES,
  classifyCallbackError,
  isSafeNext,
  onboardedDestination,
  onboardingDestination,
  parseIntent,
  safeNextOr,
} from "./intent.ts";

/* ── Intent survives the provider round trip ────────────────────── */

test("marketing and onboarding intent spellings both resolve", () => {
  // Pricing CTAs use kebab-case; onboarding radios use snake_case ids.
  assert.equal(parseIntent("create-team"), "team");
  assert.equal(parseIntent("create_team"), "team");
  assert.equal(parseIntent("team"), "team");
  assert.equal(parseIntent("manage_clients"), "coach");
  assert.equal(parseIntent("join_team"), "join");
  assert.equal(parseIntent("understand_myself"), "individual");
  assert.equal(parseIntent("setup_organization"), "organization");
});

test("intent parsing is case and whitespace tolerant", () => {
  assert.equal(parseIntent("  Create-Team "), "team");
});

test("unknown or absent intent resolves to null, never a guess", () => {
  assert.equal(parseIntent("nonsense"), null);
  assert.equal(parseIntent(null), null);
  assert.equal(parseIntent(""), null);
});

test("a new account keeps its intent through onboarding", () => {
  assert.equal(onboardingDestination("team"), "/onboarding?intent=team");
  assert.equal(onboardingDestination("coach"), "/onboarding?intent=coach");
  assert.equal(onboardingDestination(null), "/onboarding");
});

test("an onboarded team creator goes straight to the wizard", () => {
  // Never back through onboarding: they already have a profile, and the
  // wizard is the only place team details are collected.
  assert.equal(onboardedDestination("team"), "/app/teams/new");
  assert.equal(onboardedDestination("organization"), "/app/teams/new");
});

test("other onboarded intents land on their own area", () => {
  assert.equal(onboardedDestination("coach"), "/app/coach");
  assert.equal(onboardedDestination("join"), "/app/invitations");
  assert.equal(onboardedDestination("individual"), "/app");
  assert.equal(onboardedDestination(null), "/app");
});

/* ── Open-redirect protection ───────────────────────────────────── */

test("relative same-origin paths are allowed", () => {
  assert.ok(isSafeNext("/app"));
  assert.ok(isSafeNext("/app/teams/new"));
  assert.ok(isSafeNext("/join/abc?x=1"));
});

test("absolute and protocol-relative destinations are rejected", () => {
  // `next` arrives from an attacker-crafted link, so it is never trusted.
  assert.ok(!isSafeNext("https://evil.example.com"));
  assert.ok(!isSafeNext("http://evil.example.com"));
  assert.ok(!isSafeNext("//evil.example.com"));
  assert.ok(!isSafeNext("javascript:alert(1)"));
});

test("backslash escapes are rejected", () => {
  // Some browsers normalise "\" to "/", so "/\evil.com" can leave the origin.
  assert.ok(!isSafeNext("/\\evil.example.com"));
});

test("empty and missing next are rejected", () => {
  assert.ok(!isSafeNext(""));
  assert.ok(!isSafeNext(null));
  assert.ok(!isSafeNext(undefined));
});

test("safeNextOr falls back instead of following a hostile value", () => {
  assert.equal(safeNextOr("https://evil.example.com", "/app"), "/app");
  assert.equal(safeNextOr("/app/history", "/app"), "/app/history");
  assert.equal(safeNextOr(null, "/app/teams/new"), "/app/teams/new");
});

/* ── Errors are always readable, never silent ───────────────────── */

test("every auth error code has a human-readable message", () => {
  for (const [code, message] of Object.entries(AUTH_ERROR_MESSAGES)) {
    assert.ok(message.length > 20, `${code} has a real message`);
    assert.equal(authErrorMessage(code), message);
  }
});

test("an unknown error code yields null rather than a raw code", () => {
  // Better to show nothing than to print "oauth_xyz" at a user.
  assert.equal(authErrorMessage("something_else"), null);
  assert.equal(authErrorMessage(null), null);
});

test("a cancelled sign-in is distinguished from a failure", () => {
  // Pressing "Cancel" at Google is not an error worth alarming anyone about.
  assert.equal(classifyCallbackError("access_denied", null), "oauth_denied");
  assert.equal(classifyCallbackError(null, "access_denied"), "oauth_denied");
});

test("a provider misconfiguration is classified as such", () => {
  assert.equal(
    classifyCallbackError("invalid_request", "validation_failed"),
    "oauth_provider",
  );
  assert.equal(classifyCallbackError("provider_disabled", null), "oauth_provider");
});

test("anything else is a generic but still readable failure", () => {
  assert.equal(classifyCallbackError("server_error", null), "oauth_failed");
  assert.equal(classifyCallbackError(null, null), "oauth_failed");
  // The key property: it always maps to a code that HAS a message.
  assert.ok(authErrorMessage(classifyCallbackError("weird", null)));
});
