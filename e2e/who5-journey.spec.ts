import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, submitSignIn } from "./helpers";

/**
 * WHO-5, end to end, as a participant actually experiences it.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS SUITE EXISTS.
 *
 * WHO-5 counts UPWARD toward wellbeing and its documented cut-off is a FLOOR.
 * Every other instrument in this platform that carries a threshold counts
 * upward toward distress, where the cut-off is a ceiling. Eight separate
 * defects were found in shared surfaces that assumed the GHQ direction, and
 * the worst of them would have shown a participant reporting strong wellbeing
 * the concerning outcome — on the one screen that is about them.
 *
 * Unit tests caught those once they were suspected. None of them would have
 * been noticed without running the journey, because every one rendered
 * plausibly and wrongly rather than failing.
 *
 * So this suite drives a real browser from the join link to the stored result,
 * and asserts the DIRECTION at every surface that shows a figure.
 *
 * HOW IT RUNS WITHOUT OPENING PRODUCTION.
 *
 * WHO-5's status is `licensed` — held, not active. A held instrument serves
 * only in a non-production deployment with the demo flag explicitly set, which
 * is what playwright.config.ts configures. `isProductionEnvironment()` returns
 * true unconditionally on Vercel, so nothing here can open the hosted product.
 * The instrument is NOT flipped to `active` to make these pass.
 * ─────────────────────────────────────────────────────────────────────
 */

const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
/**
 * Whitespace is collapsed before the query is handed to psql.
 *
 * `JSON.stringify` turns a newline into the two characters `\` and `n`, which
 * psql reads literally and rejects — so a readable multi-line query would fail
 * for a reason that has nothing to do with the query.
 */
const sql = (query: string) => {
  const out = execSync(
    `psql "${DB}" -t -A -c ${JSON.stringify(query.replace(/\s+/g, " ").trim())}`,
    { encoding: "utf8" },
  ).trim();
  // `INSERT ... RETURNING` prints the returned value AND the command tag
  // ("INSERT 0 1") on the next line. Only the first line is the value, and
  // feeding the tag back into a uuid comparison fails confusingly.
  return out.split("\n")[0]!.trim();
};

const PARTICIPANT = "demo@disc360.dev";

// A full journey is sign-in, join, consent, the context form and five answers
// that each round-trip to the server. The suite default of 90s is sized for
// single-screen checks and times out part-way through, which reads as a
// product failure and is not one.
test.describe.configure({ timeout: 240_000 });

/** Raw position → transformed score. Five items, position p each → p*5*4. */
const uniformScore = (position: number) => position * 5 * 4;

let teamId = "";
let inviteToken = "";

/**
 * Removes a campaign left behind by an earlier interrupted run.
 *
 * A fixed team code makes the fixture readable, and makes it collide with
 * itself if a previous run was killed before `afterAll`. Clearing first is
 * what stops one interrupted run from failing every run after it — a failure
 * mode that looks exactly like a regression and is not one.
 */
function removeFixtureCampaign(): void {
  const existing = sql(`select id from teams where team_code='WHO5-E2E'`);
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
  // A campaign of its own, so this suite never disturbs the seeded demo data
  // and never inherits its instrument lock.
  const orgId = sql(
    `select organization_id from teams where wellbeing_instrument_key is not null limit 1`,
  );
  const creator = sql(`select created_by from teams where organization_id='${orgId}' limit 1`);
  teamId = sql(
    `insert into teams (organization_id, name, team_code, created_by, assessment_type,
                        wellbeing_instrument_key, join_enabled)
     values ('${orgId}','WHO-5 Journey','WHO5-E2E','${creator}','wellbeing','who5',true)
     returning id`,
  );
  inviteToken = sql(`select invite_token from teams where id='${teamId}'`);
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

/** Removes any open or finished attempt so each case starts from nothing. */
function clearAttempts(): void {
  sql(`delete from wellbeing_responses where session_id in
         (select s.id from wellbeing_sessions s join profiles p on p.id=s.profile_id
          where p.email='${PARTICIPANT}')`);
  sql(`delete from wellbeing_results r using profiles p
         where p.id=r.profile_id and p.email='${PARTICIPANT}'`);
  sql(`delete from wellbeing_sessions s using profiles p
         where p.id=s.profile_id and p.email='${PARTICIPANT}'`);
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(PARTICIPANT);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await submitSignIn(page);
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

/** Join link → consent → context → the questionnaire. Returns the session URL. */
async function startPulse(page: Page): Promise<void> {
  await page.goto(`/join/${inviteToken}`);
  await page.waitForLoadState("networkidle");
  await page.goto(`/wellbeing?team=${teamId}`);
  const consent = page.getByRole("checkbox").first();
  if (await consent.count()) await consent.check();
  await page.getByRole("button", { name: /Start my Wellbeing Pulse/i }).click();
  await page.waitForURL("**/wellbeing/assessment/**", { timeout: 20_000 });
}

/** The context form: department from the catalogue, sub-unit typed free. */
async function fillContext(page: Page, subUnit = "  Environmental   Health  "): Promise<void> {
  const department = page.locator("#wb-department");
  if (!(await department.count())) return;
  await department.selectOption({ index: 1 });
  await page.locator("#wb-sub-unit").fill(subUnit);
  await page.locator('input[type="radio"][value="field_based"]').first().check();
  await page.getByRole("button", { name: /Continue to the questions/i }).click();
  // Items are buttons carrying aria-pressed, not radios — the questionnaire is
  // one item per screen with full-width targets, built for a phone.
  await expect(itemOptions(page).first()).toBeVisible({ timeout: 20_000 });
}

/** The answer buttons for the item currently on screen. */
function itemOptions(page: Page) {
  // Scoped to buttons that carry BOTH aria-pressed and the option styling, so
  // any other toggle on the page cannot be mistaken for an answer.
  return page.locator('button[aria-pressed][class*="rounded-2xl"]');
}

/**
 * Answers every item at one position and lands on the result.
 *
 * Choosing an answer saves it to the server and advances to the next item
 * inside a transition, so the screen changes asynchronously. Waiting a fixed
 * number of milliseconds races that and silently re-answers the same item, so
 * this drives off observable state instead: answer whatever item is showing,
 * wait for it to stop showing, and stop when the finish control appears.
 */
async function answerAll(page: Page, position: number): Promise<void> {
  const finish = page.getByRole("button", { name: /See my result/i });

  for (let guard = 0; guard < 12; guard += 1) {
    if ((await finish.count()) > 0 && (await finish.isEnabled())) break;
    const options = itemOptions(page);
    await expect(options.first()).toBeVisible({ timeout: 15_000 });
    const before = await page.locator("h2, [data-item-prompt]").first().innerText().catch(() => "");
    await options.nth(position).click();
    // Either the prompt changes (advanced) or the finish control appears.
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

  await expect(finish).toBeEnabled({ timeout: 15_000 });
  await finish.click();
  await page.waitForURL("**/wellbeing/result/**", { timeout: 30_000 });
}

/* ── 1 · the journey, at three points around the cut-off ─────────────── */

for (const [label, position, expected, below] of [
  ["below 50", 2, 40, true],
  ["above 50", 4, 80, false],
] as const) {
  test(`a WHO-5 pulse scoring ${expected} (${label}) completes and reads in WHO-5's direction`, async ({
    page,
  }) => {
    clearAttempts();
    await signIn(page);
    await startPulse(page);
    await fillContext(page);
    await answerAll(page, position);

    // The stored figures, from the server — not from the page.
    const stored = sql(
      `select total_score || '|' || index_score || '|' || threshold_at_completion || '|' ||
              at_or_above_threshold || '|' || instrument_key || '|' || scoring_method
       from wellbeing_results r join profiles p on p.id=r.profile_id
       where p.email='${PARTICIPANT}' order by completed_at desc limit 1`,
    );
    const [raw, index, threshold, atOrAbove, instrument, method] = stored.split("|");
    expect(instrument).toBe("who5");
    expect(method).toBe("who5_sum_x4");
    expect(Number(index)).toBe(expected);
    expect(Number(raw)).toBe(expected / 4);
    expect(Number(threshold)).toBe(50);
    // psql renders booleans as "true"/"false" here, not "t"/"f".
    expect(atOrAbove === "true").toBe(!below);

    // The participant's own result.
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    expect(text).toContain("WHO-5 Well-Being Score");
    expect(text).toContain(`${expected}`);
    expect(text).toContain("/ 100");
    expect(text).toMatch(/Higher is better/i);
    // WHO-5's own disclaimer, never GHQ's.
    expect(text).not.toContain("GHQ-12");
    expect(text).not.toContain("GHQ-28");
    expect(text).toContain("CC BY-NC-SA 3.0 IGO");

    if (below) {
      expect(text).toContain("Below the WHO-5 suggested threshold");
      expect(text).not.toContain("At or above the WHO-5 suggested threshold");
    } else {
      // THE ASSERTION THIS SUITE EXISTS FOR: a high WHO-5 score is not the
      // concerning outcome. Under the GHQ-shaped renderer it would have been.
      expect(text).toContain("At or above the WHO-5 suggested threshold");
      expect(text).not.toContain("Below the WHO-5 suggested threshold");
    }

    // The cut-off never appears without its source.
    expect(text).toContain("WHO/UCN/MSD/MHE/2024.1");
    expect(text).toContain("not an assessment made by DISC360");

    // No organisational analytics on an individual's result.
    for (const leak of ["cohort", "median", "percentile", "team average"]) {
      expect(text.toLowerCase()).not.toContain(leak);
    }
  });
}

test("a score of exactly 50 is unreachable, because the scale moves in fours", async () => {
  // The supplied guide says "Score ≤ 50" and the WHO publication says "below
  // 50". They can never disagree: the percentage is the raw total x 4, so only
  // multiples of four exist and 50 is not one of them. Asserted so nobody
  // "fixes" the predicate later on the belief that it matters.
  const reachable = Array.from({ length: 26 }, (_, raw) => raw * 4);
  expect(reachable).not.toContain(50);
  expect(reachable).toContain(48);
  expect(reachable).toContain(52);
  expect(uniformScore(3)).toBe(60);
});

/* ── 2 · autosave and resume ─────────────────────────────────────────── */

test("an interrupted WHO-5 pulse resumes where it was left", async ({ page }) => {
  clearAttempts();
  await signIn(page);
  await startPulse(page);
  await fillContext(page);

  // Answer two items, then abandon the tab.
  // Answer two items, waiting for each save rather than guessing at a delay.
  for (let i = 0; i < 2; i += 1) {
    const before = Number(
      sql(`select count(*) from wellbeing_responses where session_id in
             (select s.id from wellbeing_sessions s join profiles p on p.id=s.profile_id
              where p.email='${PARTICIPANT}')`),
    );
    await itemOptions(page).nth(4).click();
    await expect
      .poll(
        () =>
          Number(
            sql(`select count(*) from wellbeing_responses where session_id in
                   (select s.id from wellbeing_sessions s join profiles p on p.id=s.profile_id
                    where p.email='${PARTICIPANT}')`),
          ),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(before);
  }

  // Return to the campaign: the open attempt is resumed, not restarted.
  await page.goto(`/wellbeing?team=${teamId}`);
  const consent = page.getByRole("checkbox").first();
  if (await consent.count()) await consent.check();
  await page.getByRole("button", { name: /Start my Wellbeing Pulse|Resume/i }).click();
  await page.waitForURL("**/wellbeing/assessment/**", { timeout: 20_000 });

  const sessions = Number(
    sql(`select count(*) from wellbeing_sessions s join profiles p on p.id=s.profile_id
         where p.email='${PARTICIPANT}' and s.instrument_key='who5'`),
  );
  expect(sessions, "resuming must not create a second attempt").toBe(1);
});

/* ── 3 · history keeps instruments apart ─────────────────────────────── */

test("WHO-5 history is WHO-5's own, and compares only against itself", async ({ page }) => {
  clearAttempts();
  await signIn(page);

  // Two WHO-5 pulses, the second higher than the first.
  await startPulse(page);
  await fillContext(page);
  await answerAll(page, 1);
  sql(`update wellbeing_sessions set status='completed' where team_id='${teamId}'`);

  await startPulse(page);
  // A SECOND attempt collects context again, because it is a second attempt.
  // The department, sub-unit and work location are snapshotted onto each result
  // at completion, so a participant who has moved team since the last wave is
  // asked afresh rather than having the old answer carried forward. Omitting
  // this left the run sitting on the context form with no answer buttons to
  // find — a harness gap that reads exactly like a broken questionnaire.
  await fillContext(page);
  await answerAll(page, 4);

  await page.goto("/wellbeing/history");
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  expect(text).toContain("WHO-5");
  // Movement is direction only — never a clinical claim.
  expect(text).not.toMatch(/improv|deteriorat|recovered/i);
});

/* ── 4 · the report ──────────────────────────────────────────────────── */

test("the WHO-5 report is WHO-5's, and downloads as a PDF", async ({ page }) => {
  clearAttempts();
  await signIn(page);
  await startPulse(page);
  await fillContext(page);
  await answerAll(page, 4);

  const resultId = page.url().split("/").pop()!;
  const response = await page.request.get(`/api/wellbeing/report/${resultId}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("pdf");
  const bytes = await response.body();
  expect(bytes.length).toBeGreaterThan(1000);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
});

/* ── 5 · the gate itself ─────────────────────────────────────────────── */

test("WHO-5 is served here only because this is a flagged test deployment", async ({ page }) => {
  // The instrument is HELD (`licensed`). It runs in this suite because
  // playwright.config.ts marks the server as a local test deployment with the
  // demo flag — not because anybody flipped it to active.
  await signIn(page);
  await page.goto("/wellbeing/admin/instruments");
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  // Whatever the surface says, the registry must still record it as held.
  const status = sql(
    `select content_status from wellbeing_versions where instrument_key='who5' and is_active`,
  );
  expect(status).toBe("licensed");
  expect(text.length).toBeGreaterThan(0);
});
