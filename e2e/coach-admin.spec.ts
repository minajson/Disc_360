import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { mediaRegistry } from "../data/media-registry";
import { signOut } from "./helpers";

/**
 * Acceptance tests D–F: coach profile with a real photo upload,
 * platform-admin discoverability, and media-guide completeness.
 */

const PHOTO_FIXTURE = path.join(__dirname, "fixtures", "coach-photo.png");

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("disc360-demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app");
}

/** The account menu only exists inside the app shell, so land there first. */
async function leaveSession(page: Page) {
  await page.goto("/app");
  await signOut(page);
}

test("D: coach onboarding, profile with photo upload, persistence after reload", async ({ page }) => {
  test.slow();

  // Fresh coach account through the "Manage coaching clients" intent.
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Casey Facilitator");
  await page.getByLabel("Email").fill(`pw-coach-${Date.now()}@disc360.dev`);
  await page.getByLabel("Password").fill("disc360-playwright");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding**");
  await page.getByRole("radio", { name: /Manage coaching clients/i }).click();
  await page.getByLabel("Country").fill("US");
  await page.getByText(/I consent to DISC360 processing/).click();
  await page.getByRole("button", { name: /Set up my workspace/i }).click();

  // Coach onboarding lands directly on the profile editor.
  await page.waitForURL("**/app/coach/profile");

  await page.getByLabel("Professional title").fill("Executive Coach");
  await page.getByLabel("Organisation / company").fill("Facilitator & Co");
  await page.getByLabel("Short biography").fill("Fifteen years of leadership coaching across product teams.");
  await page.getByLabel("Credentials / certifications").fill("ICF PCC\nDISC Certified Practitioner");
  await page.getByLabel("Areas of expertise").fill("Team dynamics\nConflict resolution");
  await page.getByLabel("Years of experience (optional)").fill("15");

  // Real photo upload: choose → preview → confirm → path stored.
  const identity = page.locator("section", { hasText: "Identity" }).first();
  await identity.locator('input[type="file"]').setInputFiles(PHOTO_FIXTURE);
  await expect(page.getByText(/Preview shown — confirm to upload/i)).toBeVisible();
  await page.getByRole("button", { name: "Use this image" }).click();
  await expect(identity.getByRole("button", { name: "Remove" })).toBeVisible({ timeout: 15_000 });
  const storedPath = await page.locator('input[name="photo_path"]').inputValue();
  expect(storedPath).toMatch(/^coach-photo\//);

  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText(/profile saved/i)).toBeVisible({ timeout: 15_000 });

  // Everything survives a full reload — fields, arrays and the photo path.
  await page.reload();
  await expect(page.getByLabel("Professional title")).toHaveValue("Executive Coach");
  await expect(page.getByLabel("Organisation / company")).toHaveValue("Facilitator & Co");
  await expect(page.getByLabel("Credentials / certifications")).toHaveValue(/ICF PCC/);
  await expect(page.locator('input[name="photo_path"]')).toHaveValue(storedPath);
  await expect(identity.locator("img").first()).toBeVisible();

  // The client-facing preview renders the uploaded photo too.
  await page.getByRole("link", { name: /Preview client-facing profile/i }).click();
  await page.waitForURL("**/app/coach/profile/preview");
  await expect(page.getByText("Casey Facilitator")).toBeVisible();
  await expect(page.getByText("Executive Coach").first()).toBeVisible();
});

test("E: Platform Admin is discoverable for super admins and absent for others", async ({ page }) => {
  // Non-admins never see the entry point.
  await signIn(page, "solo@disc360.dev");
  await expect(page.getByRole("link", { name: "Platform Admin" })).toHaveCount(0);
  await leaveSession(page);

  // Super admins see it in the shell nav, and it round-trips.
  await signIn(page, "admin@disc360.dev");
  const adminLink = page.getByRole("link", { name: "Platform Admin" }).first();
  await expect(adminLink).toBeVisible();
  await adminLink.click();
  await page.waitForURL("**/admin");
  await expect(page.getByRole("heading", { name: /Platform health/i })).toBeVisible();
  await page.getByRole("link", { name: "Return to DISC360" }).click();
  await page.waitForURL("**/app");
});

test("E2: admin can manage organization roles on the user detail page", async ({ page }) => {
  await signIn(page, "admin@disc360.dev");
  // Search rather than assume page 1: the list is paginated newest-first, so
  // any test that creates accounts pushes the seeded users off it.
  await page.goto("/admin/users?q=Dana");
  await page.getByRole("link", { name: /Dana Whitfield/i }).first().click();
  await page.waitForURL("**/admin/users/**");

  const orgSection = page.getByRole("region", { name: "Organization roles" });
  await expect(orgSection.getByText("Atlas Collective")).toBeVisible();

  /*
   * Reload-and-check rather than reload-once-and-assert. A single reload
   * races the server action's revalidation — it passed alone and failed under
   * full-suite load, which is flakiness, not a real signal. Polling the reload
   * asserts the same thing (the role persisted) without the race.
   */
  const setRoleAndExpect = async (role: string) => {
    await orgSection.getByRole("combobox").first().selectOption(role);
    await orgSection.getByRole("button", { name: "Update role" }).first().click();
    await expect
      .poll(
        async () => {
          await page.reload();
          return orgSection.getByRole("combobox").first().inputValue();
        },
        { timeout: 20_000, message: `role should persist as ${role}` },
      )
      .toBe(role);
  };

  await setRoleAndExpect("coach");
  // Restore the seeded role so the suite is re-runnable.
  await setRoleAndExpect("organization_admin");
});

test("F: /media-guide lists every registry entry with complete specs", async ({ page }) => {
  // Production build gates the page to super admins.
  await signIn(page, "admin@disc360.dev");
  await page.goto("/media-guide");
  await expect(
    page.getByRole("heading", { name: new RegExp(`${mediaRegistry.length} replaceable visual assets`) }),
  ).toBeVisible();

  await expect(page.locator("[data-media-entry]")).toHaveCount(mediaRegistry.length);
  for (const entry of mediaRegistry) {
    const row = page.locator(`[data-media-entry="${entry.id}"]`);
    await expect(row).toHaveCount(1);
    await expect(row.getByText(entry.id, { exact: true })).toBeVisible();
    await expect(row.getByText(entry.type, { exact: true })).toBeVisible();
    await expect(row.getByText(entry.dimensions).first()).toBeVisible();
    await expect(row.getByText(entry.replacementPath).first()).toBeVisible();
  }
});
