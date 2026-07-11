import { expect, test, type Page } from "@playwright/test";

/**
 * Journey smoke tests. Runs against the seeded local Supabase stack:
 *   demo@disc360.dev / disc360-demo — org + team admin (Atlas Collective)
 *   Product Leadership team id 30000000-0000-4000-8000-000000000001
 */

const PRODUCT_TEAM = "30000000-0000-4000-8000-000000000001";

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("disc360-demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app");
}

test("public homepage renders the editorial hero and navigation", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /Understand how people lead, communicate and respond/i,
    }),
  ).toBeVisible();
  const primaryNav = page.getByRole("navigation", { name: "Primary" });
  await expect(primaryNav).toBeVisible();
  await primaryNav.getByRole("link", { name: "Pricing" }).click();
  await expect(page.getByRole("heading", { name: /Free for you/i })).toBeVisible();
});

test("sign-up and individual onboarding reach the dashboard", async ({ page }) => {
  const email = `pw-${Date.now()}@disc360.dev`;
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Play Wright");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("disc360-playwright");
  await page.getByRole("button", { name: "Create account" }).click();

  await page.waitForURL("**/onboarding**");
  await page.getByRole("radio", { name: /Understand myself/i }).click();
  await page.getByLabel("Country").fill("US");
  await page.getByText(/I consent to DISC360 processing/).click();
  await page.getByRole("button", { name: /Continue to your dashboard/i }).click();

  await page.waitForURL("**/app");
  await expect(page.getByRole("heading", { name: /Welcome back, Play/i })).toBeVisible();
});

test("individual assessment completes end to end", async ({ page }) => {
  test.slow();
  const email = `pw-assess-${Date.now()}@disc360.dev`;
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Assess Runner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("disc360-playwright");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding**");
  await page.getByRole("radio", { name: /Understand myself/i }).click();
  await page.getByLabel("Country").fill("US");
  await page.getByText(/I consent to DISC360 processing/).click();
  await page.getByRole("button", { name: /Continue to your dashboard/i }).click();
  await page.waitForURL("**/app");

  await page.getByRole("button", { name: /Take your first assessment/i }).click();
  await page.waitForURL("**/app/assessments/**");

  for (let scenario = 0; scenario < 24; scenario++) {
    await expect(page.getByText(`Scenario ${scenario + 1} of 24`)).toBeVisible();
    const options = page.getByRole("group").getByRole("button");
    await options.first().click(); // MOST
    await options.nth(1).click(); // LEAST (first is disabled now)
    // auto-advance
  }

  await expect(page.getByRole("heading", { name: /Ready to see your profile/i })).toBeVisible();
  await page.getByRole("button", { name: "Submit assessment" }).click();
  await page.waitForURL("**/app/results/**", { timeout: 30_000 });
  await expect(page.getByText(/Your DISC360 profile/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Download PDF/i }).first()).toBeVisible();
});

test("team creation produces a working team space", async ({ page }) => {
  await signIn(page, "demo@disc360.dev");
  await page.goto("/app/teams/new");
  const teamName = `Playwright Guild ${Date.now() % 10_000}`;
  await page.getByLabel("Team name").fill(teamName);
  await page.getByRole("button", { name: "Create team" }).click();
  await page.waitForURL("**/app/teams/**");
  await expect(page.getByRole("heading", { name: teamName })).toBeVisible();
  await expect(page.getByText(/Copy invite link/i)).toBeVisible();
});

test("member invitation lands on the roster with an invitation", async ({ page }) => {
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${PRODUCT_TEAM}/members`);
  const email = `pw-invite-${Date.now()}@atlasdemo.dev`;
  await page.getByLabel("Full name").fill("Invited Person");
  await page.locator("#add-email").fill(email);
  await page.getByRole("button", { name: /Add member & invite/i }).click();
  await expect(page.getByText(/added and invited/i)).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();
});

test("team intelligence dashboard answers the culture questions", async ({ page }) => {
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${PRODUCT_TEAM}/results`);
  await expect(page.getByRole("heading", { name: /What this team is like/i })).toBeVisible();
  await expect(page.getByText(/completed profile/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Recommended actions/i })).toBeVisible();
  // density toggle reveals analytical extras
  await page.getByRole("button", { name: /analytical view/i }).click();
  await expect(page.getByRole("heading", { name: /Completed profiles/i })).toBeVisible();
});

test("presentation mode navigates by keyboard", async ({ page }) => {
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${PRODUCT_TEAM}/presentation`);
  await expect(page.getByText(/Team intelligence briefing/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Product Leadership/i })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText(/^Culture$/i)).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText(/Team intelligence briefing/i)).toBeVisible();
});
