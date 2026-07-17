import assert from "node:assert/strict";
import { test } from "node:test";
import { getOAuthProviderStatus, isCredentialSet } from "./oauth-providers.ts";

/**
 * The behaviour under test is the one that made sign-in look broken: an
 * unconfigured provider must be reported as unconfigured, not offered.
 */

const GOOGLE = { GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" };
const AZURE = {
  AZURE_CLIENT_ID: "id",
  AZURE_CLIENT_SECRET: "secret",
  AZURE_TENANT_URL: "https://login.microsoftonline.com/common",
};

const statusOf = (env: Record<string, string | undefined>, id: string) => {
  const provider = getOAuthProviderStatus(env).find((p) => p.id === id);
  assert.ok(provider, `${id} is a known provider`);
  return provider;
};

test("both providers are offered", () => {
  const ids = getOAuthProviderStatus({}).map((p) => p.id);
  assert.deepEqual(ids, ["google", "azure"]);
});

test("an empty environment configures nothing", () => {
  for (const provider of getOAuthProviderStatus({})) {
    assert.equal(provider.configured, false, `${provider.id} is not configured`);
  }
});

test("an unsubstituted env() placeholder does not count as configured", () => {
  // The Supabase CLI leaves the literal string "env(GOOGLE_CLIENT_ID)" behind
  // when the variable is missing, and forwards it to Google as the client id —
  // which lands the user on a Google error page. It must never read as set.
  assert.equal(isCredentialSet("env(GOOGLE_CLIENT_ID)"), false);
  assert.equal(isCredentialSet("ENV(anything)"), false);
  assert.equal(
    statusOf(
      { GOOGLE_CLIENT_ID: "env(GOOGLE_CLIENT_ID)", GOOGLE_CLIENT_SECRET: "env(x)" },
      "google",
    ).configured,
    false,
  );
});

test("blank and whitespace-only values do not count as configured", () => {
  assert.equal(isCredentialSet(""), false);
  assert.equal(isCredentialSet("   "), false);
  assert.equal(isCredentialSet(undefined), false);
});

test("a real value counts as configured", () => {
  assert.equal(isCredentialSet("123-abc.apps.googleusercontent.com"), true);
});

test("Google needs both id and secret", () => {
  assert.equal(statusOf(GOOGLE, "google").configured, true);
  assert.equal(statusOf({ GOOGLE_CLIENT_ID: "id" }, "google").configured, false);
  assert.equal(statusOf({ GOOGLE_CLIENT_SECRET: "s" }, "google").configured, false);
});

test("Microsoft needs the tenant URL as well as id and secret", () => {
  // Without the tenant URL Supabase cannot know which account types are
  // permitted, which surfaces as AADSTS50194 at sign-in rather than here.
  assert.equal(statusOf(AZURE, "azure").configured, true);
  assert.equal(
    statusOf({ AZURE_CLIENT_ID: "id", AZURE_CLIENT_SECRET: "s" }, "azure").configured,
    false,
  );
});

test("providers are judged independently", () => {
  const env = { ...GOOGLE };
  assert.equal(statusOf(env, "google").configured, true);
  assert.equal(statusOf(env, "azure").configured, false);
});

test("the unconfigured message names the provider", () => {
  // "Google sign-in requires provider configuration." — never a generic
  // message, and never a button that silently does nothing.
  assert.equal(
    statusOf({}, "google").unconfiguredMessage,
    "Google sign-in requires provider configuration.",
  );
  assert.equal(
    statusOf({}, "azure").unconfiguredMessage,
    "Microsoft sign-in requires provider configuration.",
  );
});

test("no credential value is ever exposed on the status object", () => {
  // Only booleans and copy cross to the client.
  const serialised = JSON.stringify(getOAuthProviderStatus({ ...GOOGLE, ...AZURE }));
  assert.doesNotMatch(serialised, /secret/i);
  assert.ok(!serialised.includes("login.microsoftonline.com"));
});
