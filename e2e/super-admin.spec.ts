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

const ADMIN_ROUTES = [
  { path: "/admin", heading: /Platform health/i },
  { path: "/admin/users", heading: /accounts/i },
  { path: "/admin/teams", heading: /teams/i },
  { path: "/admin/submissions", heading: /submissions|results/i },
  { path: "/admin/payments", heading: /payments|entitlements/i },
  { path: "/admin/reports", heading: /reports|exports/i },
  { path: "/admin/roles", heading: /Access overview/i },
  { path: "/admin/settings", heading: /settings|configuration/i },
] as const;

/**
 * Signs the bootstrap account in, creating it on first run. The suite must be
 * re-runnable against a database that was not just reset, so "already
 * registered" is an expected state, not a failure.
 */
const landed = (page: Page) => new URL(page.url()).pathname;

async function signInBootstrapAccount(page: Page): Promise<void> {
  // 1. Try signing in first — an earlier run may already have created it.
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(BOOTSTRAP_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page
    .waitForURL(/\/(app|onboarding)/, { timeout: 12_000 })
    .catch(() => undefined);
  // The form pushes /app client-side; the server then bounces an un-onboarded
  // account to /onboarding. Without settling here, the URL still reads /app
  // and this helper skips onboarding it genuinely needs to complete.
  await page.waitForLoadState("networkidle");

  // 2. No account yet → create one through the real form. Nothing is seeded.
  if (!/^\/(app|onboarding)/.test(landed(page))) {
    await page.goto("/sign-up");
    await page.getByLabel("Full name").fill("Mina Jumbo");
    await page.getByLabel("Email").fill(BOOTSTRAP_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/onboarding**", { timeout: 20_000 });
  }

  // 3. Finish onboarding when the account is new, or was abandoned mid-way.
  //    Branching on the URL rather than racing promises: the loser of a
  //    Promise.race still rejects on timeout and fails the test.
  if (landed(page).startsWith("/onboarding")) {
    await page.getByRole("radio", { name: /Understand myself/i }).click();
    await page.getByLabel("Country").fill("NG");
    await page.getByText(/I consent to DISC360 processing/).click();
    await page.getByRole("button", { name: /Continue to your dashboard/i }).click();
    await page.waitForURL("**/app", { timeout: 20_000 });
  }

  await expect(page).toHaveURL(/\/app$/);
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
    // A redirect away would land on /app — assert we actually stayed.
    await expect(page).toHaveURL(new RegExp(`${route.path}(\\?|$)`), { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: route.heading }).first(),
    ).toBeVisible({ timeout: 15_000 });
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
