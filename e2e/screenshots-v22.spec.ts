import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { signOut } from "./helpers";

/**
 * v2.2 deliverable screenshots (09–18) into docs/screenshots/.
 * Run on a freshly seeded database after the main suites.
 */

const PRODUCT_TEAM = "30000000-0000-4000-8000-000000000001";
const ENG_TEAM = "30000000-0000-4000-8000-000000000002";
const DEMO_USER = "10000000-0000-4000-8000-000000000001";
const OUT = "docs/screenshots";
const PHOTO_FIXTURE = path.join(__dirname, "fixtures", "coach-photo.png");

test.use({ viewport: { width: 1600, height: 1000 } });

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("disc360-demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app");
}

/** Join URL for a team, read from its dashboard invite panel. */
async function getJoinUrl(page: Page, teamId: string): Promise<string> {
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${teamId}/dashboard`);
  const href = await page
    .getByRole("link", { name: "Open participant join page" })
    .getAttribute("href");
  expect(href).toBeTruthy();
  await signOut(page);
  return href!;
}

test("capture 09: team dashboard invite/QR panel", async ({ page }) => {
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${PRODUCT_TEAM}/dashboard`);
  const panel = page.getByRole("region", { name: /Invite participants/i });
  await expect(panel.getByRole("link", { name: "Open participant join page" })).toBeVisible();
  await panel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await panel.screenshot({ path: `${OUT}/09-team-invite-panel.png` });
});

test("capture 10: presentation join QR overlay", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${PRODUCT_TEAM}/presentation`);
  await page.getByRole("button", { name: "Join QR" }).click();
  await expect(page.getByText(/Scan to join/i)).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/10-presentation-join-qr.png` });
});

test("capture 11+12: participant join page and registration form", async ({ page }) => {
  const joinUrl = await getJoinUrl(page, ENG_TEAM);
  await page.goto(joinUrl);
  await expect(page.getByText("Engineering Core")).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/11-join-page.png`, fullPage: true });

  await page.getByLabel("Full name").fill("Jordan Participant");
  await page.getByLabel("Email address").fill("jordan@example.com");
  await page.getByLabel("Job title (optional)").fill("Design Lead");
  await page.getByLabel("Department (optional)").fill("Product Design");
  const form = page.locator("form", {
    has: page.getByRole("button", { name: /Join team and start assessment/ }),
  });
  await form.screenshot({ path: `${OUT}/12-join-registration-form.png` });
});

test("capture 13+14: coach profile setup, then with uploaded photo", async ({ page }) => {
  test.slow();
  // The seeded coach persona — never demo@, whose experience is facilitator.
  await signIn(page, "coach@disc360.dev");
  await page.goto("/app/coach/profile");
  await expect(page.getByLabel("Professional title")).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/13-coach-profile-setup.png`, fullPage: true });

  // Upload the fixture photo unless one is already stored.
  const identity = page.locator("section", { hasText: "Identity" }).first();
  const hasPhoto = (await page.locator('input[name="photo_path"]').inputValue()) !== "";
  if (!hasPhoto) {
    await identity.locator('input[type="file"]').setInputFiles(PHOTO_FIXTURE);
    await page.getByRole("button", { name: "Use this image" }).click();
    await expect(identity.getByRole("button", { name: "Remove" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText(/profile saved/i)).toBeVisible({ timeout: 15_000 });
    await page.reload();
  }
  await expect(identity.locator("img").first()).toBeVisible();
  await page.waitForTimeout(800);
  await identity.screenshot({ path: `${OUT}/14-coach-profile-photo.png` });
});

test("capture 15: coaching workspace", async ({ page }) => {
  await signIn(page, "coach@disc360.dev");
  await page.goto("/app/coach");
  await expect(page.getByText(/engagement/i).first()).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/15-coach-workspace.png`, fullPage: true });
});

test("capture 16: media guide", async ({ page }) => {
  await signIn(page, "admin@disc360.dev");
  await page.goto("/media-guide");
  await expect(page.getByRole("heading", { name: /replaceable visual assets/i })).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/16-media-guide.png` });
});

test("capture 17: Platform Admin navigation entry", async ({ page }) => {
  await signIn(page, "admin@disc360.dev");
  await expect(page.getByRole("link", { name: "Platform Admin" }).first()).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/17-platform-admin-nav.png` });
});

test("capture 18: admin role management", async ({ page }) => {
  await signIn(page, "admin@disc360.dev");
  await page.goto(`/admin/users/${DEMO_USER}`);
  const orgSection = page.getByRole("region", { name: "Organization roles" });
  await expect(orgSection.getByRole("button", { name: "Update role" }).first()).toBeVisible();
  await orgSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/18-admin-role-management.png`, fullPage: true });
});
