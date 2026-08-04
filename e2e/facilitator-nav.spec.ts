import { expect, test, type Locator, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Phase 1 regression: unified comparison navigation and team-only scope.
 *
 * The old two-select "Compare two members" panel is gone; the scalable
 * Compare workspace is the single member-comparison experience, and it is
 * reachable from the facilitator presentation rather than only from the
 * administrator interface.
 */

const TEAM_PRODUCT = "30000000-0000-4000-8000-000000000001";
const TEAM_ENG = "30000000-0000-4000-8000-000000000002";
const TEAM_100 = "30000000-0000-4000-8000-000000000101";
const TEAM_20 = "30000000-0000-4000-8000-000000000102";
const TEAM_5 = "30000000-0000-4000-8000-000000000104";

const FACILITATOR = "demo@disc360.dev";
const SUPER_ADMIN = "admin@disc360.dev";

/** Required facilitator navigation, in order. */
const DECK_TABS = [
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
];

const memberCards = (scope: Page | Locator) =>
  scope.getByRole("img", { name: /^DISC profile — Dominant/ });

/* ── 1–4 · navigation ───────────────────────────────────────────────── */

test("the facilitator deck exposes every section in the required order", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_PRODUCT}/presentation`);

  const tabs = page.getByRole("tablist", { name: "Presentation sections" });
  await expect(tabs.getByRole("tab")).toHaveCount(DECK_TABS.length);
  await expect(tabs.getByRole("tab")).toHaveText(DECK_TABS);
});

test("Compare and AI Insights sit beside Pairings and open from the deck", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_PRODUCT}/presentation`);

  await page.getByRole("tab", { name: "Compare" }).click();
  await expect(page.getByRole("complementary", { name: "Compare members" })).toBeVisible();
  await expect(memberCards(page).first()).toBeVisible();

  await page.getByRole("tab", { name: "AI Insights" }).click();
  await expect(page.getByText("Team snapshot")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("What this may mean").first()).toBeVisible();
});

test("Pairings still renders without the old two-member block", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_PRODUCT}/presentation`);
  await page.getByRole("tab", { name: "Pairings" }).click();

  const panel = page.getByRole("tabpanel", { name: "Pairings" });
  await expect(panel.getByText("Complementary pairings")).toBeVisible();
  await expect(panel.getByText("High-friction pairings")).toBeVisible();
  await expect(panel.getByText("Safe collaboration guidance")).toBeVisible();

  // The removed interface: two selects, a "vs" separator, two radar columns.
  await expect(panel.getByText("Compare two members")).toHaveCount(0);
  await expect(panel.getByLabel("First member")).toHaveCount(0);
  await expect(panel.getByLabel("Second member")).toHaveCount(0);
  await expect(memberCards(panel)).toHaveCount(0);
});

test("team tabs carry Compare and AI Insights for an authorized facilitator", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_PRODUCT}/dashboard`);

  const tabs = page.getByRole("navigation", { name: "Team sections" });
  for (const label of ["Dashboard", "Results", "Executive brief", "Compare", "AI Insights", "Presentation", "Settings"]) {
    await expect(tabs.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
});

/* ── 5 · platform-admin parity ──────────────────────────────────────── */

test("the admin team list offers Open, Brief, Compare and Insights", async ({ page }) => {
  await signIn(page, SUPER_ADMIN);
  await page.goto("/admin/teams");

  const row = page.getByRole("row").filter({ hasText: "Product Leadership" }).first();
  for (const action of ["Open", "Brief", "Compare", "Insights"]) {
    await expect(row.getByRole("link", { name: action, exact: true })).toBeVisible();
  }
  await expect(row.getByRole("button", { name: "Archive" })).toBeVisible();
});

test("a platform admin gets the identical facilitator interface, not a reduced one", async ({
  page,
}) => {
  await signIn(page, SUPER_ADMIN);
  await page.goto(`/app/teams/${TEAM_PRODUCT}/presentation`);

  const tabs = page.getByRole("tablist", { name: "Presentation sections" });
  await expect(tabs.getByRole("tab")).toHaveText(DECK_TABS);

  await page.goto(`/app/teams/${TEAM_PRODUCT}/insights`);
  await expect(page.getByText("Team snapshot")).toBeVisible();
});

/* ── 6–8 · team-only scope ──────────────────────────────────────────── */

test("Compare resolves members from the viewed team alone", async ({ page }) => {
  await signIn(page, FACILITATOR);

  // Product Leadership and Engineering Core hold different people. Each
  // Compare page must show only its own.
  await page.goto(`/app/teams/${TEAM_PRODUCT}/compare`);
  const tray = page.getByRole("complementary", { name: "Compare members" });
  const productNames = await tray.getByRole("checkbox").evaluateAll((boxes) =>
    boxes.map((box) => box.closest("label")?.textContent?.trim() ?? ""),
  );

  await page.goto(`/app/teams/${TEAM_ENG}/compare`);
  const engNames = await tray.getByRole("checkbox").evaluateAll((boxes) =>
    boxes.map((box) => box.closest("label")?.textContent?.trim() ?? ""),
  );

  expect(productNames.length).toBeGreaterThan(0);
  expect(engNames.length).toBeGreaterThan(0);
  const overlap = productNames.filter((name) => engNames.includes(name));
  expect(overlap, `no participant may appear in both teams' comparison: ${overlap.join(", ")}`)
    .toHaveLength(0);
});

test("department comparison lists only the current team's departments", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_100}/insights`);

  // The enterprise cohort's own five departments, and nothing from Atlas.
  for (const department of ["Leadership", "Operations", "Engineering", "Commercial", "People"]) {
    await expect(page.getByText(department, { exact: true }).first()).toBeVisible();
  }
  for (const foreign of ["Go-to-Market", "Product"]) {
    await expect(page.getByText(foreign, { exact: true })).toHaveCount(0);
  }
});

test("a current-team dashboard never aggregates other teams", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_5}/compare`);

  // Cohort 5 has exactly five completed profiles; a leak from the 100-cohort
  // or from Atlas would change this count immediately.
  await expect(memberCards(page)).toHaveCount(5);
  await expect(page.getByText("5 completed · 10 per screen")).toBeVisible();
});

/* ── suppression ────────────────────────────────────────────────────── */

test("departments below the threshold report coverage but no interpretation", async ({
  page,
}) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_20}/insights`);

  // Cohort 20 carries a two-person "Executive" department — under the
  // three-profile suppression threshold.
  const executive = page
    .locator("div")
    .filter({ hasText: /^Executive2 of 2 completed/ })
    .first();
  await expect(page.getByText(/Too little data for a reliable group interpretation/).first())
    .toBeVisible();
  await expect(executive.getByRole("button", { name: /Read this department/ })).toHaveCount(0);

  // A department that clears the threshold still opens.
  await expect(page.getByRole("button", { name: "Read this department" }).first()).toBeVisible();
});

test("insights carry evidence, sample size and a signal strength", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_100}/insights`);

  await expect(page.getByText("Generated from team data")).toBeVisible();
  await expect(page.getByText(/92 of 101 completed/)).toBeVisible();
  await expect(page.getByText("Strong data signal").first()).toBeVisible();

  await page.getByRole("button", { name: "Show evidence and questions" }).first().click();
  await expect(page.getByText("Evidence").first()).toBeVisible();
  await expect(page.getByText("Ask the room").first()).toBeVisible();
  await expect(page.getByText("Based on").first()).toBeVisible();
});

/* ── 20 · readability of the navigation at laptop and projector ─────── */

test("the ten-item deck navigation stays readable and never wraps", async ({ page }) => {
  await signIn(page, FACILITATOR);

  for (const size of [
    { width: 1280, height: 800 }, // 13-inch laptop
    { width: 1920, height: 1080 }, // projector
    { width: 2560, height: 1440 },
  ]) {
    await page.setViewportSize(size);
    await page.goto(`/app/teams/${TEAM_PRODUCT}/presentation`);
    const tab = page.getByRole("tab", { name: "AI Insights" });
    await expect(tab).toBeVisible();

    const font = await tab.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    expect(font, `tab type at ${size.width}px`).toBeGreaterThanOrEqual(14);

    // Labels scroll rather than compress: the words stay on one line.
    const wraps = await tab.evaluate((node) => {
      const style = getComputedStyle(node);
      return style.whiteSpace !== "nowrap";
    });
    expect(wraps, `tab labels must not wrap at ${size.width}px`).toBe(false);

    // The page itself must never scroll sideways.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflows, `horizontal page overflow at ${size.width}px`).toBe(false);
  }
});
