import { expect, test, type Page } from "@playwright/test";

/**
 * Visual acceptance for the single team-creation journey (Part 11).
 * Each capture is a real screen reached by walking the real flow.
 */

const OUT = "docs/screenshots";

async function signUpFree(page: Page, name: string, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("disc360-playwright");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding**");
  await page.getByRole("radio", { name: /Understand myself/i }).click();
  await page.getByLabel("Country").fill("US");
  await page.getByText(/I consent to DISC360 processing/).click();
  await page.getByRole("button", { name: /Continue to your dashboard/i }).click();
  await page.waitForURL("**/app");
}

test("capture 30: Create Team pricing prompt (no team fields)", async ({ page }) => {
  await signUpFree(page, "Promptly Free", `pw-shot-free-${Date.now()}@disc360.dev`);
  await page.getByRole("link", { name: /Create a team/i }).click();
  await page.waitForURL("**/pricing?intent=create-team**");

  await expect(
    page.getByRole("heading", { name: /Creating a team requires the Team plan/i }),
  ).toBeVisible();
  // Option A: a plan prompt, never a second team form.
  await expect(page.getByLabel("Team name")).toHaveCount(0);
  await expect(page.getByLabel("Organization or company")).toHaveCount(0);

  await page.screenshot({ path: `${OUT}/30-create-team-pricing-prompt.png`, fullPage: true });
});

test("capture 31-34: wizard steps, review, and back-navigation", async ({ page }) => {
  test.slow();
  await signUpFree(page, "Wizard Walker", `pw-shot-wiz-${Date.now()}@disc360.dev`);
  await page.goto("/pricing?intent=create-team");
  await page.getByRole("button", { name: /Buy Team plan/i }).first().click();
  await page.waitForURL("**/app/teams/new");

  // Step 1
  const teamName = "Meridian Launch Team";
  await page.getByLabel("Team name").fill(teamName);
  await page.getByLabel("Organization or company").fill("Northwind Group");
  await page.getByLabel(/Session or event name/).fill("Q4 Kickoff");
  await page.getByLabel(/Department/).fill("Operations");
  await page.getByLabel(/Approximate team size/).fill("14");
  await page.screenshot({ path: `${OUT}/31-wizard-step1-team.png`, fullPage: true });
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2
  await expect(page.getByLabel("Presentation")).toBeVisible();
  await page.getByLabel("Presentation").selectOption("named");
  await page.getByLabel(/Participant limit/).fill("20");
  await page.screenshot({ path: `${OUT}/32-wizard-step2-settings.png`, fullPage: true });
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3 — review
  const review = page.getByTestId("wizard-review");
  await expect(review).toContainText(teamName);
  await expect(review).toContainText("Northwind Group");
  await page.screenshot({ path: `${OUT}/33-wizard-step3-review.png`, fullPage: true });

  // Back twice — every value survives.
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByLabel(/Participant limit/)).toHaveValue("20");
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByLabel("Team name")).toHaveValue(teamName);
  await expect(page.getByLabel("Organization or company")).toHaveValue("Northwind Group");
  await expect(page.getByLabel(/Department/)).toHaveValue("Operations");
  await page.screenshot({ path: `${OUT}/34-wizard-back-preserved.png`, fullPage: true });
});

test("capture 35: team dashboard after creation, with invite actions", async ({ page }) => {
  test.slow();
  await signUpFree(page, "Dash Lander", `pw-shot-dash-${Date.now()}@disc360.dev`);
  await page.goto("/pricing?intent=create-team");
  await page.getByRole("button", { name: /Buy Team plan/i }).first().click();
  await page.waitForURL("**/app/teams/new");

  const teamName = `Atlas Rollout ${Date.now() % 1000}`;
  await page.getByLabel("Team name").fill(teamName);
  await page.getByLabel("Organization or company").fill("Northwind Group");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Create team" }).click();

  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: teamName })).toBeVisible();

  // The dashboard must offer the invite affordances immediately.
  await expect(page.getByRole("button", { name: /Copy join link/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open participant join page/i })).toBeVisible();

  await page.screenshot({ path: `${OUT}/35-team-dashboard-after-create.png`, fullPage: true });
});
