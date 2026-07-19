import { expect, test, type Page } from "@playwright/test";
import { signIn, signOut } from "./helpers";

/**
 * Facilitator presentation system — flows, controls, responsiveness and the
 * team path. The standalone /present routes are public; the team routes require
 * a team admin (seeded demo@disc360.dev).
 */

const ENG_TEAM = "30000000-0000-4000-8000-000000000002";

async function counter(page: Page): Promise<string> {
  return (await page.getByText(/^\d+ \/ \d+$/).first().innerText()).trim();
}

/* ── product start screens ──────────────────────────────────────────── */

test("DISC start screen offers presentation or straight-to-assessment", async ({ page }) => {
  await page.goto("/present/disc");
  await expect(page.getByRole("link", { name: /Start with presentation/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Go straight to assessment/i })).toBeVisible();
});

test("Combined start screen offers all four introduction choices", async ({ page }) => {
  await page.goto("/present/combined");
  for (const label of [
    "Combined introduction",
    "DISC introduction only",
    "Focus introduction only",
    "Go straight to assessment",
  ]) {
    await expect(
      page.getByRole("link", { name: label }).or(page.getByRole("button", { name: label })).first(),
    ).toBeVisible();
  }
});

test("choosing a presentation opens the deck", async ({ page }) => {
  await page.goto("/present/disc");
  await page.getByRole("link", { name: /Start with presentation/i }).click();
  await page.waitForURL("**/present/disc/introduction**");
  await expect(page.getByText("How do people lead, communicate and respond when it matters?")).toBeVisible();
  expect(await counter(page)).toBe("1 / 10");
});

test("going straight to assessment leaves the start screen (auth-gated)", async ({ page }) => {
  await page.goto("/present/disc");
  await page.getByRole("button", { name: /Go straight to assessment/i }).click();
  // Unauthenticated: startAssessment's guard redirects to sign-in — not a dead end.
  await page.waitForURL(/\/sign-in|\/app|\/onboarding/, { timeout: 15_000 });
  expect(page.url()).not.toContain("/present/disc");
});

/* ── decks render ───────────────────────────────────────────────────── */

test("all three decks render their opening and reach a closing slide", async ({ page }) => {
  const decks = [
    { path: "/present/disc/introduction", count: 10, cta: "Start DISC assessment" },
    { path: "/present/focus/introduction", count: 10, cta: "Start Focus Pulse" },
    { path: "/present/combined/introduction", count: 12, cta: "Start combined assessment" },
  ];
  for (const d of decks) {
    await page.goto(d.path);
    expect(await counter(page)).toBe(`1 / ${d.count}`);
    // Advance to the last slide.
    for (let i = 1; i < d.count; i++) {
      await page.getByRole("button", { name: "Next slide" }).click();
    }
    expect(await counter(page)).toBe(`${d.count} / ${d.count}`);
    await expect(page.getByRole("button", { name: d.cta })).toBeVisible();
  }
});

/* ── controls ───────────────────────────────────────────────────────── */

test("keyboard arrows and space navigate slides", async ({ page }) => {
  await page.goto("/present/disc/introduction");
  expect(await counter(page)).toBe("1 / 10");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("2 / 10")).toBeVisible();
  await page.keyboard.press(" ");
  await expect(page.getByText("3 / 10")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText("2 / 10")).toBeVisible();
});

test("touch swipe navigates slides", async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/present/disc/introduction");
  expect(await counter(page)).toBe("1 / 10");
  // Dispatch on the player root (which carries the onTouch handlers). Body is
  // an ancestor, so events dispatched there never enter the player's subtree.
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="deck-root"]') as HTMLElement;
    const touch = (x: number) => [new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 })];
    el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: touch(300), changedTouches: touch(300) }));
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: touch(120) }));
  });
  await expect(page.getByText("2 / 10")).toBeVisible();
  await ctx.close();
});

test("facilitator notes toggle on and off; hidden by default", async ({ page }) => {
  await page.goto("/present/disc/introduction");
  // Default: the prompt is not shown (safe for screen sharing).
  await expect(page.getByText(/Introduce DISC as a language/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Show facilitator notes" }).click();
  await expect(page.getByText(/Introduce DISC as a language/i)).toBeVisible();
  await expect(page.getByText(/^Ask:/)).toBeVisible();
  await expect(page.getByText(/^Next$/)).toBeVisible(); // presenter console next-slide
  await page.getByRole("button", { name: "Hide notes" }).click();
  await expect(page.getByText(/Introduce DISC as a language/i)).toHaveCount(0);
});

test("fullscreen and restart controls are present; restart returns to slide 1", async ({ page }) => {
  await page.goto("/present/disc/introduction");
  await expect(page.getByRole("button", { name: "Toggle fullscreen" })).toBeVisible();
  await page.getByRole("button", { name: "Next slide" }).click();
  await page.getByRole("button", { name: "Next slide" }).click();
  expect(await counter(page)).toBe("3 / 10");
  await page.getByRole("button", { name: "Restart presentation" }).click();
  expect(await counter(page)).toBe("1 / 10");
});

test("progress dots jump to a slide", async ({ page }) => {
  await page.goto("/present/disc/introduction");
  await page.getByRole("button", { name: "Go to slide 5" }).click();
  await expect(page.getByText("5 / 10")).toBeVisible();
});

test("the final slide starts the assessment", async ({ page }) => {
  await page.goto("/present/disc/introduction");
  await page.getByRole("button", { name: "Go to slide 10" }).click();
  await page.getByRole("button", { name: "Start DISC assessment" }).click();
  // Auth-gated: unauthenticated users land on sign-in, not a dead end.
  await page.waitForURL(/\/sign-in|\/app\/assessments|\/onboarding/, { timeout: 15_000 });
});

test("exit returns to the product start screen", async ({ page }) => {
  await page.goto("/present/disc/introduction");
  await page.getByRole("link", { name: "Exit" }).click();
  await page.waitForURL("**/present/disc");
});

/* ── responsiveness & reduced motion ────────────────────────────────── */

test("mobile: content is readable and the page never scrolls sideways", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/present/disc/introduction");
  await page.getByRole("button", { name: "Next slide" }).click();
  await page.getByRole("button", { name: "Next slide" }).click();
  await expect(page.getByText("Direct and decisive")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(overflow).toBe(true);
  await ctx.close();
});

test("projector 1920×1080: opening headline is visible full-viewport", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto("/present/disc/introduction");
  await expect(page.getByText("How do people lead, communicate and respond when it matters?")).toBeVisible();
  await ctx.close();
});

test("reduced motion: deck content is immediately readable", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/present/disc/introduction");
  // With reduced motion there is no travel/fade delay to wait out.
  await expect(page.getByText("How do people lead, communicate and respond when it matters?")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("What DISC explores")).toBeVisible();
  await ctx.close();
});

/* ── team session path ──────────────────────────────────────────────── */

test("facilitator presents the team introduction and can show the join QR", async ({ page }) => {
  test.slow();
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${ENG_TEAM}/dashboard`);
  await page.getByRole("link", { name: "Present introduction" }).click();
  await page.waitForURL(`**/teams/${ENG_TEAM}/presentation/introduction`);

  // The deck plays and offers a Show QR control (team sessions only).
  expect(await counter(page)).toBe("1 / 10");
  await page.getByRole("button", { name: "Show QR" }).click();
  await expect(page.getByRole("dialog", { name: /Scan to begin/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scan to begin" })).toBeVisible();
  await page.keyboard.press("Escape"); // closes the QR overlay first

  // The closing slide offers a return to the facilitator dashboard.
  await page.getByRole("button", { name: "Go to slide 10" }).click();
  await expect(page.getByRole("link", { name: /Return to facilitator dashboard/i })).toBeVisible();

  // The presentation shell has no account menu; return to the app to sign out.
  await page.goto("/app");
  await signOut(page);
});
