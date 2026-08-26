import { expect, type Page } from "@playwright/test";

/**
 * Shared journey helpers.
 *
 * Sign-out moved behind the account menu in the v2.3 navigation rebuild, so
 * every spec that used to click a bare "Sign out" button now goes through one
 * helper — the next nav change touches this file, not seven specs.
 */

export const DEMO_PASSWORD = "disc360-demo";

/**
 * Submit the sign-in form and wait for the application.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THE CLICK IS RETRIED.
 *
 * Against a production build the sign-in form is server-rendered and looks
 * fully interactive before React has attached its submit handler. A click
 * dispatched inside that window is simply swallowed: the page stays on
 * /sign-in with both fields still filled, the button still reading "Sign in"
 * rather than "Signing in…", and no error anywhere. It looks exactly like a
 * dead button, and it is the reason `waitForURL` then times out.
 *
 * Playwright's actionability checks cannot catch this. The button is visible,
 * enabled, stable and receives the event — it just has no listener yet, and
 * "has React hydrated" is not something the DOM exposes.
 *
 * Retrying is safe rather than a double-submit risk: the button is
 * `disabled={pending}` for as long as a real submit is in flight, so the guard
 * below can only ever re-click a form that did nothing.
 *
 * This is a HARNESS fix. The race is in the test, not in the product: a person
 * who clicks a dead button clicks it again, and the second click works.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function submitSignIn(
  page: Page,
  destination: RegExp | string = "**/app**",
): Promise<void> {
  const button = page.getByRole("button", { name: "Sign in" });
  await expect(async () => {
    // Once the submit takes, the button disables and then the page navigates;
    // either makes this a no-op and the wait below is what succeeds.
    if (await button.isEnabled({ timeout: 1000 }).catch(() => false)) {
      await button.click({ timeout: 2000 }).catch(() => {});
    }
    await page.waitForURL(destination, { timeout: 3000 });
  }).toPass({ timeout: 45_000, intervals: [250, 500, 1000] });
}

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await submitSignIn(page);
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
