import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, submitSignIn } from "./helpers";

/**
 * The claim the whole campaign refactor rests on, driven through the real app.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY A BROWSER TEST AND NOT ONLY THE SQL HARNESS.
 *
 * `scripts/verify-campaign-pinning.sql` proves the DATABASE enforces the pin.
 * It cannot prove the application reads it. Those are different failures, and
 * the second one is the failure this codebase actually had: the assessment
 * runner carried a comment saying it served "the one THIS session was started
 * with — never a freshly resolved active one" while calling
 * `getActiveQuestionnaire()`, which resolves by `is_active` and never looks at
 * `session.version_id`.
 *
 * A migration harness would have passed throughout. So would every unit test.
 * The only thing that catches it is activating a second version and then
 * walking a participant through the product.
 *
 * WHY IT WAS INVISIBLE UNTIL NOW.
 *
 * Exactly one version per instrument may be active, and until this spec no
 * test had ever created a second one — so "the pinned version" and "the active
 * version" were always the same row, and both resolutions gave the same answer.
 * Making V2 is the entire experiment.
 *
 * WHAT IT DOES.
 *
 *   1 · V1 is active; Campaign A is created and pins V1.
 *   2 · V2 is created, worded differently, and activated.
 *   3 · A participant joins Campaign A through its QR token and starts.
 *   4 · The items they are shown must be V1's wording.
 *   5 · Campaign B, created after V2, serves V2 — so the fixture proves the
 *       pin is doing work rather than the product being stuck on old content.
 *   6 · Repinning Campaign A after participation is refused.
 *
 * Everything it creates, it removes.
 * ─────────────────────────────────────────────────────────────────────
 */

const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = (query: string) => {
  const out = execSync(
    `psql "${DB}" -t -A -c ${JSON.stringify(query.replace(/\s+/g, " ").trim())}`,
    { encoding: "utf8" },
  ).trim();
  return out.split("\n")[0]!.trim();
};

const PARTICIPANT = "demo@disc360.dev";
const INSTRUMENT = "disc360_wellbeing_v1";
const V2_MARKER = "PINNING-V2-WORDING";

const TOKEN_A = "pinning-e2e-campaign-a-000000000001";
const TOKEN_B = "pinning-e2e-campaign-b-000000000002";

let orgId = "";
let creator = "";
let v1 = "";
let v2 = "";
let teamA = "";
let teamB = "";
let campaignA = "";
let campaignB = "";

test.describe.configure({ timeout: 240_000 });

/** Everything this spec creates, by the fixed codes it creates them under. */
function cleanup(): void {
  for (const code of ["PINA-E2E", "PINB-E2E"]) {
    const team = sql(`select id from teams where team_code='${code}'`);
    if (!team) continue;
    sql(`delete from wellbeing_responses where session_id in
           (select id from wellbeing_sessions where team_id='${team}')`);
    sql(`delete from wellbeing_result_dimensions where result_id in
           (select id from wellbeing_results where team_id='${team}')`);
    sql(`delete from wellbeing_results where team_id='${team}'`);
    sql(`delete from wellbeing_sessions where team_id='${team}'`);
    sql(`delete from wellbeing_campaigns where team_id='${team}'`);
    sql(`delete from team_members where team_id='${team}'`);
    sql(`delete from teams where id='${team}'`);
  }
  // V2 last, and only after everything that references it.
  //
  // An interrupted run leaves the participant's own sessions pointing at V2,
  // and those are not reachable by team — the team may already be gone. So the
  // sweep is by VERSION here, which is the actual foreign key in the way.
  const stale = sql(
    `select id from wellbeing_versions where instrument_key='${INSTRUMENT}' and version=2`,
  );
  if (stale) {
    sql(`delete from wellbeing_responses where session_id in
           (select id from wellbeing_sessions where version_id='${stale}')`);
    sql(`delete from wellbeing_result_dimensions where result_id in
           (select id from wellbeing_results where version_id='${stale}')`);
    sql(`delete from wellbeing_results where version_id='${stale}'`);
    sql(`delete from wellbeing_sessions where version_id='${stale}'`);
    sql(`delete from wellbeing_campaigns where version_id='${stale}'`);
    sql(`delete from wellbeing_item_options where item_id in
           (select id from wellbeing_items where version_id='${stale}')`);
    sql(`delete from wellbeing_items where version_id='${stale}'`);
    sql(`delete from wellbeing_versions where id='${stale}'`);
  }
  // V1 back to active, whatever happened.
  sql(`update wellbeing_versions set is_active=true
        where instrument_key='${INSTRUMENT}' and version=1`);
}

/** Removes this participant's attempts so each case starts from nothing. */
function clearAttempts(): void {
  sql(`delete from wellbeing_responses where session_id in
         (select s.id from wellbeing_sessions s join profiles p on p.id=s.profile_id
          where p.email='${PARTICIPANT}')`);
  sql(`delete from wellbeing_result_dimensions where result_id in
         (select r.id from wellbeing_results r join profiles p on p.id=r.profile_id
          where p.email='${PARTICIPANT}')`);
  sql(`delete from wellbeing_results r using profiles p
         where p.id=r.profile_id and p.email='${PARTICIPANT}'`);
  sql(`delete from wellbeing_sessions s using profiles p
         where p.id=s.profile_id and p.email='${PARTICIPANT}'`);
}

test.beforeAll(() => {
  cleanup();
  clearAttempts();

  orgId = sql(`select organization_id from teams where wellbeing_instrument_key is not null limit 1`);
  creator = sql(`select created_by from teams where organization_id='${orgId}' limit 1`);
  v1 = sql(`select id from wellbeing_versions where instrument_key='${INSTRUMENT}' and is_active`);

  /* 1 · Campaign A, pinning V1 while V1 is the active version. */
  teamA = sql(
    `insert into teams (organization_id, name, team_code, created_by, assessment_type,
                        wellbeing_instrument_key, join_enabled)
     values ('${orgId}','Pinning A','PINA-E2E','${creator}','wellbeing','${INSTRUMENT}',false)
     returning id`,
  );
  campaignA = sql(
    `insert into wellbeing_campaigns
       (organization_id, instrument_key, version_id, created_by, name, status, join_token, team_id)
     values ('${orgId}','${INSTRUMENT}','${v1}','${creator}','Pinning A','active',
             '${TOKEN_A}','${teamA}')
     returning id`,
  );

  /* 2 · V2: same shape, visibly different wording, and now the active one. */
  sql(`update wellbeing_versions set is_active=false where id='${v1}'`);
  v2 = sql(
    `insert into wellbeing_versions
       (name, version, questionnaire_code, instrument_key, content_status, item_count,
        licence_note, is_active)
     values ('Pinning V2', 2, '${INSTRUMENT}', '${INSTRUMENT}', 'licensed', 12,
             'E2E fixture', true)
     returning id`,
  );
  sql(`insert into wellbeing_items (version_id, external_id, position, prompt, facet, dimension_key)
       select '${v2}', external_id, position, '${V2_MARKER} ' || prompt, facet, dimension_key
         from wellbeing_items where version_id='${v1}'`);
  sql(`insert into wellbeing_item_options (item_id, position, label, points)
       select i2.id, o.position, o.label, o.points
         from wellbeing_items i1
         join wellbeing_item_options o on o.item_id=i1.id
         join wellbeing_items i2 on i2.version_id='${v2}' and i2.external_id=i1.external_id
        where i1.version_id='${v1}'`);

  /* 3 · Campaign B, created AFTER V2 — it may pin V2. */
  teamB = sql(
    `insert into teams (organization_id, name, team_code, created_by, assessment_type,
                        wellbeing_instrument_key, join_enabled)
     values ('${orgId}','Pinning B','PINB-E2E','${creator}','wellbeing','${INSTRUMENT}',false)
     returning id`,
  );
  campaignB = sql(
    `insert into wellbeing_campaigns
       (organization_id, instrument_key, version_id, created_by, name, status, join_token, team_id)
     values ('${orgId}','${INSTRUMENT}','${v2}','${creator}','Pinning B','active',
             '${TOKEN_B}','${teamB}')
     returning id`,
  );
});

test.afterAll(() => {
  clearAttempts();
  cleanup();
});

async function signIn(page: Page): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(PARTICIPANT);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await submitSignIn(page);
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

/** Join through the campaign's own token, consent, and reach the questions. */
async function startThrough(page: Page, token: string, campaignId: string): Promise<void> {
  await page.goto(`/wellbeing/join/${token}`);
  await page.waitForLoadState("networkidle");
  await page.goto(`/wellbeing?campaign=${campaignId}`);
  const consent = page.getByRole("checkbox").first();
  if (await consent.count()) await consent.check();

  // Wait for the start control with a SHORT timeout and say what was on screen
  // instead.
  //
  // Clicking a locator that never appears blocks for the whole test timeout and
  // then reports "waiting for getByRole(...)", which says nothing about why the
  // page had no button. The landing page renders it only once it has resolved a
  // campaign for this participant, so the interesting evidence is the page —
  // and a 12-minute hang is a worse way to learn that than a 15-second failure
  // carrying the text.
  const start = page.getByRole("button", { name: /Start my Wellbeing Pulse/i });
  try {
    await start.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 600);
    throw new Error(
      `no start control on ${page.url()} — the campaign was not resolved for this ` +
        `participant. Page said: ${text}`,
    );
  }
  await start.click();
  await page.waitForURL("**/wellbeing/assessment/**", { timeout: 20_000 });

  const department = page.locator("#wb-department");
  if (await department.count()) {
    await department.selectOption({ index: 1 });
    await page.locator('input[type="radio"][value="field_based"]').first().check();
    await page.getByRole("button", { name: /Continue to the questions/i }).click();
  }
  await expect(
    page.locator('button[aria-pressed][class*="rounded-2xl"]').first(),
  ).toBeVisible({ timeout: 20_000 });
}

/* ── the fixture itself is worth asserting ───────────────────────────── */

test("the fixture really does have two versions, with V2 active", () => {
  expect(v1, "V1 must exist").toBeTruthy();
  expect(v2, "V2 must exist").toBeTruthy();
  expect(v1).not.toEqual(v2);
  expect(sql(`select id from wellbeing_versions where instrument_key='${INSTRUMENT}' and is_active`))
    .toEqual(v2);
  expect(sql(`select version_id from wellbeing_campaigns where id='${campaignA}'`)).toEqual(v1);
  expect(sql(`select version_id from wellbeing_campaigns where id='${campaignB}'`)).toEqual(v2);
});

/* ── THE TEST THIS FILE EXISTS FOR ───────────────────────────────────── */

test("a new participant in Campaign A is served V1, not the newly activated V2", async ({
  page,
}) => {
  test.slow();
  clearAttempts();
  await signIn(page);
  await startThrough(page, TOKEN_A, campaignA);

  // The wording on screen is the evidence. V2's prompts all carry a marker;
  // seeing it here would mean the runner resolved by `is_active`.
  const body = await page.locator("body").innerText();
  expect(
    body,
    "Campaign A's participant was served the newly activated V2 — the pin is not being read",
  ).not.toContain(V2_MARKER);

  // And the stored session names V1, so the result's provenance is V1 too.
  const sessionVersion = sql(
    `select s.version_id from wellbeing_sessions s
       join profiles p on p.id=s.profile_id
      where p.email='${PARTICIPANT}' and s.campaign_id='${campaignA}'
      order by s.started_at desc limit 1`,
  );
  expect(sessionVersion).toEqual(v1);
});

test("a participant in Campaign B, created after V2, IS served V2", async ({ page }) => {
  test.slow();
  // Deliberately NOT clearAttempts() — Campaign A's session from the previous
  // test has to survive, because the two tests after this one read both.
  //
  // Clearing here is what made them fail: A's session was deleted, so "two
  // campaigns, two versions" counted one, and "repinning A is refused" found a
  // campaign with no participants and was allowed. Both looked like product
  // failures and were this fixture eating its own evidence.
  //
  // Nothing conflicts: the resume lookup is scoped by campaign_id, and the
  // in-progress uniqueness index is per (participant, team, instrument), so
  // holding one attempt in each campaign is a legitimate state.
  await signIn(page);
  await startThrough(page, TOKEN_B, campaignB);

  // The other half of the proof. Without this, "always shows V1" would pass
  // just as well if the product were simply stuck on the oldest version.
  const body = await page.locator("body").innerText();
  expect(body, "Campaign B must serve the version it pinned").toContain(V2_MARKER);

  const sessionVersion = sql(
    `select s.version_id from wellbeing_sessions s
       join profiles p on p.id=s.profile_id
      where p.email='${PARTICIPANT}' and s.campaign_id='${campaignB}'
      order by s.started_at desc limit 1`,
  );
  expect(sessionVersion).toEqual(v2);
});

test("two live campaigns serve two different versions at the same moment", () => {
  const versions = sql(
    `select count(distinct version_id) from wellbeing_sessions
      where campaign_id in ('${campaignA}','${campaignB}')`,
  );
  expect(Number(versions)).toBeGreaterThanOrEqual(2);
});

/* ── and the pin cannot be moved once anybody has answered ───────────── */

test("repinning Campaign A after participation is refused by the database", () => {
  let refused = false;
  try {
    execSync(
      `psql "${DB}" -v ON_ERROR_STOP=1 -c ${JSON.stringify(
        `update wellbeing_campaigns set version_id='${v2}' where id='${campaignA}'`,
      )}`,
      { encoding: "utf8", stdio: "pipe" },
    );
  } catch {
    refused = true;
  }
  expect(refused, "a campaign with participants must not be repinned").toBe(true);
  expect(sql(`select version_id from wellbeing_campaigns where id='${campaignA}'`)).toEqual(v1);
});
