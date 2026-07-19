import { expect, test, type Page } from "@playwright/test";

/**
 * Captures the deliverable screenshots into docs/screenshots/.
 * Run on a freshly seeded database: npx supabase db reset && npx playwright
 * test e2e/screenshots.spec.ts
 */

const PRODUCT_TEAM = "30000000-0000-4000-8000-000000000001";
const OUT = "docs/screenshots";

test.use({ viewport: { width: 1600, height: 1000 } });

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("disc360-demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app");
}

test("capture pricing prompt after Create a team", async ({ page }) => {
  await signIn(page, "solo@disc360.dev");
  await page.goto("/pricing?intent=create-team");
  await expect(
    page.getByRole("heading", { name: /Creating a team requires the Team plan/i }),
  ).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/01-pricing-prompt.png` });
});

test("capture team creation form", async ({ page }) => {
  await signIn(page, "demo@disc360.dev");
  await page.goto("/app/teams/new");
  await expect(page.getByLabel("Team name")).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/02-team-creation-form.png`, fullPage: true });
});

test("capture team admin dashboard and participant table", async ({ page }) => {
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${PRODUCT_TEAM}/dashboard`);
  await expect(page.getByText("Amara Okafor")).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/03-team-admin-dashboard.png` });
  await page
    .getByRole("table")
    .screenshot({ path: `${OUT}/04-participant-table.png` });
});

test("capture interactive presentation dashboard", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${PRODUCT_TEAM}/presentation`);
  await page.getByRole("tab", { name: "Distribution" }).click();
  await expect(page.getByRole("tabpanel").getByText(/Primary styles/i)).toBeVisible();
  // allow chart entrance motion to settle
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/05-presentation-dashboard.png` });
});

test("capture simplified individual dashboard", async ({ page }) => {
  await signIn(page, "solo@disc360.dev");
  await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/06-individual-dashboard.png` });
});

test("capture simplified result report", async ({ page }) => {
  await signIn(page, "solo@disc360.dev");
  await page.getByRole("link", { name: "View details" }).first().click();
  await page.waitForURL("**/app/results/**");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/07-individual-report.png`, fullPage: true });
});

test("capture super-admin overview", async ({ page }) => {
  await signIn(page, "admin@disc360.dev");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /Platform health/i })).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/08-admin-overview.png` });
});
