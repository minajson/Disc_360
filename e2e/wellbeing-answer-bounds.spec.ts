import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, submitSignIn } from "./helpers";

/**
 * The TOP response option, on the instrument that is actually live.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS SUITE EXISTS.
 *
 * `saveWellbeingResponse` validated an answer with `position: min(0).max(3)` —
 * GHQ-12's four response options — and applied it to every instrument. DISC360
 * Wellbeing Pulse V1 offers FIVE (positions 0–4), and it is the one instrument
 * that is active and shipping. So its top answer, "always", was rejected by the
 * server with "Invalid answer" on every item, for every participant.
 *
 * Nothing in the suite caught it. The existing wellbeing specs reach the
 * questionnaire and stop; none of them completes a pulse, so no test had ever
 * chosen the fifth option. The WHO-5 journey does exercise position 4, but
 * WHO-5 is held and unservable in production — it could not have covered this.
 *
 * WHAT THIS ASSERTS, AND WHY IN THIS SHAPE.
 *
 * Every item is answered at the HIGHEST position the instrument offers. That is
 * the exact value the old bound refused, so before the fix this suite cannot
 * reach a result at all — the questionnaire never advances past item one.
 *
 * It also asserts the arithmetic, because "the answer was accepted" and "the
 * answer was recorded as the one chosen" are different claims: a bound that
 * clamped rather than refused would still let the journey finish, and would
 * silently record a different answer than the participant gave.
 *
 * NO HELD CONTENT REQUIRED. DISC360 Wellbeing V1's content ships in migration
 * 00026, which is applied everywhere including production. This suite
 * therefore runs against the SAFETY-MIGRATION-ONLY database — the exact
 * configuration production will be in — and needs nothing from
 * supabase/instrument-content/.
 * ─────────────────────────────────────────────────────────────────────
 */

const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = (query: string) =>
  execSync(`psql "${DB}" -t -A -c ${JSON.stringify(query.replace(/\s+/g, " ").trim())}`, {
    encoding: "utf8",
  })
    .trim()
    .split("\n")[0]!
    .trim();

const PARTICIPANT = "demo@disc360.dev";
const INSTRUMENT = "disc360_wellbeing_v1";

// A full journey is sign-in, join, consent, the context form and twelve answers
// that each round-trip to the server.
test.describe.configure({ timeout: 240_000 });

let teamId = "";
let inviteToken = "";
/** The highest option position this instrument offers, read from the database. */
let topPosition = -1;
let itemCount = -1;

function removeFixtureCampaign(): void {
  const existing = sql(`select id from teams where team_code='WBV1-TOP'`);
  if (!existing) return;
  sql(`delete from wellbeing_responses where session_id in
         (select id from wellbeing_sessions where team_id='${existing}')`);
  sql(`delete from wellbeing_result_dimensions where result_id in
         (select id from wellbeing_results where team_id='${existing}')`);
  sql(`delete from wellbeing_results where team_id='${existing}'`);
  sql(`delete from wellbeing_sessions where team_id='${existing}'`);
  sql(`delete from team_members where team_id='${existing}'`);
  sql(`delete from teams where id='${existing}'`);
}

test.beforeAll(() => {
  removeFixtureCampaign();
  /*
   * The fixture builds its own campaign from any organisation that has a team.
   *
   * Deliberately NOT "the organisation that already runs a wellbeing campaign":
   * that made the suite depend on scripts/seed-wellbeing-demo.sql, and this one
   * has to run against a database carrying only the migrations PRODUCTION will
   * have — no demo seed, no held instrument content.
   */
  const orgId = sql(`select organization_id from teams where organization_id is not null limit 1`);
  const creator = sql(
    `select created_by from teams where organization_id='${orgId}' and created_by is not null limit 1`,
  );
  teamId = sql(
    `insert into teams (organization_id, name, team_code, created_by, assessment_type,
                        wellbeing_instrument_key, join_enabled)
     values ('${orgId}','Wellbeing V1 Top Option','WBV1-TOP','${creator}','wellbeing',
             '${INSTRUMENT}',true)
     returning id`,
  );
  inviteToken = sql(`select invite_token from teams where id='${teamId}'`);

  // Read the shape from the database rather than hard-coding it — the point of
  // this suite is that a bound must come from the instrument, not from a
  // number somebody typed.
  topPosition = Number(
    sql(`select max(o.position) from wellbeing_item_options o
           join wellbeing_items i on i.id=o.item_id
           join wellbeing_versions v on v.id=i.version_id
         where v.instrument_key='${INSTRUMENT}' and v.is_active`),
  );
  itemCount = Number(
    sql(`select count(*) from wellbeing_items i join wellbeing_versions v on v.id=i.version_id
         where v.instrument_key='${INSTRUMENT}' and v.is_active`),
  );
});

test.afterAll(() => {
  if (!teamId) return;
  sql(`delete from wellbeing_responses where session_id in
         (select id from wellbeing_sessions where team_id='${teamId}')`);
  sql(`delete from wellbeing_result_dimensions where result_id in
         (select id from wellbeing_results where team_id='${teamId}')`);
  sql(`delete from wellbeing_results where team_id='${teamId}'`);
  sql(`delete from wellbeing_sessions where team_id='${teamId}'`);
  sql(`delete from team_members where team_id='${teamId}'`);
  sql(`delete from teams where id='${teamId}'`);
});

function clearAttempts(): void {
  sql(`delete from wellbeing_responses where session_id in
         (select s.id from wellbeing_sessions s join profiles p on p.id=s.profile_id
          where p.email='${PARTICIPANT}')`);
  sql(`delete from wellbeing_results r using profiles p
         where p.id=r.profile_id and p.email='${PARTICIPANT}'`);
  sql(`delete from wellbeing_sessions s using profiles p
         where p.id=s.profile_id and p.email='${PARTICIPANT}'`);
}

function itemOptions(page: Page) {
  return page.locator('button[aria-pressed][class*="rounded-2xl"]');
}

test("the instrument offers more options than the old GHQ bound allowed", () => {
  // The defect in one line: the schema permitted 0–3, this instrument offers 5.
  expect(topPosition).toBe(4);
  expect(itemCount).toBe(12);
});

test("every item can be answered at the highest option, and it is what gets stored", async ({
  page,
}) => {
  clearAttempts();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(PARTICIPANT);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await submitSignIn(page);
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));

  await page.goto(`/join/${inviteToken}`);
  await page.waitForLoadState("networkidle");
  await page.goto(`/wellbeing?team=${teamId}`);
  const consent = page.getByRole("checkbox").first();
  if (await consent.count()) await consent.check();
  await page.getByRole("button", { name: /Start my Wellbeing Pulse/i }).click();
  await page.waitForURL("**/wellbeing/assessment/**", { timeout: 20_000 });

  const department = page.locator("#wb-department");
  if (await department.count()) {
    await department.selectOption({ index: 1 });
    await page.locator('input[type="radio"][value="field_based"]').first().check();
    await page.getByRole("button", { name: /Continue to the questions/i }).click();
  }
  await expect(itemOptions(page).first()).toBeVisible({ timeout: 20_000 });

  // Answer EVERY item at the top position — the exact value the old bound
  // refused. Driven off observable state, never a fixed delay.
  const finish = page.getByRole("button", { name: /See my result/i });
  for (let guard = 0; guard < itemCount + 4; guard += 1) {
    if ((await finish.count()) > 0 && (await finish.isEnabled())) break;
    const options = itemOptions(page);
    await expect(options.first()).toBeVisible({ timeout: 15_000 });
    const before = await page
      .locator("h2, [data-item-prompt]")
      .first()
      .innerText()
      .catch(() => "");
    await options.nth(topPosition).click();
    await page
      .waitForFunction(
        (previous) => {
          const heading = document.querySelector("h2, [data-item-prompt]");
          const done = [...document.querySelectorAll("button")].some((b) =>
            /see my result/i.test(b.textContent ?? ""),
          );
          return done || (heading?.textContent ?? "") !== previous;
        },
        before,
        { timeout: 15_000 },
      )
      .catch(() => undefined);
  }

  // Before the fix this is unreachable: the first answer was refused, the
  // questionnaire never advanced, and "See my result" never enabled.
  await expect(finish).toBeEnabled({ timeout: 15_000 });
  await finish.click();
  await page.waitForURL("**/wellbeing/result/**", { timeout: 30_000 });

  /* ── every answer was STORED, and stored as the one chosen ────────── */

  const answered = Number(
    sql(`select count(*) from wellbeing_responses r
           join wellbeing_sessions s on s.id=r.session_id
           join profiles p on p.id=s.profile_id
         where p.email='${PARTICIPANT}'`),
  );
  expect(answered, "every item must have been recorded").toBe(itemCount);

  const atTop = Number(
    sql(`select count(*) from wellbeing_responses r
           join wellbeing_sessions s on s.id=r.session_id
           join profiles p on p.id=s.profile_id
         where p.email='${PARTICIPANT}' and r.option_position=${topPosition}`),
  );
  // Not merely accepted — recorded as chosen. A bound that CLAMPED instead of
  // refusing would let the journey finish while silently storing a different
  // answer than the participant gave.
  expect(atTop, "each stored answer must be the top option, not a clamped one").toBe(itemCount);

  /* ── and it scored on the instrument's own scale ──────────────────── */

  const stored = sql(
    `select total_score || '|' || index_score || '|' || instrument_key || '|' ||
            coalesce(threshold_at_completion::text,'null') || '|' ||
            coalesce(at_or_above_threshold::text,'null')
     from wellbeing_results r join profiles p on p.id=r.profile_id
     where p.email='${PARTICIPANT}' order by completed_at desc limit 1`,
  );
  const [raw, index, instrument, threshold, flag] = stored.split("|");
  expect(instrument).toBe(INSTRUMENT);
  // 12 items at 4 points each: the raw maximum, and the index at full scale.
  expect(Number(raw)).toBe(itemCount * topPosition);
  expect(Number(index)).toBe(100);
  // V1 is not validated, so it grades nobody — no threshold, and no flag.
  expect(threshold).toBe("null");
  expect(flag).toBe("null");
});
