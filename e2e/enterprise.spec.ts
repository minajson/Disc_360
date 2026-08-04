import { expect, test, type Locator, type Page } from "@playwright/test";
import { signIn, signOut } from "./helpers";

/**
 * Enterprise analytics and comparison acceptance.
 *
 * Two things are being protected here. First, that the existing two-member
 * comparison on the Pairings tab is byte-for-byte the experience it was —
 * the new workspace is additive, not a redesign. Second, that the same card
 * anatomy scales: 5, 10, 20 and 100 participants all render readable sets
 * rather than one unreadable wall.
 *
 * Team ids are the deterministic fixtures from supabase/seed.sql.
 */

const TEAM_PRODUCT = "30000000-0000-4000-8000-000000000001";
const TEAM_100 = "30000000-0000-4000-8000-000000000101";
const TEAM_20 = "30000000-0000-4000-8000-000000000102";
const TEAM_10 = "30000000-0000-4000-8000-000000000103";
const TEAM_5 = "30000000-0000-4000-8000-000000000104";

const FACILITATOR = "demo@disc360.dev";
const SUPER_ADMIN = "admin@disc360.dev";

/** The member cards, identified by the DiscRadarChart each one carries. */
const memberCards = (scope: Page | Locator) =>
  scope.getByRole("img", { name: /^DISC profile — Dominant/ });

/* ── 1 · two members read exactly as the pair they replaced ─────────── */

test("a two-member set keeps the original one-to-one reading", async ({ page }) => {
  // The old Pairings block is gone (see facilitator-nav.spec.ts), but its
  // reading order survives: two columns, and each column teaches you to reach
  // the person opposite rather than themselves.
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_5}/compare`);

  const tray = page.getByRole("complementary", { name: "Compare members" });
  await tray.getByRole("checkbox").nth(0).check();
  await tray.getByRole("checkbox").nth(1).check();
  await tray.getByRole("button", { name: "Compare", exact: true }).click();

  await expect(memberCards(page)).toHaveCount(2);

  const names = await page.getByRole("img", { name: /^DISC profile — Dominant/ })
    .evaluateAll((nodes) =>
      nodes.map((node) => node.closest("div")?.parentElement?.textContent ?? ""),
    );
  expect(names).toHaveLength(2);

  // Cross-referenced guidance: the first column names the second member.
  const reaching = await page.getByText(/^Reaching /).allTextContents();
  expect(reaching).toHaveLength(2);
  expect(reaching[0]).not.toEqual(reaching[1]);
});

/* ── 2 · the same interface at 5, 10, 20 and 100 ────────────────────── */

test("a five-member cohort shows everyone at once", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_5}/compare`);

  await expect(page.getByText(/^Meridian Group — Cohort 5 · 5 members$/)).toBeVisible();
  await expect(memberCards(page)).toHaveCount(5);
  // One set means no batch chrome at all.
  await expect(page.getByRole("button", { name: /^Batch 1/ })).toHaveCount(0);
});

test("a ten-member cohort flows down the board, never sideways", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_10}/compare`);

  await expect(memberCards(page)).toHaveCount(10);
  // The horizontal rail is gone: ten members read as rows, not as a strip
  // the facilitator has to drag through.
  await expect(page.getByText("Scroll sideways for the rest of this set")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Batch 1/ })).toHaveCount(0);
});

test("a twenty-member cohort splits into two batches of ten", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_20}/compare`);

  await expect(page.getByRole("button", { name: /^Batch 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Batch 2/ })).toBeVisible();
  await expect(memberCards(page)).toHaveCount(10);
  await expect(page.getByText("Set 1 of 2")).toBeVisible();

  await page.getByRole("button", { name: /^Batch 2/ }).click();
  await expect(page.getByText("Set 2 of 2")).toBeVisible();
  await expect(memberCards(page)).toHaveCount(10);
});

test("a hundred-participant programme batches into readable sets", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_100}/compare`);

  // 92 completed profiles → ten batches, the last one short.
  await expect(page.getByText(/Set 1 of 10/)).toBeVisible();
  await expect(memberCards(page)).toHaveCount(10);
  await expect(page.getByText("92 completed · 10 per screen")).toBeVisible();

  // Never a hundred cards on one screen.
  await page.getByRole("button", { name: /^Batch 10/ }).click();
  await expect(page.getByText(/Set 10 of 10/)).toBeVisible();
  const lastCount = await memberCards(page).count();
  expect(lastCount).toBeGreaterThan(0);
  expect(lastCount).toBeLessThanOrEqual(10);
});

test("departments become comparison sets on a large programme", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_100}/compare`);

  await page.getByRole("button", { name: "By department" }).click();
  for (const department of ["Leadership", "Operations", "Engineering", "Commercial", "People"]) {
    await expect(page.getByRole("button", { name: new RegExp(`^${department}`) }).first()).toBeVisible();
  }
  await expect(memberCards(page)).toHaveCount(10);
});

/* ── 3 · the comparison tray ────────────────────────────────────────── */

test("the tray searches, selects and renders the chosen members", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_100}/compare`);

  const tray = page.getByRole("complementary", { name: "Compare members" });
  await expect(tray.getByText("0 / 10 selected")).toBeVisible();

  await tray.getByRole("searchbox").fill("Leadership");
  const boxes = tray.getByRole("checkbox");
  await expect(boxes.first()).toBeVisible();

  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await boxes.nth(2).check();
  await expect(tray.getByText("3 / 10 selected")).toBeVisible();

  await tray.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.getByRole("button", { name: "Selected members" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(memberCards(page)).toHaveCount(3);
});

/* ── 4 · presentation-grade team results ────────────────────────────── */

test("the executive brief renders every board section", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_100}/executive`);

  await expect(page.getByText(/Executive brief · Meridian Group/)).toBeVisible();
  for (const heading of [
    "The team at a glance",
    "How evenly the energies are held",
    "Where each person sits",
    "How this team communicates and decides",
    "What it is like to work inside this team",
    "Where this composition will cost you",
    "Generated talking points",
  ]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  await expect(page.getByText("DISC balance index")).toBeVisible();
  await expect(page.getByText("Behaviour distribution")).toBeVisible();
  await expect(page.getByText("Strength distribution")).toBeVisible();

  // Presentation mode is a projection setting on the same document.
  const toggle = page.getByRole("button", { name: "Presentation mode" });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.getByRole("button", { name: "Exit presentation" })).toBeVisible();
});

test("the executive brief renders on a large presentation display", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_20}/executive`);

  await expect(page.getByRole("heading", { name: "The team at a glance" })).toBeVisible();
  // Nothing may overflow the viewport horizontally on a projector.
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflows).toBe(false);
});

/* ── 5 · executive analytics ────────────────────────────────────────── */

test("executive analytics renders for a facilitator's workspace", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.getByRole("link", { name: "Analytics" }).first().click();
  await page.waitForURL("**/app/analytics");

  await expect(page.getByRole("heading", { name: "Organisation intelligence" })).toBeVisible();
  for (const heading of [
    "What leadership needs to know",
    "Coverage across the organisation",
    "How behaviour is distributed",
    "Department, team and business unit",
    "Assessment activity over twelve months",
    "Which behaviour profiles dominate",
    "Every team in scope",
  ]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  await expect(page.getByText("Completion rate")).toBeVisible();
  await expect(page.getByText("High-band population")).toBeVisible();

  // Lazy-loaded charts must actually arrive, not stay as skeletons.
  await expect(page.getByRole("img", { name: /Assessment completions and average/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("table", { name: /Average DISC intensity by department/ })).toBeVisible();

  // Switching the comparison lens re-keys the table and heat map.
  await page.getByRole("button", { name: "Team", exact: true }).click();
  await expect(page.getByText("Team comparison")).toBeVisible();
});

/* ── 6 · platform administrator parity ──────────────────────────────── */

test("a platform admin opens any team and reaches every facilitator view", async ({ page }) => {
  await signIn(page, SUPER_ADMIN);

  // From the admin area, straight into the real product surface.
  await page.goto("/admin/teams");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // A team the platform admin neither created nor belongs to.
  await page.goto(`/app/teams/${TEAM_PRODUCT}/dashboard`);
  await expect(page.getByRole("link", { name: "Present introduction" })).toBeVisible();
  await expect(page.getByText("Completion")).toBeVisible();

  // Every facilitator tab is present and reachable.
  const tabs = page.getByRole("navigation", { name: "Team sections" });
  for (const tab of ["Dashboard", "Results", "Executive brief", "Compare", "Presentation", "Settings"]) {
    await expect(tabs.getByRole("link", { name: tab, exact: true })).toBeVisible();
  }

  await page.goto(`/app/teams/${TEAM_PRODUCT}/executive`);
  await expect(page.getByRole("heading", { name: "The team at a glance" })).toBeVisible();

  await page.goto(`/app/teams/${TEAM_PRODUCT}/compare`);
  await expect(memberCards(page).first()).toBeVisible();

  await page.goto(`/app/teams/${TEAM_PRODUCT}/presentation`);
  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
});

test("a platform admin sees platform-wide analytics in both shells", async ({ page }) => {
  await signIn(page, SUPER_ADMIN);

  await page.goto("/admin/analytics");
  await expect(page.getByRole("heading", { name: "Organisation intelligence" })).toBeVisible();
  await expect(page.getByText(/All \d+ live teams on the platform/)).toBeVisible();

  await page.goto("/app/analytics");
  await expect(page.getByText(/All \d+ live teams on the platform/)).toBeVisible();
});

test("a platform admin's team list is not empty despite holding no memberships", async ({ page }) => {
  await signIn(page, SUPER_ADMIN);
  await page.goto("/app/teams");
  await expect(page.getByText("Meridian Group — Enterprise Program")).toBeVisible();
});

/* ── 7 · a participant never gets the facilitator surfaces ──────────── */

test("a team member without admin rights is denied the facilitator surfaces", async ({
  page,
}) => {
  // Amara is a seeded member of Product Leadership, not its administrator.
  await signIn(page, "amara@atlasdemo.dev");

  await page.goto(`/app/teams/${TEAM_PRODUCT}/compare`);
  await expect(page).toHaveURL(/\/app\/teams\?denied=admin/);

  await page.goto(`/app/teams/${TEAM_PRODUCT}/executive`);
  await expect(page).toHaveURL(/\/app\/teams\?denied=admin/);

  await signOut(page);
});

test("a non-member cannot even see that the team exists", async ({ page }) => {
  await signIn(page, "solo@disc360.dev");

  // The team layout already refuses under RLS — the new routes inherit that,
  // so a stranger gets "not found" rather than a permissions hint.
  await page.goto(`/app/teams/${TEAM_PRODUCT}/compare`);
  await expect(page.getByText("This page isn’t on the map.")).toBeVisible();

  await page.goto(`/app/teams/${TEAM_PRODUCT}/executive`);
  await expect(page.getByText("This page isn’t on the map.")).toBeVisible();

  // Executive analytics for someone who administers nothing is empty, not
  // a window into other people's organisations.
  await page.goto("/app/analytics");
  await expect(page.getByText(/No teams in scope yet/)).toBeVisible();
});
