import { expect, test, type Page } from "@playwright/test";

/**
 * The opening slide: the DISC wheel, projected.
 *
 * What these assert is mostly what is *absent*. A keynote opening is defined
 * by the things that are not on the screen — no chrome, no counter, no card,
 * no letterbox — so each of those is a test rather than a note in a comment.
 */

const DISC = "/present/disc/introduction";
const COMBINED = "/present/combined/introduction";
const FOCUS = "/present/focus/introduction";

const overture = (page: Page) => page.getByTestId("overture");

async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForSelector('[data-testid="deck-root"]');
}

/**
 * Waits for the entrance to finish before measuring.
 *
 * Two animations overlap on arrival: the app's route transition, which
 * translates the page a few pixels, and the slide's own fade. Geometry read
 * during either one is a frame of an animation, not the slide — so these tests
 * settle first and then assert what the room actually looks at.
 */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-testid="overture"]');
    if (!node) return false;
    const box = node.getBoundingClientRect();
    return box.top === 0 && box.left === 0 && getComputedStyle(node).opacity === "1";
  });
}

/* ── 1–3 · it is the first thing the room sees ──────────────────────── */

test("the DISC deck opens on the wheel", async ({ page }) => {
  await open(page, DISC);
  await expect(overture(page)).toBeVisible();
  await expect(page.getByRole("img", { name: /DISC wheel/i })).toBeVisible();
});

test("the Combined deck opens on the same wheel", async ({ page }) => {
  await open(page, COMBINED);
  await expect(overture(page)).toBeVisible();
});

test("the Focus deck does not — it is not a DISC instrument", async ({ page }) => {
  await open(page, FOCUS);
  await expect(overture(page)).toHaveCount(0);
});

/* ── 4–7 · nothing else is on the screen ────────────────────────────── */

test("no navigation, counter or exit is visible on the opening slide", async ({ page }) => {
  await open(page, DISC);
  for (const name of [
    "Next slide",
    "Previous slide",
    "Restart presentation",
    "Toggle fullscreen",
    "Show facilitator notes",
  ]) {
    await expect(page.getByRole("button", { name })).toBeHidden();
  }
  await expect(page.getByRole("link", { name: "Exit" })).toBeHidden();
  await expect(page.getByText(/^\d+ \/ \d+$/)).toBeHidden();
});

test("the slide fills the viewport edge to edge, with no border or card", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await open(page, DISC);
  await settled(page);

  const box = await overture(page).boundingBox();
  expect(box?.x).toBe(0);
  expect(box?.y).toBe(0);
  expect(box?.width).toBe(1920);
  expect(box?.height).toBe(1080);

  const style = await overture(page).evaluate((node) => {
    const s = getComputedStyle(node);
    return { border: s.borderTopWidth, radius: s.borderTopLeftRadius, shadow: s.boxShadow };
  });
  expect(style.border).toBe("0px");
  expect(style.radius).toBe("0px");
  expect(style.shadow).toBe("none");
  await ctx.close();
});

test("the background is pure white", async ({ page }) => {
  await open(page, DISC);
  await settled(page);
  const background = await overture(page).evaluate(
    (node) => getComputedStyle(node).backgroundColor,
  );
  expect(background).toBe("rgb(255, 255, 255)");
});

test("the wheel is never cropped or stretched", async ({ browser }) => {
  // Square artwork on a 16:9 screen: contained, so the whole wheel is present
  // and its aspect ratio is untouched.
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await open(page, DISC);
  await settled(page);

  const image = page.getByRole("img", { name: /DISC wheel/i });
  expect(await image.evaluate((node) => getComputedStyle(node).objectFit)).toBe("contain");
  const natural = await image.evaluate((node) => {
    const img = node as HTMLImageElement;
    return { w: img.naturalWidth, h: img.naturalHeight };
  });
  expect(natural.w).toBe(natural.h);
  await ctx.close();
});

/* ── 8–10 · advancing ───────────────────────────────────────────────── */

test("clicking anywhere advances into the deck", async ({ page }) => {
  await open(page, DISC);
  await overture(page).click({ position: { x: 40, y: 40 } });
  await expect(overture(page)).toHaveCount(0);
  await expect(
    page.getByText("How do people lead, communicate and respond when it matters?"),
  ).toBeVisible();
});

test("a key press advances, and the chrome comes back with the deck", async ({ page }) => {
  await open(page, DISC);
  await page.keyboard.press("ArrowRight");
  await expect(overture(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next slide" })).toBeVisible();
  await expect(page.getByText("2 / 11")).toBeVisible();
});

test("stepping back from slide two returns to the wheel", async ({ page }) => {
  await open(page, DISC);
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Previous slide" }).click();
  await expect(overture(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Next slide" })).toBeHidden();
});

/* ── 11 · reduced motion ────────────────────────────────────────────── */

test("reduced motion shows the wheel immediately rather than fading it in", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await open(page, DISC);
  await expect(overture(page)).toBeVisible();
  // Full opacity well inside the 700ms fade: if the entrance were running,
  // the wheel could not be fully opaque this early.
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('[data-testid="overture"]')!).opacity === "1",
    undefined,
    { timeout: 400 },
  );
  await ctx.close();
});
