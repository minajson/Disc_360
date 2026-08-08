import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * PDF export completeness.
 *
 * The bug this pins: charts reveal with framer-motion's `whileInView`, which
 * only fires once an element scrolls into the viewport — and printing never
 * scrolls. The blanket print rules rescued anything revealed by opacity or
 * transform, so the one chart with no motion at all (the quadrant map) printed
 * fine while every bar that animates its WIDTH printed at zero. A facilitator
 * exported a report of empty tracks.
 *
 * These tests read the page under `print` media, which is exactly what the
 * print pipeline sees, so a future reveal added without a print fallback fails
 * here rather than in somebody's exported PDF.
 */

const ENG_TEAM = "30000000-0000-4000-8000-000000000002";

/**
 * Every scroll-gated bar: what it renders as, and what it was supposed to be.
 *
 * Comparing against the declared percentage rather than simply "> 0" is what
 * makes this correct for a dimension that genuinely scores zero — a team with
 * no Influence profiles has a legitimately empty band, and a test that
 * demanded width from it would be asserting the wrong thing.
 */
async function revealedBars(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-print-reveal="width"]')].map((bar) => {
      const track = bar.parentElement?.getBoundingClientRect().width ?? 0;
      const declared = Number.parseFloat(
        getComputedStyle(bar).getPropertyValue("--print-reveal-width"),
      );
      return {
        width: bar.getBoundingClientRect().width,
        track,
        declared: Number.isFinite(declared) ? declared : NaN,
        expected: (track * (Number.isFinite(declared) ? declared : 0)) / 100,
      };
    }),
  );
}

/** Each bar renders the width it declares, to within a rounding pixel. */
function expectBarsMatchDeclared(bars: Awaited<ReturnType<typeof revealedBars>>) {
  expect(bars.length).toBeGreaterThan(0);
  for (const bar of bars) {
    expect(bar.declared, "bar declares a print width").not.toBeNaN();
    expect(
      Math.abs(bar.width - bar.expected),
      `rendered ${bar.width.toFixed(1)}px vs declared ${bar.declared}% of ${bar.track.toFixed(1)}px`,
    ).toBeLessThanOrEqual(1.5);
  }
  // And the mechanism is actually doing something: not every bar is empty.
  expect(bars.some((bar) => bar.width > 1), "at least one bar has real width").toBe(true);
}

async function openTeamPage(page: Page, path: string) {
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${ENG_TEAM}/${path}`);
  await page.waitForTimeout(1200);
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(300);
}

test("team results: every chart is drawn in print, not just the quadrant map", async ({ page }) => {
  await openTeamPage(page, "results");

  // A bar sized 0 because its reveal never fired is exactly the bug.
  expectBarsMatchDeclared(await revealedBars(page));

  // The quadrant map — the chart that always worked — must still be there.
  expect(await page.locator("svg").count()).toBeGreaterThan(0);
});

test("team results: print carries the whole report, not the executive density", async ({ page }) => {
  await openTeamPage(page, "results");

  // "Executive view" is a reading density for the screen. An exported PDF is
  // the report, so the analytical sections belong in it either way.
  const headings = await page.locator("section h2").allTextContents();
  expect(headings).toContain("What this team is like");
  expect(headings).toContain("Who carries which energy");
  expect(headings).toContain("Where communication can break");
  expect(headings).toContain("Who complements — and who collides");
  expect(headings).toContain("Completed profiles");
  expect(headings).toContain("Recommended actions");
});

test("team results: screen-only chrome is left out of the export", async ({ page }) => {
  await openTeamPage(page, "results");

  await expect(page.getByRole("navigation", { name: "Team sections" })).toBeHidden();
  await expect(page.getByText("Hover or focus a member to inspect")).toBeHidden();
  await expect(page.getByRole("button", { name: "Export PDF" })).toBeHidden();
  await expect(page.getByRole("group", { name: "Information density" })).toBeHidden();
});

test("executive brief: its meters and bands print at their real values", async ({ page }) => {
  await openTeamPage(page, "executive");

  expectBarsMatchDeclared(await revealedBars(page));
});

test("SVG charts positioned by a transform attribute survive the print reset", async ({ page }) => {
  await openTeamPage(page, "results");

  // `transform` is a CSS property in SVG2, so a blanket `transform: none` in
  // print collapses every `<g transform="rotate(…)">` onto the origin. Any
  // node carrying the attribute must keep its computed transform.
  const collapsed = await page.evaluate(() =>
    [...document.querySelectorAll("svg [transform]")].filter(
      (node) => getComputedStyle(node).transform === "none",
    ).length,
  );
  expect(collapsed, "SVG nodes flattened by the print transform reset").toBe(0);
});

test("on screen, charts still animate in rather than appearing pre-drawn", async ({ page }) => {
  // The print fallback must not leak into the screen experience: below-the-fold
  // bars should still be waiting for their reveal on first paint.
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${ENG_TEAM}/results`);
  await page.waitForTimeout(1200);

  // allTextContents() ignores visibility, so assert on the element itself.
  await expect(page.getByRole("heading", { name: "Completed profiles" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "What this team is like" })).toBeVisible();
});
