import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Production-audit verification screenshots: the redesigned Behaviour Compass
 * hub, the new deck visuals at canvas and phone sizes, the password toggle,
 * and the "Why this profile" transparency section. Not assertions-heavy — the
 * behavioural specs cover that; this run exists to produce reviewable images.
 */

const SHOTS = "e2e/screenshots/audit";

test.describe("audit verification shots", () => {
  test("sign-in password toggle", async ({ page }) => {
    await page.goto("/sign-in");
    const toggle = page.getByRole("button", { name: "Show password" });
    await expect(toggle).toBeVisible();
    await page.getByLabel("Password", { exact: true }).fill("secret-demo");
    await page.screenshot({ path: `${SHOTS}/signin-password-hidden.png` });
    await toggle.click();
    await expect(page.getByRole("button", { name: "Hide password" })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await page.screenshot({ path: `${SHOTS}/signin-password-shown.png` });
  });

  test("DISC report: compass hero + why-this-profile", async ({ page }) => {
    await signIn(page, "solo@disc360.dev");
    await page.goto("/app/history");
    await page.getByRole("link", { name: /Report/ }).first().click();
    await page.waitForURL("**/app/results/**");
    await expect(page.getByRole("img", { name: /Behaviour compass/i })).toBeVisible();
    await page.waitForTimeout(1300); // let band/needle motion settle
    await page.screenshot({ path: `${SHOTS}/report-compass.png` });
    const why = page.getByRole("heading", { name: "Why this profile" });
    await expect(why).toBeVisible();
    await why.scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/report-why-profile.png` });
  });

  test("deck visuals across sizes", async ({ page }) => {
    await page.goto("/present/disc/introduction");
    await page.waitForSelector('[data-testid="deck-root"]');

    const next = page.getByRole("button", { name: "Next slide" });
    // slide 3 — compass (concept)
    await next.click();
    await next.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SHOTS}/deck-disc-03-compass-concept.png` });
    // slide 6 — compass (example blend)
    await next.click();
    await next.click();
    await next.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SHOTS}/deck-disc-06-compass-example.png` });

    // phone portrait of the same slide
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/deck-disc-06-phone.png` });
    await page.setViewportSize({ width: 1280, height: 720 });

    // focus deck: ripple (2), cycle (3), recovery curve (5)
    await page.goto("/present/focus/introduction");
    await page.waitForSelector('[data-testid="deck-root"]');
    await next.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SHOTS}/deck-focus-02-ripple.png` });
    await next.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SHOTS}/deck-focus-03-cycle.png` });
    await next.click();
    await next.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SHOTS}/deck-focus-05-recovery.png` });

    // ultrawide letterboxing check on the recovery slide
    await page.setViewportSize({ width: 2560, height: 1080 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/deck-focus-05-ultrawide.png` });
  });
});
