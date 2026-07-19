import { expect, type Page } from "@playwright/test";

/**
 * Shared journey helpers.
 *
 * Sign-out moved behind the account menu in the v2.3 navigation rebuild, so
 * every spec that used to click a bare "Sign out" button now goes through one
 * helper — the next nav change touches this file, not seven specs.
 */

export const DEMO_PASSWORD = "disc360-demo";

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app**");
}

/** Opens the account menu and signs out, waiting for the marketing home. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL("**/");
}

/** Opens the account menu without dismissing it — for asserting its contents. */
export async function openAccountMenu(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
}
