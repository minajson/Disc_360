import { expect, test, type Page } from "@playwright/test";
import { signOut } from "./helpers";

/**
 * Journey smoke tests against the seeded local Supabase stack.
 *   demo@disc360.dev  — team admin (Atlas Collective) with a seeded entitlement
 *   solo@disc360.dev  — free individual with result history
 *   admin@disc360.dev — platform super admin
 * All passwords: disc360-demo
 */

const PRODUCT_TEAM = "30000000-0000-4000-8000-000000000001";

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("disc360-demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app");
}

async function signUpIndividual(page: Page, name: string, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("disc360-playwright");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding**");
  await page.getByRole("radio", { name: /Understand myself/i }).click();
  await page.getByLabel("Country").fill("US");
  await page.getByText(/I consent to DISC360 processing/).click();
  await page.getByRole("button", { name: /Continue to your dashboard/i }).click();
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
  await signUpIndividual(page, "Play Wright", `pw-${Date.now()}@disc360.dev`);
  await expect(page.getByRole("heading", { name: /Welcome back, Play/i })).toBeVisible();
});

test("free individual clicking Create a team lands on the pricing prompt", async ({ page }) => {
  await signUpIndividual(page, "Free Rider", `pw-free-${Date.now()}@disc360.dev`);
  await page.getByRole("link", { name: /Create a team/i }).click();
  await page.waitForURL("**/pricing?intent=create-team**");
  await expect(
    page.getByRole("heading", { name: /Creating a team requires the Team plan/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Buy Team plan/i }).first()).toBeVisible();
});

test("purchasing the team plan unlocks the wizard end to end", async ({ page }) => {
  test.slow();
  await signUpIndividual(page, "Team Buyer", `pw-buyer-${Date.now()}@disc360.dev`);
  await page.goto("/pricing?intent=create-team");
  await page.getByRole("button", { name: /Buy Team plan/i }).first().click();

  // Purchase lands directly in the wizard — never in a second onboarding form.
  await page.waitForURL("**/app/teams/new");
  const teamName = `Playwright Guild ${Date.now() % 10_000}`;

  // Step 1 — team.
  await page.getByLabel("Team name").fill(teamName);
  await page.getByLabel("Organization or company").fill("Playwright Co");
  await page.getByLabel(/Session or event name/).fill("E2E Offsite");
  await page.getByLabel(/Approximate team size/).fill("12");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2 — assessment settings.
  await expect(page.getByLabel("Presentation")).toBeVisible();
  await page.getByLabel("Presentation").selectOption("named");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3 — review shows what was typed once, in step 1.
  const review = page.getByTestId("wizard-review");
  await expect(review).toContainText(teamName);
  await expect(review).toContainText("Playwright Co");
  await expect(review).toContainText("E2E Offsite");
  await expect(review).toContainText("Named results");

  await page.getByRole("button", { name: "Create team" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: teamName })).toBeVisible();
  await expect(page.getByText("Completion")).toBeVisible();
});

test("wizard back-navigation preserves every entered value", async ({ page }) => {
  test.slow();
  await signUpIndividual(page, "Back Tracker", `pw-back-${Date.now()}@disc360.dev`);
  await page.goto("/pricing?intent=create-team");
  await page.getByRole("button", { name: /Buy Team plan/i }).first().click();
  await page.waitForURL("**/app/teams/new");

  const teamName = `Back Nav ${Date.now() % 10_000}`;
  await page.getByLabel("Team name").fill(teamName);
  await page.getByLabel("Organization or company").fill("Reversible Ltd");
  await page.getByLabel(/Department/).fill("Research");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2 → Back → step 1 still holds everything.
  await expect(page.getByLabel("Presentation")).toBeVisible();
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByLabel("Team name")).toHaveValue(teamName);
  await expect(page.getByLabel("Organization or company")).toHaveValue("Reversible Ltd");
  await expect(page.getByLabel(/Department/)).toHaveValue("Research");

  // And a full reload restores from the server draft, not browser memory.
  await page.reload();
  await expect(page.getByLabel("Team name")).toHaveValue(teamName);
  await expect(page.getByLabel("Organization or company")).toHaveValue("Reversible Ltd");
});

test("double-clicking Create team creates exactly one team", async ({ page }) => {
  test.slow();
  const email = `pw-dupe-${Date.now()}@disc360.dev`;
  await signUpIndividual(page, "Dupe Clicker", email);
  await page.goto("/pricing?intent=create-team");
  await page.getByRole("button", { name: /Buy Team plan/i }).first().click();
  await page.waitForURL("**/app/teams/new");

  const teamName = `Dupe Guard ${Date.now() % 10_000}`;
  await page.getByLabel("Team name").fill(teamName);
  await page.getByLabel("Organization or company").fill("Once Only Inc");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Create team" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });

  // Go back and submit the very same draft again — a back button, a stale
  // tab or a double submit all reach the server with the same draft id. The
  // draft's draft→completed transition is the mutex, so the second attempt
  // must be refused rather than create a second team.
  await page.goBack();
  const resubmit = page.getByRole("button", { name: "Create team" });
  if (await resubmit.isVisible().catch(() => false)) {
    await resubmit.click();
    await expect(page.getByRole("alert")).toContainText(/already been created/i);
  }

  // My Teams lists this team exactly once, whatever happened above.
  // (Team names render as spans on this page, not headings.)
  await page.goto("/app/teams");
  await expect(page.getByText(teamName, { exact: true })).toHaveCount(1);
});

test("individual assessment completes end to end", async ({ page }) => {
  test.slow();
  await signUpIndividual(page, "Assess Runner", `pw-assess-${Date.now()}@disc360.dev`);
  await page.getByRole("button", { name: /Take your assessment/i }).click();
  await page.waitForURL("**/app/assessments/**");

  for (let scenario = 0; scenario < 24; scenario++) {
    await expect(page.getByText(`Scenario ${scenario + 1} of 24`)).toBeVisible();
    const options = page.getByRole("group").getByRole("button");
    await options.first().click();
    await options.nth(1).click();
  }

  await expect(page.getByRole("heading", { name: /Ready to see your profile/i })).toBeVisible();
  await page.getByRole("button", { name: "Submit assessment" }).click();
  await page.waitForURL("**/app/results/**", { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /Download PDF/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Email report/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Share$/i })).toBeVisible();
});

test("individual can share their result link", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page, "solo@disc360.dev");
  await page.getByRole("link", { name: "View details" }).first().click();
  await page.waitForURL("**/app/results/**");
  await page.getByRole("button", { name: /^Share$/i }).click();
  await expect(page.getByText(/Share link copied|\/r\//i)).toBeVisible();
});

test("team dashboard shows participants, statuses and completed types", async ({ page }) => {
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${PRODUCT_TEAM}/dashboard`);
  await expect(page.getByText("Completion")).toBeVisible();
  await expect(page.getByText("Amara Okafor")).toBeVisible();
  await expect(page.getByText("The Commander")).toBeVisible();
  await expect(page.getByText(/Completed|Report sent/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Remind pending/i })).toBeVisible();
});

test("team admin can email a participant report and see the status change", async ({ page }) => {
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${PRODUCT_TEAM}/dashboard`);
  const amaraRow = page.getByRole("row").filter({ hasText: "Amara Okafor" });
  await amaraRow.getByRole("button", { name: /Email report|Resend report/i }).click();
  await expect(amaraRow.getByRole("button", { name: /Resend report/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(amaraRow.getByText(/Report sent/i)).toBeVisible();
});

test("presentation dashboard tabs, keyboard and anonymize toggle work", async ({ page }) => {
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${PRODUCT_TEAM}/presentation`);

  // Scope to the visible tabpanel — print export renders every tab hidden.
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByText(/team balance score/i)).toBeVisible();
  await page.getByRole("tab", { name: "Distribution" }).click();
  await expect(panel.getByText(/Primary styles/i)).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(panel.getByText(/Preferred styles/i)).toBeVisible();

  // Named team → presenter can anonymize: real names disappear everywhere
  await page.getByRole("button", { name: /Names on/i }).click();
  await page.getByRole("tab", { name: "Pairings" }).click();
  await expect(panel.getByRole("heading").first()).toBeVisible();
  await expect(panel.getByText(/Amara/)).toHaveCount(0);
  await expect(panel.getByRole("combobox").first()).toContainText("Member A");

  await page.getByRole("tab", { name: "Recommendations" }).click();
  await expect(panel.getByText(/Five team actions/i)).toBeVisible();
});

test("super admin sees the platform overview; others are turned away", async ({ page }) => {
  await signIn(page, "solo@disc360.dev");
  await page.goto("/admin");
  await page.waitForURL("**/app");

  await page.goto("/sign-in").catch(() => undefined);
  // sign out solo by using the app header
  await page.goto("/app");
  await signOut(page);

  await signIn(page, "admin@disc360.dev");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /Platform health/i })).toBeVisible();
  await expect(page.getByText("Total users")).toBeVisible();
  await expect(page.getByText("Total revenue")).toBeVisible();

  await page.goto("/admin/submissions");
  await expect(page.getByRole("heading", { name: /completed assessments/i })).toBeVisible();
});
