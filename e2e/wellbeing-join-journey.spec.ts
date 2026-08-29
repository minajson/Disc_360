import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, submitSignIn } from "./helpers";

/**
 * The printed code, all the way to the check-in — for somebody with no account.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY A JOURNEY TEST AND NOT MORE UNIT TESTS.
 *
 * Every fault this covers was invisible on the page it lived on and obvious
 * one page later:
 *
 *  · `/join/{token}` rendered the DISC join form for a wellbeing campaign,
 *    because the campaign was typed as a DISC team.
 *  · Once that redirected, a FIRST-TIME participant still went
 *    `/wellbeing/join` → `/onboarding` → `redirect("/app")`, landing on the
 *    DISC participant dashboard two screens later.
 *  · Onboarding's required consent asked them to agree to "DISC360 processing
 *    my assessment answers to build my behavioral profile".
 *
 * Each page was individually correct. Only the journey shows the boundary
 * leaking, so the journey is what is asserted here.
 * ─────────────────────────────────────────────────────────────────────
 */

const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = (query: string) =>
  execSync(`psql "${DB}" -t -A -c ${JSON.stringify(query.replace(/\s+/g, " ").trim())}`, {
    encoding: "utf8",
  }).trim();

/**
 * Take the accounts this suite joined back off the wellbeing roster.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT OPTIONAL TIDINESS.
 *
 * These tests deliberately JOIN a campaign — that is the behaviour under test
 * — and a roster membership outlives the run. `solo@disc360.dev` is otherwise
 * an ordinary DISC-side account with no facilitated team, and
 * `authorizeAssessment` binds a participant to the facilitated team running
 * the product they asked for. Leave them on a wellbeing roster and they now
 * have exactly one facilitated team, running the WRONG product, so
 * `/focus/assessment` is denied with `wrong_assessment` and redirects to
 * `/app?notice=...`.
 *
 * The failure lands in `e2e/visualisations.spec.ts`, which never mentions
 * wellbeing, and only on the SECOND run — the first leaves the residue, the
 * next one trips over it. That is the most expensive shape a test defect can
 * have: it looks like a regression in an unrelated feature, and it does not
 * reproduce on a fresh database.
 *
 * So the join is undone. The new signup accounts this suite creates are left
 * alone: they exist only for this suite and belong to no other test.
 * ─────────────────────────────────────────────────────────────────────
 */
function leaveWellbeingRosters(): void {
  sql(`delete from team_members m using profiles p, teams t
        where p.id = m.profile_id and t.id = m.team_id
          and p.email = 'solo@disc360.dev'
          and t.assessment_type = 'wellbeing'`);
}

test.afterAll(leaveWellbeingRosters);

/** Wording that must never appear anywhere on a wellbeing participant's path. */
const DISC_WORDING = [
  /DISC360 assessment/i,
  /24 quick scenarios/i,
  /behavioural profile/i,
  /behavioral profile/i,
  /Employee \/ reference ID/i,
];

async function expectNoDiscWording(page: Page): Promise<void> {
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  for (const pattern of DISC_WORDING) {
    expect(body, `"${pattern}" appeared at ${page.url()}`).not.toMatch(pattern);
  }
  // The DISC dashboard is the destination this whole fix exists to avoid.
  expect(page.url(), "a wellbeing participant reached /app").not.toMatch(/\/app(\/|$|\?)/);
}

/**
 * The seeded wellbeing campaign's join token, or null when the demo fixture is
 * absent.
 *
 * The QR page PRINTS the join URL rather than linking it — it is meant to be
 * read off a projector — so this reads the page text. An earlier version of
 * this helper looked for an `<a href>`, found none, and made every test below
 * skip silently while appearing to pass. A missing fixture is a skip; a
 * campaign whose token cannot be read is a FAILURE, because that means this
 * helper is broken and the suite is only pretending to run.
 */
async function wellbeingToken(page: Page): Promise<string | null> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("demo@disc360.dev");
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await submitSignIn(page);

  await page.goto("/wellbeing/admin/pilot");
  const hrefs = await page
    .locator('a[href^="/wellbeing/admin/campaigns/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  const campaign = hrefs
    .map((href) => href.split("/").pop() ?? "")
    .find((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!campaign) {
    await page.context().clearCookies();
    return null;
  }

  await page.goto(`/wellbeing/admin/campaigns/${campaign}/qr`);
  const text = await page.locator("body").innerText();
  const match = text.match(
    /\/wellbeing\/join\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  expect(
    match,
    `campaign ${campaign} exists but its QR page shows no join URL — this helper is broken, not the fixture`,
  ).not.toBeNull();

  await page.context().clearCookies();
  return match![1]!;
}

test("a first-time participant scans the code and never sees DISC", async ({ page }) => {
  test.slow();
  const token = await wellbeingToken(page);
  test.skip(!token, "no seeded wellbeing campaign — run scripts/seed-wellbeing-demo.sql");

  /* 1 · the printed code IS the wellbeing campaign route, not a DISC link */
  //
  // The QR used to encode `/join/<team invite token>` and rely on DISC's
  // resolver noticing `assessment_type = 'wellbeing'` and redirecting. The
  // campaign now owns its own token and its own route, so the code goes
  // straight there and no DISC surface is involved at any point.
  await page.goto(`/wellbeing/join/${token}`);
  await expect(page.getByRole("heading", { name: "Wellbeing Pulse" })).toBeVisible();
  await expectNoDiscWording(page);

  // It says what is actually being asked, from the campaign's own instrument.
  await expect(page.getByText(/\d+ questions/)).toBeVisible();

  /* 2 · authentication carries the campaign, rather than losing it */
  const email = `pulse-${Date.now()}@atlasdemo.dev`;
  await page.getByRole("link", { name: "Continue with email" }).click();
  await page.waitForURL("**/sign-up**");
  expect(page.url(), "the campaign must ride through sign-up").toContain(
    encodeURIComponent(`/wellbeing/join/${token}`),
  );
  await expectNoDiscWording(page);

  await page.getByLabel("Full name").fill("Pat Participant");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  /* 3 · onboarding, which is shared with DISC and must not read like it */
  await page.waitForURL("**/onboarding**", { timeout: 30_000 });
  expect(page.url(), "the invitation must survive into onboarding").toContain(`join=${token}`);
  await expectNoDiscWording(page);

  await page.getByLabel("Full name").fill("Pat Participant");
  await page.getByLabel("Preferred name").fill("Pat");
  await page.getByLabel("Country").fill("Nigeria");
  await page.getByText(/I consent to DISC360 creating an account/).click();
  await page.getByRole("button", { name: /^Join / }).click();

  /* 4 · and the destination is the campaign, not the DISC dashboard */
  await page.waitForURL(/\/wellbeing(\/|\?)/, { timeout: 30_000 });
  await expectNoDiscWording(page);
  expect(page.url()).not.toMatch(/\/app/);
});

test("an existing participant is returned to the same campaign", async ({ page }) => {
  const token = await wellbeingToken(page);
  test.skip(!token, "no seeded wellbeing campaign — run scripts/seed-wellbeing-demo.sql");

  // solo@ is an ordinary onboarded DISC-side account with no wellbeing history.
  await page.goto(`/sign-in?next=${encodeURIComponent(`/wellbeing/join/${token}`)}`);
  await page.getByLabel("Email").fill("solo@disc360.dev");
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  // Straight to the campaign: already onboarded, so the invitation is not what
  // they need — membership is taken from the token and they go to the pulse.
  await submitSignIn(page, /\/wellbeing(\/|\?)/);
  expect(page.url(), "an existing participant must not be routed to /app").not.toMatch(/\/app/);
  await expectNoDiscWording(page);
});

test("a DISC invitation still renders the DISC journey", async ({ page }) => {
  // The other half of the boundary. The redirect must be conditional on the
  // wellbeing type, never on the absence of something.
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("demo@disc360.dev");
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await submitSignIn(page);

  await page.goto("/app/teams/30000000-0000-4000-8000-000000000002/dashboard");
  const href = await page
    .getByRole("link", { name: "Open participant join page" })
    .getAttribute("href");
  expect(href).toBeTruthy();
  await page.context().clearCookies();

  await page.goto(href!);
  // Still the DISC join form, still on /join/, no wellbeing redirect.
  expect(page.url()).toContain("/join/");
  expect(page.url()).not.toContain("/wellbeing/");
  await expect(page.getByText(/DISC360 assessment/i)).toBeVisible();
});
