import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isSafeNext } from "../auth/intent.ts";
import { isSafeJoinNext } from "../join/destination.ts";

/**
 * The campaign token is a credential. This is what that has to mean.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY A SEPARATE FILE FROM campaign-architecture.test.ts.
 *
 * That file asserts the SHAPE of the architecture — which module resolves
 * what, and that DISC's machinery is no longer in the wellbeing path. This one
 * asserts the properties an attacker cares about: what a token is worth if you
 * guess at it, what happens if you present someone else's, and where the
 * product will send a browser after authentication.
 *
 * They fail for different reasons and are fixed by different changes, so they
 * are kept apart.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");

/* ── 1 · enumeration resistance ──────────────────────────────────────── */

/**
 * A campaign token is the ONLY thing standing between a stranger and a
 * campaign's name, organisation and instrument. So the interesting question is
 * not "is it random" — it is "how many guesses buys one hit".
 *
 * 32 bytes is 256 bits. At a wholly unrealistic 10^9 guesses per second
 * against the live service, exhausting even 2^80 of that space takes longer
 * than the age of the universe. The property is asserted structurally rather
 * than by sampling: sampling a CSPRNG proves nothing a bad implementation
 * would fail.
 */
test("a join token carries at least 128 bits of entropy", () => {
  const source = code("lib/wellbeing/campaigns.ts");
  const match = source.match(/randomBytes\((\d+)\)\.toString\("base64url"\)/);
  assert.ok(match, "the token must come from randomBytes");
  const bits = Number(match![1]) * 8;
  assert.ok(bits >= 128, `a join token must carry >= 128 bits of entropy, got ${bits}`);
  assert.equal(bits, 256, "and 32 bytes is what this build ships");
});

test("the token comes from the CSPRNG, never from Math.random or a timestamp", () => {
  const source = code("lib/wellbeing/campaigns.ts");
  assert.match(source, /from "node:crypto"/);
  for (const forbidden of ["Math.random", "Date.now", "toISOString", "counter"]) {
    assert.ok(
      !source.includes(forbidden),
      `a predictable source (${forbidden}) must never contribute to a token`,
    );
  }
});

/**
 * A token that does not match the column's own shape is refused BEFORE any
 * query runs. That keeps a malformed value out of the database entirely, and
 * makes "unknown token" and "malformed token" indistinguishable to a caller —
 * which is the point: neither tells them anything.
 */
test("a malformed token is refused without a lookup", () => {
  const source = code("lib/wellbeing/campaigns.ts");
  const resolver = source.slice(source.indexOf("export async function resolveCampaignByToken"));
  const guard = resolver.indexOf("isJoinTokenShape(token)");
  const query = resolver.indexOf("rpc(");
  assert.ok(guard > -1 && guard < query, "the shape check must precede the query");
  assert.match(
    resolver.slice(guard, guard + 120),
    /blocked: "not_found"/,
    "a malformed token must be indistinguishable from an unknown one",
  );
});

/* ── 2 · substitution ────────────────────────────────────────────────── */

/**
 * The lookup is by `join_token` and by nothing else, so a token can only ever
 * return its own campaign. There is no argument in which a caller could name a
 * campaign, an instrument or a version — which is what makes cross-campaign,
 * cross-instrument and cross-version substitution unreachable rather than
 * merely checked for.
 */
test("a campaign can only be resolved by its own token", () => {
  const source = code("lib/wellbeing/campaigns.ts");
  const migration = read("supabase/migrations/00047_wellbeing_campaign_adoption.sql");
  assert.match(migration, /where c\.join_token = token/, "the RPC matches on the token alone");

  const resolver = source.slice(
    source.indexOf("export async function resolveCampaignByToken"),
    source.indexOf("export interface AuthorisedCampaign"),
  );
  assert.ok(
    !/campaign_id|instrument_key:|version_id:/.test(
      resolver.slice(resolver.indexOf("rpc("), resolver.indexOf("rpc(") + 120),
    ),
    "nothing but the token may be sent to the lookup",
  );
});

test("the instrument and version are read from the campaign, never from a caller", () => {
  const action = code("lib/actions/wellbeing.ts");
  const begin = action.slice(
    action.indexOf("export async function beginWellbeingPulse"),
    action.indexOf("export async function saveWellbeingContext"),
  );
  // A client-supplied instrument survives ONLY on the solo path.
  assert.match(
    begin,
    /campaign\?\.instrumentKey \?\? \(campaignId \? null : \(parsed\.data\.instrumentKey \?\? null\)\)/,
  );
  // And no version ever comes from input.
  assert.ok(
    !/parsed\.data\.versionId|input\.versionId|formData\.get\("version/.test(begin),
    "a version must never be accepted from a caller",
  );
});

/* ── 3 · where authentication returns to ─────────────────────────────── */

/**
 * The auth `next` is a redirect target. An attacker who can choose it can send
 * a participant to their own host with the product's name on the referrer.
 */
test("an external or protocol-relative next is refused", () => {
  for (const hostile of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "http://evil.example/wellbeing/join/abc",
    "javascript:alert(1)",
    "",
    null,
    undefined,
  ]) {
    assert.equal(isSafeNext(hostile), false, `isSafeNext must refuse ${JSON.stringify(hostile)}`);
    assert.equal(
      isSafeJoinNext(hostile),
      false,
      `isSafeJoinNext must refuse ${JSON.stringify(hostile)}`,
    );
  }
  // And the campaign's own path is accepted, or the journey cannot complete.
  assert.equal(isSafeNext("/wellbeing/join/abcdefghijklmnopqrstuvwx"), true);
  assert.equal(isSafeJoinNext("/wellbeing/join/abcdefghijklmnopqrstuvwx"), true);
});

test("the campaign invitation sets next to its own route and nothing else", () => {
  const page = code("app/(wellbeing-public)/wellbeing/join/[token]/page.tsx");
  assert.match(page, /const next = campaignJoinPath\(token\)/);
  // Every auth link carries that same value, encoded.
  assert.match(page, /\/sign-up\?next=\$\{encodeURIComponent\(next\)\}/);
  assert.match(page, /\/sign-in\?next=\$\{encodeURIComponent\(next\)\}/);
  assert.match(page, /<OAuthButtons providers=\{providers\} next=\{next\}/);
  // The token is encoded into the path, so a token that somehow contained a
  // path separator could not become a different route.
  const helper = code("lib/wellbeing/campaigns.ts");
  assert.match(helper, /return `\/wellbeing\/join\/\$\{encodeURIComponent\(token\)\}`/);
});

test("the auth callback still filters the requested next", () => {
  const callback = code("app/auth/callback/route.ts");
  assert.match(callback, /isSafeNext\(requestedNext\)/);
});

/* ── 4 · what a refused participant is shown ─────────────────────────── */

test("a refusal names no id, count, instrument or organisation state", () => {
  const source = read("lib/wellbeing/campaigns.ts");
  const start = source.indexOf("export const CAMPAIGN_STATE_MESSAGES");
  const messages = source.slice(start, source.indexOf("};", start));
  for (const leak of ["uuid", "id ", "capacity of", "instrument", "version", "team"]) {
    assert.ok(
      !messages.toLowerCase().includes(leak.toLowerCase()),
      `a participant-facing campaign message leaks "${leak}"`,
    );
  }
  // It must still SAY something — a blank refusal is its own failure.
  for (const key of ["not_found", "closed", "expired", "draft", "archived", "full"]) {
    assert.match(messages, new RegExp(`${key}:`), `${key} needs a message`);
  }
});

/**
 * The pre-authentication lookup returns a fixed, narrow row.
 *
 * A printed QR is scanned by whoever picks up the poster, so what comes back
 * before sign-in must not enumerate a workforce. `capacity_reached` is a
 * boolean deliberately — a campaign may say it is full without saying how full
 * or how many people are in it.
 */
test("the public lookup exposes no roster, count or facilitator", () => {
  const migration = read("supabase/migrations/00047_wellbeing_campaign_adoption.sql");
  const fn = migration.slice(
    migration.indexOf("create function public.wellbeing_campaign_by_token"),
    migration.indexOf("revoke all on function public.wellbeing_campaign_by_token"),
  );
  const returns = fn.slice(fn.indexOf("returns table ("), fn.indexOf(")\nlanguage sql"));
  assert.deepEqual(
    returns
      .replace("returns table (", "")
      .split(",")
      .map((line) => line.trim().split(/\s+/)[0])
      .filter(Boolean),
    [
      "campaign_id",
      "campaign_name",
      "organization_name",
      "instrument_key",
      "version_id",
      "status",
      "is_open",
      "capacity_reached",
    ],
    "the pre-auth row changed — confirm nothing identifying was added",
  );
  assert.ok(
    !/created_by|participant_capacity[^_]|profile_id|email/.test(returns),
    "no identity or raw count may leave the security-definer boundary",
  );
});

/* ── 5 · a participant can read their own campaign, and only their own ── */

/**
 * The defect this pins.
 *
 * `wellbeing_campaigns` shipped with ONE select policy —
 * `has_any_wellbeing_role(organization_id)` — which was right while only
 * facilitators read the table and wrong the moment the participant journey
 * resolved through it. An ordinary participant holds no wellbeing role
 * anywhere, so reading their own campaign through their own client returned
 * nothing, and the check-in offered no way to start.
 *
 * It hid because the wellbeing suites' participants happen to hold analyst
 * grants in the demo organisation. It appeared only when a fixture built a
 * campaign in a DIFFERENT organisation — which is the shape every real
 * deployment has.
 */
test("a participant on the roster may read their campaign", () => {
  // SQL only. The prose above the policy explains what it replaces and names
  // the role-based policy it sits beside, so matching the raw file would test
  // the comment rather than the statement.
  const migration = read("supabase/migrations/00048_wellbeing_campaign_participant_read.sql")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  assert.match(migration, /create policy wellbeing_campaigns_read_own_membership/);
  assert.match(migration, /for select to authenticated/, "SELECT only");
  assert.match(
    migration,
    /m\.team_id = wellbeing_campaigns\.team_id\s+and m\.profile_id = auth\.uid\(\)/,
    "scoped to the participant's own roster membership",
  );

  // The policy statement itself, isolated: it must grant SELECT and must not
  // rest on a wellbeing role, which is the whole reason participants could not
  // see their own campaign.
  const policy = migration.slice(
    migration.indexOf("create policy wellbeing_campaigns_read_own_membership"),
    migration.indexOf("comment on policy"),
  );
  assert.ok(
    !/for (insert|update|delete|all)/i.test(policy),
    "the participant policy must not touch writes",
  );
  assert.ok(
    !/has_any_wellbeing_role|has_wellbeing_role/.test(policy),
    "membership is the rule here, not a role",
  );
});

test("the participant's campaign list is read through their own client", () => {
  const queries = code("lib/wellbeing/queries.ts");
  const fn = queries.slice(
    queries.indexOf("export async function getMyWellbeingCampaigns"),
    queries.indexOf("export function resolveParticipantCampaign"),
  );
  assert.match(fn, /context\.supabase/, "RLS-scoped, so the database decides what they may see");
  assert.ok(
    !/createSupabaseAdminClient/.test(fn),
    "a participant reading their own campaign must not need the service role",
  );
  assert.match(fn, /\.eq\("profile_id", context\.user\.id\)/, "and only their own memberships");
});

/* ── 6 · the service-role reach is narrow and justified ──────────────── */

test("the admin client is used only for the token lookup and the roster join", () => {
  const source = code("lib/wellbeing/campaigns.ts");
  const uses = source.match(/createSupabaseAdminClient\(\)/g) ?? [];
  assert.ok(uses.length <= 3, `service role used ${uses.length} times — each one needs a reason`);
  // The public, pre-authentication path must NOT use it: a misconfigured admin
  // key would otherwise break public joining, which is exactly the property
  // the DISC join route was built to keep.
  const resolver = source.slice(
    source.indexOf("export async function resolveCampaignByToken"),
    source.indexOf("export interface AuthorisedCampaign"),
  );
  assert.ok(
    !/createSupabaseAdminClient/.test(resolver),
    "the pre-authentication lookup must run on the anon client",
  );
  assert.match(resolver, /createSupabaseAnonClient\(\)/);
});

test("the roster join never claims another account's entry", () => {
  const source = code("lib/wellbeing/campaigns.ts");
  const roster = source.slice(source.indexOf("export async function joinCampaignRoster"));
  assert.match(
    roster,
    /byEmail\?\.profile_id && byEmail\.profile_id !== user\.id/,
    "an entry already claimed by another profile must be refused, not overwritten",
  );
  assert.match(roster, /return \{ ok: false, error: "This roster entry belongs to another account\." \}/);
});
