import { expect, test } from "@playwright/test";
import { signIn, signOut } from "./helpers";

/**
 * v2.3 navigation rebuild — one screenshot per experience.
 *
 * Each persona is seeded so its experience resolves independently
 * (see supabase/seed.sql): solo → individual, demo → facilitator,
 * coach → coach, admin → super admin. No capture here mutates identity,
 * so these are stable regardless of run order.
 */

const OUT = "docs/screenshots";

test("capture 19: individual navigation", async ({ page }) => {
  await signIn(page, "solo@disc360.dev");
  await expect(page.getByRole("link", { name: "Take Assessment" })).toBeVisible();
  await expect(page.getByRole("link", { name: "My Results" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Team Invitations" })).toBeVisible();
  // An individual must never see team administration.
  await expect(page.getByRole("link", { name: "Participants" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Platform Admin" })).toHaveCount(0);
  await page.locator("header").screenshot({ path: `${OUT}/19-nav-individual.png` });
});

test("capture 20: facilitator navigation", async ({ page }) => {
  await signIn(page, "demo@disc360.dev");
  for (const label of ["Dashboard", "My Teams", "Participants", "Present", "Reports"]) {
    await expect(page.getByRole("link", { name: label }).first()).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Platform Admin" })).toHaveCount(0);
  await page.locator("header").screenshot({ path: `${OUT}/20-nav-facilitator.png` });
});

test("capture 21: coach navigation", async ({ page }) => {
  await signIn(page, "coach@disc360.dev");
  await page.goto("/app/coach");
  for (const label of ["Workspace", "Clients", "Teams", "Presentations", "Coach Profile"]) {
    await expect(page.getByRole("link", { name: label }).first()).toBeVisible();
  }
  // Coach navigation is never mixed with platform administration.
  await expect(page.getByRole("link", { name: "Platform Admin" })).toHaveCount(0);
  await page.locator("header").screenshot({ path: `${OUT}/21-nav-coach.png` });
});

test("capture 22: super-admin navigation", async ({ page }) => {
  await signIn(page, "admin@disc360.dev");
  await page.goto("/admin");
  for (const label of [
    "Overview",
    "Users",
    "Teams",
    "Submissions",
    "Payments",
    "Emails",
    "Reports",
    "Roles",
    "Settings",
  ]) {
    await expect(page.getByRole("link", { name: label, exact: true }).first()).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Return to DISC360" })).toHaveCount(1);
  await page.screenshot({ path: `${OUT}/22-nav-super-admin.png`, fullPage: false });
});

test("capture 23: Platform Admin in the account menu", async ({ page }) => {
  await signIn(page, "admin@disc360.dev");
  await page.getByRole("button", { name: "Account menu" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Platform Admin" })).toBeVisible();
  // Viewport, not the header element: the menu drops below the header and
  // would be cropped out of an element screenshot.
  await page.setViewportSize({ width: 1280, height: 420 });
  await page.screenshot({ path: `${OUT}/23-account-menu-admin.png` });
});

test("capture 24: updated assessment screen (v2 scenarios)", async ({ page }) => {
  test.slow();
  // A fresh account gets a clean first scenario; solo@ has a seeded
  // part-finished session, which would screenshot mid-flow.
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Scenario Shot");
  await page.getByLabel("Email").fill(`pw-shot-${Date.now()}@disc360.dev`);
  await page.getByLabel("Password", { exact: true }).fill("disc360-playwright");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding**");
  await page.getByRole("radio", { name: /Understand myself/i }).click();
  await page.getByLabel("Country").fill("US");
  await page.getByText(/I consent to DISC360 processing/).click();
  await page.getByRole("button", { name: /Continue to your dashboard/i }).click();
  await page.waitForURL("**/app");

  await page.getByRole("button", { name: /Take your assessment/i }).click();
  await page.waitForURL("**/app/assessments/**");
  await expect(page.getByText("Scenario 1 of 24")).toBeVisible();

  // The v2 bank is live: first scenario is the new decision-making prompt.
  await expect(
    page.getByText("When a team must make a difficult decision, I usually:"),
  ).toBeVisible();

  // The scoring mapping never reaches the participant.
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/\b(Dominant|Influence|Stable|Analytical)\b/);

  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/24-assessment-v2.png`, fullPage: true });
  await signOut(page);
});
