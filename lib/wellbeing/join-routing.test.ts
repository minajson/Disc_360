import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The participant's route in, and the product boundary along it.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THESE TESTS ARE FOR.
 *
 * A production Wellbeing Pulse QR opened the DISC join form — "You have been
 * invited to complete the DISC360 assessment for this team. 24 quick
 * scenarios", an Employee / reference ID field, and a behavioural-profile
 * consent checkbox. Two independent faults caused it:
 *
 *  1 · The campaign was typed as a DISC team, so every DISC surface claimed
 *      it, including the QR generator.
 *  2 · The Wellbeing join page sat inside a layout that calls `requireUser()`,
 *      so it could never render for the one audience it exists for — a person
 *      with no account, holding a printed code.
 *
 * Both are the kind of fault that is invisible in review and obvious in a
 * corridor with a phone. These hold them shut.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");
const code = (path: string) =>
  read(path)
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
    })
    .join("\n");

/* ── 1 · the printed code reaches the right product ──────────────────── */

test("a wellbeing token is redirected off the DISC join route", () => {
  const page = code("app/join/[token]/page.tsx");
  assert.match(
    page,
    /context\.assessmentType === "wellbeing"[\s\S]{0,120}redirect\(`\/wellbeing\/join\/\$\{token\}`\)/,
    "the DISC join must hand a wellbeing campaign to the wellbeing journey",
  );
  // Before anything DISC-shaped is decided or rendered. The redirect existing
  // further down, after membership has been accepted, would be no fix at all.
  //
  // Compared against the CALL, not the imported name: every import sits at the
  // top of the file and would make this assertion impossible to satisfy.
  assert.ok(
    page.indexOf('=== "wellbeing"') < page.indexOf("acceptInvitationToken(token)"),
    "the redirect must precede any DISC membership acceptance",
  );
  assert.ok(
    page.indexOf('=== "wellbeing"') < page.indexOf("<JoinForm"),
    "and must precede the DISC join form",
  );
});

test("a DISC token keeps the DISC journey untouched", () => {
  const page = code("app/join/[token]/page.tsx");
  // The redirect is conditional on the wellbeing type only — never on the
  // absence of something, which would silently capture DISC teams whose
  // assessment_type is null.
  assert.ok(
    !/assessmentType !== "disc"/.test(page),
    "the branch must test for wellbeing, not for not-DISC",
  );
  assert.match(page, /<JoinForm/, "the DISC join form is still rendered");
  assert.match(page, /acceptInvitationToken|acceptTeamLink/, "and DISC membership still happens");
});

/* ── 2 · the invitation renders before sign-in ───────────────────────── */

test("the wellbeing invitation lives outside every authenticated layout", () => {
  const layouts = readdirSync(new URL("app/", ROOT), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("(wellbeing"))
    .map((entry) => entry.name);
  assert.ok(layouts.includes("(wellbeing-public)"), "the public group must exist");

  // The page is in the public group...
  assert.doesNotThrow(() =>
    read("app/(wellbeing-public)/wellbeing/join/[token]/page.tsx"),
  );
  // ...and that group's layout must not authenticate.
  const layout = code("app/(wellbeing-public)/layout.tsx");
  for (const guard of ["requireUser", "requireOnboarded", "requireTeamAdmin"]) {
    assert.ok(
      !layout.includes(guard),
      `the public wellbeing layout must not call ${guard} — the invitation is for people with no account`,
    );
  }

  // And the authenticated group must still guard everything left in it.
  assert.match(code("app/(wellbeing)/layout.tsx"), /requireUser\(\)/);
});

test("the middleware still treats the invitation as public", () => {
  const middleware = code("middleware.ts");
  assert.match(middleware, /PUBLIC_EXCEPTIONS = \["\/wellbeing\/join"\]/);
  assert.match(middleware, /searchParams\.set\("next", target\)/, "and preserves the destination");
});

/* ── 3 · the invitation is a wellbeing surface, not a DISC one ───────── */

test("the invitation carries no DISC wording and no reference id", () => {
  // Comment-stripped: the page EXPLAINS in prose which fields were removed and
  // why, so screening the raw file would flag the documentation of the rule as
  // a breach of it.
  const page = code("app/(wellbeing-public)/wellbeing/join/[token]/page.tsx");
  for (const forbidden of [
    "DISC360 assessment",
    "behavioral profile",
    "behavioural profile",
    "24 quick scenarios",
    "seven minutes",
    "reference ID",
    "reference_id",
    "Employee",
    "Sub Team",
  ]) {
    assert.ok(
      !page.toLowerCase().includes(forbidden.toLowerCase()),
      `the wellbeing invitation must not contain "${forbidden}"`,
    );
  }
});

test("no wellbeing surface collects an employee or reference id", () => {
  const walk = (dir: string): string[] => {
    const found: string[] = [];
    for (const entry of readdirSync(new URL(dir, ROOT), { withFileTypes: true })) {
      const path = `${dir}${entry.name}`;
      if (entry.isDirectory()) {
        found.push(...walk(`${path}/`));
        continue;
      }
      if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts")) found.push(path);
    }
    return found;
  };
  const surfaces = [
    ...walk("app/(wellbeing)/"),
    ...walk("app/(wellbeing-public)/"),
    ...walk("app/(wellbeing-present)/"),
    ...walk("components/wellbeing/"),
    ...walk("lib/wellbeing/"),
  ];
  for (const path of surfaces) {
    const source = code(path);
    for (const forbidden of ["reference_id", "referenceId", "employee_id", "employeeId"]) {
      assert.ok(!source.includes(forbidden), `${path} collects ${forbidden}`);
    }
  }
});

/* ── 4 · the destination survives authentication ─────────────────────── */

test("the invitation carries itself through sign-in, not the dashboard", () => {
  const page = code("app/(wellbeing-public)/wellbeing/join/[token]/page.tsx");
  // Built by `campaignJoinPath` rather than interpolated here, so the auth
  // `next`, the onboarding return and the QR code cannot drift into three
  // different shapes of the same URL.
  assert.match(
    page,
    /const next = campaignJoinPath\(token\)/,
    "returning to the invitation is what lets the token grant membership",
  );
  assert.ok(!/next = "\/app"/.test(page), "never the DISC dashboard");
  assert.match(page, /next=\$\{encodeURIComponent\(next\)\}/, "and it rides on the auth links");
  assert.match(page, /<OAuthButtons providers=\{providers\} next=\{next\}/, "and through OAuth");
});

test("a signed-in visitor joins from the token and goes to their campaign", () => {
  const page = code("app/(wellbeing-public)/wellbeing/join/[token]/page.tsx");
  // Membership now comes from the CAMPAIGN the token resolved to, not from a
  // DISC team-link acceptance. The rule is the same one, applied to the right
  // credential: the token is the authorization, and a signed-in participant
  // must never be able to join by supplying an id.
  assert.match(
    page,
    /const authorised = await loadAuthorisedCampaignByToken\(token\)/,
    "the campaign is resolved from the TOKEN",
  );
  assert.match(page, /joinCampaignRoster\(authorised, user,/, "and the roster join uses it");
  assert.ok(
    !/acceptTeamLink\(/.test(page),
    "the wellbeing invitation must not accept a DISC team link",
  );
  assert.match(
    page,
    /redirect\(`\/wellbeing\?campaign=\$\{encodeURIComponent\(campaign\.campaignId\)\}`\)/,
  );
});

/**
 * The rule that makes the two credential spaces disjoint.
 *
 * A wellbeing token that does not resolve must NOT be retried against DISC's
 * resolver. Falling back would let a mistyped, revoked or expired wellbeing
 * link land somebody in the DISC assessment — a different product, a different
 * consent, measuring a different thing.
 */
test("an unresolvable wellbeing token never falls back to the DISC resolver", () => {
  const page = code("app/(wellbeing-public)/wellbeing/join/[token]/page.tsx");
  assert.match(page, /resolveCampaignByToken\(token\)/, "one resolver");
  assert.ok(
    !/getJoinContext\(/.test(page),
    "the wellbeing invitation must not consult DISC's join resolver at all",
  );
  assert.ok(
    !/resolve_join_token/.test(page),
    "nor its RPC",
  );
  // And a refusal offers the wellbeing front door, never /app.
  assert.match(page, /href="\/wellbeing"/);
  assert.ok(!/href="\/app"/.test(page), "a refused participant is never sent into DISC360");
});

test("only usable providers are offered on an invitation", () => {
  const page = code("app/(wellbeing-public)/wellbeing/join/[token]/page.tsx");
  assert.match(page, /getUsableOAuthProviders\(\)/);
  const resolver = code("lib/auth/oauth-providers.ts");
  assert.match(resolver, /filter\(\(provider\) => provider\.configured\)/);
  // The sign-in page keeps showing them with an explanation — a different
  // audience, and a deliberately different decision.
  assert.match(code("app/(auth)/sign-in/page.tsx"), /getOAuthProviderStatus\(\)/);
});

/* ── 5 · the campaign decides the instrument ─────────────────────────── */

test("the landing page resolves the invited campaign's own instrument", () => {
  const page = code("app/(wellbeing)/wellbeing/page.tsx");
  assert.match(page, /getMyWellbeingCampaigns\(context\)/, "the campaign is asked");
  // The campaign is the one from the link OR the participant's own membership.
  //
  // It used to be the link alone, with "the single live instrument" as the
  // fallback — which silently stopped working the moment more than one
  // instrument was licensed, and told a participant who genuinely belonged to
  // a campaign that the check-in was not open. Membership does not depend on
  // how somebody arrived.
  assert.match(
    page,
    /const myCampaigns = await getMyWellbeingCampaigns\(context\)/,
    "membership is consulted rather than trusting the link alone",
  );
  // A campaign id in the URL SELECTS from the participant's own campaigns, so
  // it can narrow the list but never extend it.
  //
  // Returning a LIST rather than an optional single campaign is the fix that
  // matters here: collapsing to null the moment somebody belonged to two
  // campaigns told a real participant the check-in was not open, and gave them
  // no way to say which one they meant.
  assert.match(
    page,
    /resolveParticipantCampaign\(myCampaigns, campaignParam\)/,
    "the requested campaign is resolved against membership",
  );
  const queries = code("lib/wellbeing/queries.ts");
  assert.match(
    queries,
    /return campaigns\.find\(\(campaign\) => campaign\.campaignId === requestedId\) \?\? null/,
    "an id that is not one of theirs resolves to nothing",
  );
  assert.match(
    page,
    /campaign\s*\?[\s\S]{0,160}availability\.find/,
    "and its instrument wins",
  );
  // The "one active instrument" fallback must remain reachable ONLY with no
  // campaign — that fallback is what told a GHQ-12 participant they were
  // taking a workplace wellbeing reflection.
  assert.ok(
    page.indexOf("myCampaigns") < page.indexOf("live.length === 1"),
    "the solo fallback must come after the campaign, never before it",
  );
});

/* ── 6 · sub-units are organisational metadata, never a team ─────────── */

/** SQL with `--` comment lines removed, for the same reason as `code()`. */
const sql = (path: string) =>
  read(path)
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

test("the sub-unit catalogue is its own table, not public.teams", () => {
  const migration = sql("supabase/migrations/00035_wellbeing_sub_units.sql");
  assert.match(migration, /create table public\.wellbeing_sub_units/);
  assert.match(migration, /organization_id uuid not null/, "always tenant-owned");
  assert.match(migration, /department_id uuid references public\.wellbeing_departments/);
  assert.match(migration, /is_active boolean not null default true/, "soft disable");
  assert.match(migration, /normalized_name/, "a sensible unique key");
  assert.match(
    migration,
    /create unique index wellbeing_sub_units_org_name_uniq/,
    "one name per organisation",
  );
  assert.ok(
    !/from public\.teams|references public\.teams/.test(migration),
    "a sub-unit must not be an assessment team",
  );
  assert.ok(!/drop table|delete from/i.test(migration), "additive only");
});

test("the sub-unit catalogue grants no result access", () => {
  const migration = read("supabase/migrations/00035_wellbeing_sub_units.sql");
  const policies = migration.slice(migration.indexOf("enable row level security"));
  assert.match(policies, /can_read_wellbeing_lookup\(organization_id\)/, "read is the lookup rule");
  assert.match(
    policies,
    /has_wellbeing_role\(organization_id, 'wellbeing_governance'\)/,
    "write is governance",
  );
  assert.ok(!/for delete/i.test(policies), "retiring is is_active, never a delete");
  assert.ok(
    !/wellbeing_results|wellbeing_sessions_select/.test(policies),
    "this table's policies must not mention results",
  );
});

test("a participant's sub-unit is snapshotted, not linked for reporting", () => {
  const migration = read("supabase/migrations/00035_wellbeing_sub_units.sql");
  assert.match(migration, /add column sub_unit_at_completion text/, "results keep a text snapshot");
  const snapshot = code("lib/wellbeing/snapshot.ts");
  assert.match(snapshot, /sub_unit_at_completion: input\.subUnitName/);
});

test("the public join-context RPC returns no identity and refuses DISC teams", () => {
  const migration = read("supabase/migrations/00036_wellbeing_join_context.sql");
  assert.match(migration, /returns table \(instrument_key text, facilitator_name text\)/);
  assert.match(migration, /t\.assessment_type = 'wellbeing'/, "a DISC token returns nothing");
  assert.match(migration, /t\.join_enabled/, "and a closed campaign returns nothing");
  for (const forbidden of ["profile_id", "team_id,", "organization_id,", "total_score"]) {
    assert.ok(!migration.includes(forbidden), `the RPC must not return ${forbidden}`);
  }
});

/* ── 7 · DISC surfaces list DISC teams only ──────────────────────────── */

test("no DISC participant or facilitator surface lists a wellbeing campaign", () => {
  // Each of these reads `teams` — the table a wellbeing campaign is stored in
  // — and each must exclude campaigns explicitly. A surface that forgets
  // offers a participant a DISC assessment for a wellbeing pulse.
  const surfaces: { path: string; why: string }[] = [
    { path: "app/app/(shell)/page.tsx", why: "the participant dashboard, Teams panel and session card" },
    { path: "app/app/(shell)/teams/page.tsx", why: "the teams list, for members and platform admins" },
  ];
  for (const surface of surfaces) {
    const source = code(surface.path);
    assert.match(
      source,
      /assessment_type"?,? ?!== "wellbeing"|\.neq\("assessment_type", "wellbeing"\)/,
      `${surface.path} (${surface.why}) must exclude wellbeing campaigns`,
    );
  }
});

test("the DISC team dashboard refuses a wellbeing campaign outright", () => {
  const layout = code("app/app/(shell)/teams/[teamId]/layout.tsx");
  assert.match(layout, /assessment_type === "wellbeing"/);
  assert.match(layout, /redirect\(`\/wellbeing\/admin\/campaigns\/\$\{teamId\}`\)/);
  assert.ok(
    layout.indexOf('assessment_type === "wellbeing"') < layout.indexOf("<TeamTabs"),
    "the boundary must be enforced before any DISC surface is composed",
  );
});

test("the wellbeing workspace refuses a DISC team outright", () => {
  // The same boundary in the other direction — rendering wellbeing chrome
  // over DISC data is the same product failure reversed.
  const loader = code("lib/wellbeing/campaign-workspace.ts");
  assert.match(loader, /assessment_type !== "wellbeing"/);
  assert.match(loader, /notFound\(\)/);
});

/* ── 8 · the destination survives an already-signed-in visitor ───────── */

test("an authenticated visitor on an auth page keeps their destination", () => {
  const middleware = code("middleware.ts");
  const branch = middleware.slice(middleware.indexOf("if (user && isAuthPage)"));
  assert.match(
    branch,
    /searchParams\.get\("next"\)/,
    "an already-signed-in visitor still has an intent — tapping 'I already have an account' on a wellbeing invitation carries the campaign in ?next=",
  );
  assert.match(
    branch,
    /requested\.startsWith\("\/"\) && !requested\.startsWith\("\/\/"\)/,
    "and only a safe relative path is honoured — `//host` is an open redirect",
  );
  assert.match(branch, /url\.pathname = "\/app";/, "with /app still the fallback");
});

/* ── 9 · consent describes the questionnaire actually being asked ────── */

test("consent states this instrument's own length, not a fixed one", () => {
  const content = code("data/wellbeing-content.ts");
  const body = content.slice(
    content.indexOf("export const CONSENT_BODY"),
    content.indexOf("export const CONSENT_AGREE"),
  );
  // The count and duration must NOT be baked into the shared paragraphs: they
  // were "twelve short questions … about three minutes", which is a false
  // statement to anyone invited to WHO-5 (five items) or GHQ-28 (twenty-eight).
  assert.ok(
    !/twelve|twenty-eight|three minutes/i.test(body),
    "the shared consent paragraphs must not name a question count or a duration",
  );
  assert.match(content, /export function consentIntro\(itemCount: number/);

  const landing = code("app/(wellbeing)/wellbeing/page.tsx");
  assert.match(
    landing,
    /consentIntro\(\s*questionnaire\.instrument\.itemCount,\s*questionnaire\.instrument\.minutesToComplete,\s*\)/,
    "and the landing must build it from the campaign's own instrument",
  );
});
