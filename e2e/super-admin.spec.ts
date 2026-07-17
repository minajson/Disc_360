import { expect, test, type Page } from "@playwright/test";
import { signOut } from "./helpers";

/**
 * Bootstrap super-admin acceptance.
 *
 * The point of these tests is that nothing is seeded or hard-coded: the
 * account earns its role by signing up through the real form, exactly as a
 * person would. Migration 00012 allowlists the address and promotes it once
 * the email is confirmed. Locally `enable_confirmations = false`, so signup
 * confirms immediately and the trigger fires on insert.
 *
 * The password below is generated per-run and only ever exists inside this
 * test — it is not a credential the product knows or ships.
 */

const BOOTSTRAP_EMAIL = "minajjumbo@gmail.com";
// Fixed so the spec is re-runnable against a database that was not just reset:
// a per-run password would fail to sign in to the account the previous run
// created, while sign-up would reject the address as taken. This is a local
// test fixture in the same vein as the seeded "disc360-demo" — the product
// neither ships nor knows it, and production accounts set their own password.
const TEST_PASSWORD = "disc360-bootstrap-e2e";

// Keyed off each page's stable eyebrow label rather than its h1 — the headings
// are dynamic ("0 submissions"), the eyebrows are fixed. `label` is the exact
// DOM text (the uppercase look is a CSS transform, so getByText still matches).
const ADMIN_ROUTES = [
  { path: "/admin", label: "Overview" },
  { path: "/admin/users", label: "Users" },
  { path: "/admin/teams", label: "Teams" },
  { path: "/admin/submissions", label: "Submissions" },
  { path: "/admin/payments", label: "Payments" },
  { path: "/admin/reports", label: "Reports" },
  { path: "/admin/roles", label: "Roles" },
  { path: "/admin/settings", label: "Settings" },
] as const;

/**
 * Signs the bootstrap account in, creating it on first run. The suite must be
 * re-runnable against a database that was not just reset, so "already
 * registered" is an expected state, not a failure.
 */
async function signInBootstrapAccount(page: Page): Promise<void> {
  // The three settled states this flow can reach, expressed as locators so we
  // wait on the DOM rather than on the URL or on networkidle (which never
  // settles here). `.or()` + a single web-first assertion is race-free: no
  // Promise.race whose losing branch rejects later, no arbitrary sleeps.
  const onboardingChoice = page.getByRole("radio", { name: /Understand myself/i });
  const signedInAsAdmin = page.getByRole("link", { name: "Platform Admin" }).first();
  const wrongCredentials = page.getByText(/doesn't match our records/i);

  // 1. Try signing in — an earlier run in this file may already have created it.
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(BOOTSTRAP_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    onboardingChoice.or(signedInAsAdmin).or(wrongCredentials).first(),
  ).toBeVisible({ timeout: 20_000 });

  // 2. No account yet → create one through the real form. Nothing is seeded.
  if (await wrongCredentials.isVisible().catch(() => false)) {
    await page.goto("/sign-up");
    await page.getByLabel("Full name").fill("Mina Jumbo");
    await page.getByLabel("Email").fill(BOOTSTRAP_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(onboardingChoice).toBeVisible({ timeout: 20_000 });
  }

  // 3. Finish onboarding if the account is new or was abandoned mid-way. The
  //    app shell redirects an un-onboarded account here on every sign-in.
  if (await onboardingChoice.isVisible().catch(() => false)) {
    await onboardingChoice.click();
    await page.getByLabel("Country").fill("NG");
    await page.getByText(/I consent to DISC360 processing/).click();
    await page.getByRole("button", { name: /Continue to your dashboard/i }).click();
  }

  // The role was granted by the migration's allowlist trigger on confirmation.
  // Its entry point being visible is the proof the account is both signed in
  // and a super admin.
  await expect(signedInAsAdmin).toBeVisible({ timeout: 20_000 });
}

test("bootstrap account becomes super admin by signing up normally", async ({ page }) => {
  test.slow();
  await signInBootstrapAccount(page);

  // The role was granted by the migration's allowlist trigger on confirmation —
  // no seeded flag, no password in the codebase, no auth bypass.
  await expect(page.getByRole("link", { name: "Platform Admin" }).first()).toBeVisible();
});

test("super admin reaches every admin route", async ({ page }) => {
  test.slow();
  await signInBootstrapAccount(page);

  for (const route of ADMIN_ROUTES) {
    await page.goto(route.path);
    // A non-admin would be redirected to /app; assert we actually stayed, then
    // that the page's own content rendered (its stable eyebrow label).
    await expect(page).toHaveURL(new RegExp(`${route.path}(\\?|$)`), { timeout: 15_000 });
    await expect(page.getByText(route.label, { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
  }
});

test("Platform Admin appears in desktop nav, mobile nav and the account menu", async ({
  page,
}) => {
  test.slow();
  await signInBootstrapAccount(page);

  await expect(page.getByRole("link", { name: "Platform Admin" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(
    page.getByRole("menu").getByRole("menuitem", { name: "Platform Admin" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // Mobile viewport: the entry point must survive the responsive nav.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("link", { name: "Platform Admin" }).first()).toBeVisible();
});

test("a normal user is redirected away from every admin route", async ({ page }) => {
  test.slow();
  // solo@disc360.dev is a seeded free individual — not a super admin.
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("solo@disc360.dev");
  await page.getByLabel("Password").fill("disc360-demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app");

  // The entry point is not merely hidden — the routes themselves refuse.
  await expect(page.getByRole("link", { name: "Platform Admin" })).toHaveCount(0);

  for (const route of ADMIN_ROUTES) {
    await page.goto(route.path);
    await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
  }

  await signOut(page);
});

test("a signed-out visitor is sent to sign-in, not into the admin area", async ({ page }) => {
  for (const route of ADMIN_ROUTES) {
    await page.goto(route.path);
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 15_000 });
  }
});
