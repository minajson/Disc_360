import { expect, test, type Page } from "@playwright/test";
import { signOut } from "./helpers";

/**
 * QR / join-link acceptance tests (spec A–C).
 * Uses the seeded Engineering Core (ATLAS-1002) and Go-to-Market
 * (ATLAS-1003) teams; tokens are fetched via the join page redirects the
 * admin UI exposes — here we read them through the admin dashboard link.
 */

const ENG_TEAM = "30000000-0000-4000-8000-000000000002";
const GTM_TEAM = "30000000-0000-4000-8000-000000000003";

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("disc360-demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app");
}

/** Reads a team's join URL from its dashboard invite panel (as an admin). */
async function getJoinUrl(page: Page, teamId: string): Promise<string> {
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${teamId}/dashboard`);
  const link = page.getByRole("link", { name: "Open participant join page" });
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  await signOut(page);
  return href!;
}

test("A: QR join — register, assess, appear once on the dashboard", async ({ page }) => {
  test.slow();
  const joinUrl = await getJoinUrl(page, ENG_TEAM);

  // C: shared payload never contains localhost when a public URL is set —
  // in dev it may, but the UI must then show the explicit warning.
  if (/localhost|127\.0\.0\.1/.test(joinUrl)) {
    await signIn(page, "demo@disc360.dev");
    await page.goto(`/app/teams/${ENG_TEAM}/dashboard`);
    await expect(page.getByText(/Local development only/i)).toBeVisible();
    await signOut(page);
  }

  const email = `qr-${Date.now()}@atlasdemo.dev`;
  await page.goto(joinUrl);
  await expect(page.getByText("Engineering Core")).toBeVisible();
  await page.getByLabel("Full name").fill("Quinn Scanner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Job title (optional)").fill("Platform Engineer");
  await page.getByText(/I consent to DISC360 processing/).click();
  await page.getByRole("button", { name: /Join team and start assessment/ }).click();

  await page.waitForURL("**/app/assessments/**", { timeout: 20_000 });
  for (let scenario = 0; scenario < 24; scenario++) {
    await expect(page.getByText(`Scenario ${scenario + 1} of 24`)).toBeVisible();
    const options = page.getByRole("group").getByRole("button");
    await options.first().click();
    await options.nth(1).click();
  }
  await page.getByRole("button", { name: "Submit assessment" }).click();
  await page.waitForURL("**/app/results/**", { timeout: 30_000 });

  // Dashboard reflects the new participant exactly once, completed with a type.
  await signOut(page);
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${ENG_TEAM}/dashboard`);
  const row = page.getByRole("row").filter({ hasText: email });
  await expect(row).toHaveCount(1);
  await expect(row.getByText(/Completed|Report sent/)).toBeVisible();
});

test("B: team isolation — joining Alpha never attaches Beta", async ({ page }) => {
  const joinUrl = await getJoinUrl(page, ENG_TEAM);
  const email = `iso-${Date.now()}@atlasdemo.dev`;

  await page.goto(joinUrl);
  await page.getByLabel("Full name").fill("Iso Later");
  await page.getByLabel("Email address").fill(email);
  await page.getByText(/I consent to DISC360 processing/).click();
  await page.getByRole("button", { name: /Join team and start assessment/ }).click();
  await page.waitForURL("**/app/assessments/**", { timeout: 20_000 });

  await page.goto("/app");
  await signOut(page);

  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${ENG_TEAM}/dashboard`);
  await expect(page.getByText(email)).toBeVisible();
  await page.goto(`/app/teams/${GTM_TEAM}/dashboard`);
  await expect(page.getByText(email)).toHaveCount(0);
});

test("C: existing accounts are never auto-logged-in from the join form", async ({ page }) => {
  const joinUrl = await getJoinUrl(page, ENG_TEAM);
  await page.goto(joinUrl);
  await page.getByLabel("Full name").fill("Sam Okonkwo");
  await page.getByLabel("Email address").fill("solo@disc360.dev");
  await page.getByText(/I consent to DISC360 processing/).click();
  await page.getByRole("button", { name: /Join team and start assessment/ }).click();
  await expect(page.getByText(/An account already exists/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Sign in to join this team/i })).toBeVisible();
  // Still signed out.
  await page.goto("/app");
  await page.waitForURL("**/sign-in**");
});
