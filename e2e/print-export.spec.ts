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

/* ── path charts, legends and the other export surfaces ──────────── */

test("path-drawn charts are complete in print, not part-drawn", async ({ page }) => {
  await openTeamPage(page, "results");
  // pathLength animates via stroke-dasharray. Any tagged path must have it
  // cleared, or an unscrolled line prints as nothing.
  const partDrawn = await page.evaluate(() =>
    [...document.querySelectorAll('[data-print-reveal="path"]')].filter((node) => {
      const style = getComputedStyle(node);
      return style.strokeDasharray !== "none" || Number(style.strokeDashoffset) !== 0;
    }).length,
  );
  expect(partDrawn, "paths still carrying a dash pattern in print").toBe(0);
});

test("executive brief: charts, legends and axis labels all print", async ({ page }) => {
  await openTeamPage(page, "executive");

  expectBarsMatchDeclared(await revealedBars(page));

  const text = await page.locator("body").innerText();
  // The radar's legend and its four axes are part of reading the chart.
  for (const label of ["Team average", "Dominant", "Influence", "Stable", "Analytical"]) {
    expect(text, `legend/label "${label}"`).toContain(label);
  }
  expect(await page.locator("svg").count()).toBeGreaterThan(0);
});

/** How many "Ask the room" blocks exist, and how many a reader can see. */
async function evidenceBlocks(page: Page) {
  const locator = page.getByText("Ask the room");
  const total = await locator.count();
  const visible = await locator.evaluateAll(
    (nodes) => nodes.filter((node) => (node as HTMLElement).checkVisibility()).length,
  );
  return { total, visible };
}

test("AI Insights: collapsed evidence is part of the exported report", async ({ page }) => {
  await openTeamPage(page, "insights");

  // Every card's evidence prints, whether or not it was expanded on screen.
  const { total, visible } = await evidenceBlocks(page);
  expect(total, "insight cards with evidence").toBeGreaterThan(0);
  expect(visible, "all evidence blocks print").toBe(total);

  // The toggle that controls them is screen-only.
  await expect(page.getByRole("button", { name: /Show evidence|Hide evidence/ }).first()).toBeHidden();
});

test("on screen, collapsed AI Insights cards stay collapsed", async ({ page }) => {
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${ENG_TEAM}/insights`);
  await page.waitForTimeout(1500);

  // Some cards open by default; the rest must still be closed. If the print
  // fallback leaked into the screen, every block would be visible.
  const { total, visible } = await evidenceBlocks(page);
  expect(total).toBeGreaterThan(0);
  expect(visible, "collapsed cards remain collapsed for readers").toBeLessThan(total);
  await expect(page.getByRole("button", { name: /Show evidence/ }).first()).toBeVisible();
});

test("every export surface leaves its own controls out of the PDF", async ({ page }) => {
  await signIn(page, "demo@disc360.dev");
  for (const path of ["results", "executive", "compare", "insights"]) {
    await page.goto(`/app/teams/${ENG_TEAM}/${path}`);
    await page.waitForTimeout(1500);
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(300);
    await expect(
      page.getByRole("navigation", { name: "Team sections" }),
      `${path}: team tabs`,
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Export PDF" }),
      `${path}: export button`,
    ).toBeHidden();
    await page.emulateMedia({ media: "screen" });
  }
});

test("DISC colours survive the print pipeline", async ({ page }) => {
  await openTeamPage(page, "results");
  // Browsers drop backgrounds unless print-color-adjust says otherwise, and a
  // DISC bar IS its background colour.
  const adjusted = await page.evaluate(() => {
    const bar = document.querySelector('[data-print-reveal="width"]');
    if (!bar) return null;
    const style = getComputedStyle(bar);
    return {
      colorAdjust:
        style.printColorAdjust || style.getPropertyValue("-webkit-print-color-adjust"),
      background: style.backgroundColor,
    };
  });
  expect(adjusted, "a tagged bar exists").not.toBeNull();
  expect(adjusted!.colorAdjust).toBe("exact");
  expect(adjusted!.background, "bar keeps a real colour").not.toBe("rgba(0, 0, 0, 0)");
});

test("the export produces a real, multi-page PDF", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "firefox", "page.pdf is Chromium-only");
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${ENG_TEAM}/results`);
  await page.waitForTimeout(1500);

  const pdf = await page.pdf({ format: "A4", printBackground: true });
  const raw = pdf.toString("latin1");
  expect(raw.startsWith("%PDF"), "PDF magic bytes").toBe(true);
  expect(raw.trimEnd().endsWith("%%EOF"), "EOF marker").toBe(true);
  expect(pdf.length).toBeGreaterThan(20_000);

  const pageCount = Number(raw.match(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/)?.[1] ?? 0);
  expect(pageCount, "the report runs to more than one page").toBeGreaterThan(1);
});
