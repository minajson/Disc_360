import { expect, test, type Page } from "@playwright/test";

/**
 * The three representative visual systems — Behaviour Compass (DISC), Focus
 * Lens (Focus Pulse) and Behaviour–Focus Fusion (Combined) — verified across
 * the required viewport matrix on real, freshly-generated results.
 *
 * Each visual is a viewBox-based SVG carrying a descriptive aria-label; the
 * assertions target that label, no horizontal overflow, and zero console/page
 * errors. Screenshots at 390 and 1366 are written to docs/screenshots/visuals
 * as the visual-regression artifacts.
 */

const OUT = "docs/screenshots/visuals";

const VIEWPORTS: [number, number][] = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
  [3440, 1440],
];

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("disc360-demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app**");
}

async function completeFocus(page: Page) {
  for (let i = 0; i < 6; i++) {
    await page.getByText(new RegExp(`Question ${i + 1} of 6`)).waitFor({ timeout: 12_000 });
    await page.waitForTimeout(600);
    const isScale = await page.getByText(/How noisy does your mind feel/i).isVisible().catch(() => false);
    if (isScale) await page.getByRole("button", { name: "7", exact: true }).click();
    else await page.getByRole("group").getByRole("button").first().click();
    if (i < 5) await page.getByText(new RegExp(`Question ${i + 2} of 6`)).waitFor({ timeout: 12_000 }).catch(() => {});
  }
  await page.getByRole("button", { name: /See my Focus profile/i }).click();
}

async function noHorizontalScroll(page: Page) {
  const ok = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(ok, "page must not scroll horizontally").toBe(true);
}

test("compass, lens and fusion render across the full viewport matrix", async ({ page }) => {
  test.slow();
  test.setTimeout(360_000);

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });

  // ── Generate real results once ──
  await signIn(page, "solo@disc360.dev");

  // DISC result: solo@ is seeded with history — take the newest report link.
  await page.goto("/app");
  const discHref = await page.locator('a[href^="/app/results/"]').first().getAttribute("href");
  expect(discHref).toBeTruthy();
  const discUrl = discHref!;

  // Focus result: run the six-question pulse.
  await page.goto("/focus/assessment");
  await page.waitForURL("**/focus/assessment/**", { timeout: 20_000 });
  await completeFocus(page);
  await page.waitForURL("**/focus/results/**", { timeout: 20_000 });
  const focusUrl = new URL(page.url()).pathname;

  // Combined result: the full DISC → Focus chain.
  await page.goto("/combined/assessment");
  await page.waitForURL("**/app/assessments/**", { timeout: 20_000 });
  for (let s = 0; s < 24; s++) {
    await expect(page.getByText(`Scenario ${s + 1} of 24`)).toBeVisible();
    const options = page.getByRole("group").getByRole("button");
    await options.first().click();
    await options.nth(1).click();
  }
  await page.getByRole("button", { name: "Submit assessment" }).click();
  await page.waitForURL("**/focus/assessment/**", { timeout: 30_000 });
  await completeFocus(page);
  await page.waitForURL("**/combined/results/**", { timeout: 30_000 });
  const combinedUrl = new URL(page.url()).pathname;

  // ── Viewport matrix ──
  const targets = [
    { url: discUrl, label: /^Behaviour compass\./, name: "compass" },
    { url: focusUrl, label: /^Focus lens\./, name: "lens" },
    { url: combinedUrl, label: /fusion map\./, name: "fusion" },
  ];

  for (const target of targets) {
    for (const [width, height] of VIEWPORTS) {
      await page.setViewportSize({ width, height });
      await page.goto(target.url);
      const svg = page.locator(`svg[aria-label]`).filter({ hasText: "" }).first();
      void svg;
      const visual = page.getByRole("img", { name: target.label });
      await expect(visual, `${target.name} at ${width}×${height}`).toBeVisible({ timeout: 15_000 });
      await noHorizontalScroll(page);

      const box = await visual.boundingBox();
      expect(box, `${target.name} has a box at ${width}`).toBeTruthy();
      // Never a sliver, never wider than the viewport. (0.6 accounts for the
      // page card's own padding at narrow widths.)
      expect(box!.width).toBeGreaterThan(Math.min(260, width * 0.6));
      expect(box!.width).toBeLessThanOrEqual(width + 1);

      if (width === 390 || width === 1366) {
        await page.waitForTimeout(1200); // let entrance motion settle
        await page.screenshot({ path: `${OUT}/${target.name}-${width}.png`, fullPage: false });
      }
    }
  }

  // ── Presentation mode (projector) ──
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${combinedUrl}/present`);
  await expect(page.getByRole("img", { name: /fusion map\./ })).toBeVisible();
  await noHorizontalScroll(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/fusion-present-1920.png` });

  expect(pageErrors, `console/page errors:\n${pageErrors.join("\n")}`).toHaveLength(0);
});

test("visuals stay meaningful under reduced motion", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await signIn(page, "solo@disc360.dev");
  await page.goto("/app");
  const discHref = await page.locator('a[href^="/app/results/"]').first().getAttribute("href");
  await page.goto(discHref!);
  // Static render: the compass is present and labelled without any animation.
  await expect(page.getByRole("img", { name: /^Behaviour compass\./ })).toBeVisible();
  await expect(page.getByText("Dominant", { exact: true }).first()).toBeVisible();
  await context.close();
});
