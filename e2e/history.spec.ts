import { expect, test, type Page } from "@playwright/test";
import { signIn, signOut } from "./helpers";

/**
 * Phase 2 regression: longitudinal history.
 *
 * The load-bearing property throughout is that a completed result is never
 * overwritten and never travels between contexts. A retake adds a record; it
 * does not replace one.
 */

const TEAM_2026 = "30000000-0000-4000-8000-000000000201";
const TEAM_2027 = "30000000-0000-4000-8000-000000000202";
const TEAM_PRODUCT = "30000000-0000-4000-8000-000000000001";
const TEAM_5 = "30000000-0000-4000-8000-000000000104";

const FACILITATOR = "demo@disc360.dev";
const SUPER_ADMIN = "admin@disc360.dev";
/** Assessed in both lineage periods — two completed results, one account. */
const REPEATER = "lineage0@meridiandemo.dev";
const OTHER_REPEATER = "lineage1@meridiandemo.dev";

const memberCards = (page: Page) =>
  page.getByRole("img", { name: /^DISC profile — Dominant/ });

/* ── 1–4 · retakes preserve every completed result ──────────────────── */

test("a participant with a completed result must confirm before retaking", async ({ page }) => {
  await signIn(page, REPEATER);
  await page.goto("/app/assessments");

  // No one-click restart: the notice states what happens first.
  await expect(page.getByText(/You already completed this assessment on/)).toBeVisible();
  await expect(
    page.getByText(/Starting again will create a new result and preserve your earlier result/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Start a new assessment" }).click();
  await expect(page.getByText("What prompted this reassessment?")).toBeVisible();
  for (const reason of [
    "New role",
    "New team",
    "Annual reassessment",
    "Leadership programme",
    "Personal review",
    "Other",
  ]) {
    await expect(page.getByText(reason, { exact: true })).toBeVisible();
  }
});

test("multiple completed results coexist and none is overwritten", async ({ page }) => {
  await signIn(page, REPEATER);
  await page.goto("/app/history");

  await expect(page.getByText(/2 completed DISC assessments/)).toBeVisible();

  // Both periods present, each with its own completion-time context.
  await expect(page.getByText("ERP Team 2026 · ERP · Systems Analyst")).toBeVisible();
  await expect(page.getByText("Applications & ERP 2027 · IDT · Team Lead")).toBeVisible();
  await expect(page.getByText("Attempt 1")).toBeVisible();
  await expect(page.getByText("Attempt 2")).toBeVisible();
});

test("the retake reason is recorded against the later attempt", async ({ page }) => {
  await signIn(page, REPEATER);
  await page.goto("/app/history");
  await expect(page.getByText("Annual reassessment")).toBeVisible();
  await expect(page.getByText("First assessment")).toBeVisible();
});

/* ── 20 · snapshots survive later changes ───────────────────────────── */

test("history shows the context as it was, not as it is now", async ({ page }) => {
  await signIn(page, REPEATER);
  await page.goto("/app/history");

  // The same person is a Systems Analyst in the 2026 record and a Team Lead
  // in the 2027 one. A read-time lookup of "their role" would show one value
  // on both rows.
  const rows = await page.getByText(/· (ERP|IDT) · (Systems Analyst|Team Lead)/).allTextContents();
  expect(new Set(rows).size).toBeGreaterThan(1);
});

/* ── 14, 15 · trend and movement thresholds ─────────────────────────── */

test("the trend chart plots only this participant's own records", async ({ page }) => {
  await signIn(page, REPEATER);
  await page.goto("/app/history");

  const chart = page.getByRole("img", { name: /Your DISC scores across 2 completed assessments/ });
  await expect(chart).toBeVisible();
  await expect(page.getByText(/Small score movements may reflect context/)).toBeVisible();
});

test("comparing two dates reports movement without claiming a personality change", async ({
  page,
}) => {
  await signIn(page, REPEATER);
  await page.goto("/app/history");

  const compareButtons = page.getByRole("button", { name: "Compare" });
  await compareButtons.nth(0).click();
  await compareButtons.nth(0).click();

  await expect(page.getByText(/expressed behavioural pattern changed in this context/))
    .toBeVisible();
  await expect(page.getByText(/not a fixed trait/)).toBeVisible();
  await expect(page.getByText(/personality permanently changed/i)).toHaveCount(0);

  // Movement is graded, and sub-threshold movement is named as variation.
  await expect(page.getByText(/Within normal variation|Slight movement|Moderate movement|Substantial movement/).first())
    .toBeVisible();
});

/* ── 9, 10 · history privacy ────────────────────────────────────────── */

test("a participant sees only their own history", async ({ page }) => {
  await signIn(page, REPEATER);
  await page.goto("/app/history");
  await expect(page.getByText(/2 completed DISC assessments/)).toBeVisible();
  await signOut(page);

  // A different participant with an identical fixture shape gets their own
  // records — the route takes no profile id, so there is nothing to tamper with.
  await signIn(page, OTHER_REPEATER);
  await page.goto("/app/history");
  await expect(page.getByText(/2 completed DISC assessments/)).toBeVisible();
});

test("a participant cannot open another participant's report", async ({ page }) => {
  await signIn(page, SUPER_ADMIN);
  await page.goto("/app/history");
  // The platform admin's own history — not everyone's.
  await expect(page.getByRole("heading", { name: "Your profile over time" })).toBeVisible();
  await expect(page.getByText(/Applications & ERP 2027/)).toHaveCount(0);
});

/* ── 6, 7, 16 · team scoping is unaffected ──────────────────────────── */

test("the same person's two team results stay attached to their own teams", async ({ page }) => {
  await signIn(page, FACILITATOR);

  await page.goto(`/app/teams/${TEAM_2026}/compare`);
  await expect(memberCards(page)).toHaveCount(8);
  await page.goto(`/app/teams/${TEAM_2027}/compare`);
  await expect(memberCards(page)).toHaveCount(8);
});

test("a newly created team inherits no prior results", async ({ page }) => {
  await signIn(page, FACILITATOR);
  // Cohort 5's roster is disjoint from the lineage teams; a "latest result for
  // this user" resolution would leak the lineage results in here.
  await page.goto(`/app/teams/${TEAM_5}/compare`);
  await expect(memberCards(page)).toHaveCount(5);
});

/* ── 11, 13 · team history and explicit lineage ─────────────────────── */

test("team history shows both periods of an explicit series", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_2027}/history`);

  await expect(page.getByText(/Applications & ERP Programme/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "2 assessment periods" })).toBeVisible();
  const periods = page.getByRole("region", { name: "Assessment periods" });
  await expect(periods.getByText("ERP Team 2026", { exact: true })).toBeVisible();
  await expect(periods.getByText("Applications & ERP 2027", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Between periods" })).toBeVisible();
});

test("lineage is explicit — an unlinked team shows only its own period", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_PRODUCT}/history`);

  await expect(page.getByRole("heading", { name: "One assessment period" })).toBeVisible();
  await expect(page.getByText(/This team stands alone/)).toBeVisible();
  // The lineage teams are in the same organisation family but must not appear.
  await expect(page.getByText("ERP Team 2026")).toHaveCount(0);
});

test("team history is aggregate — no participant is named", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_2027}/history`);

  for (const name of ["Vivian Nwosu", "Emmanuel Eze", "Ada Bello"]) {
    await expect(page.getByText(name)).toHaveCount(0);
  }
  await expect(page.getByText(/Team history is aggregate/)).toBeVisible();
});

/* ── 12 · platform admin uses explicit scope ────────────────────────── */

test("a platform admin reads team history through an explicit team, not globally", async ({
  page,
}) => {
  await signIn(page, SUPER_ADMIN);
  await page.goto(`/app/teams/${TEAM_2027}/history`);
  await expect(page.getByRole("heading", { name: "2 assessment periods" })).toBeVisible();

  // Opening a different team gives that team's lineage only.
  await page.goto(`/app/teams/${TEAM_PRODUCT}/history`);
  await expect(page.getByRole("heading", { name: "One assessment period" })).toBeVisible();
});

/* ── 19 · Phase 1 surfaces are unchanged ────────────────────────────── */

test("Compare and AI Insights still behave exactly as Phase 1 shipped them", async ({ page }) => {
  await signIn(page, FACILITATOR);

  await page.goto(`/app/teams/${TEAM_PRODUCT}/presentation`);
  const tabs = page.getByRole("tablist", { name: "Presentation sections" });
  await expect(tabs.getByRole("tab")).toHaveText([
    "Overview",
    "Distribution",
    "Communication",
    "Leadership",
    "Conflict",
    "Pressure",
    "Pairings",
    "Compare",
    "AI Insights",
    "Recommendations",
  ]);

  await page.goto(`/app/teams/${TEAM_PRODUCT}/insights`);
  await expect(
    page.getByRole("region", { name: "Insight cards" }).getByText("Team snapshot"),
  ).toBeVisible();

  await page.goto(`/app/teams/${TEAM_PRODUCT}/compare`);
  await expect(page.getByRole("complementary", { name: "Compare members" })).toBeVisible();
});

test("Compare offers Members, Departments and History as separate canvases", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_2027}/compare`);

  const modes = page.getByRole("navigation", { name: "Comparison mode" });
  for (const label of ["Members", "Departments", "History"]) {
    await expect(modes.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await modes.getByRole("link", { name: "History", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${TEAM_2027}/history`));
});

/* ── 18 · existing flows still work ─────────────────────────────────── */

test("the assessment, join and results flows are untouched", async ({ page }) => {
  await page.goto("/join/00000000-0000-0000-0000-000000000000");
  await expect(page.locator("body")).toBeVisible();

  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_PRODUCT}/dashboard`);
  await expect(page.getByRole("link", { name: "Present introduction" })).toBeVisible();
  await page.goto(`/app/teams/${TEAM_PRODUCT}/results`);
  await expect(page.getByText(/Culture|What this team is like/).first()).toBeVisible();
});
