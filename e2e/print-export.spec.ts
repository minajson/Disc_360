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

test("team results: print is the seven-page Team Intelligence report", async ({ page }) => {
  await openTeamPage(page, "results");

  // The printed artefact is a designed document, not the dashboard.
  const pages = page.locator('[data-report="team-intelligence"] .report-page');
  await expect(pages).toHaveCount(7);

  const text = await page.locator('[data-report="team-intelligence"]').innerText();
  for (const heading of [
    "Team Intelligence",
    "The behavioural shape of this team",
    "Where the team is concentrated",
    "How this team communicates and decides",
    "Where communication can break",
    "What changes when it matters",
    "Recommended actions",
  ]) {
    expect(text, `report section "${heading}"`).toContain(heading);
  }

  // The interactive view is not printed alongside it.
  await expect(page.getByRole("group", { name: "Information density" })).toBeHidden();
});

test("team results: the participant roster is not in the exported report", async ({ page }) => {
  await openTeamPage(page, "results");
  const report = page.locator('[data-report="team-intelligence"]');
  const text = await report.innerText();

  // A recommendation may cite one member by their anonymised alias; several
  // pages listing every one of them is a register, not intelligence.
  const cited = new Set(text.match(/\bMember [A-Z]\b/g) ?? []);
  expect(cited.size, `members named: ${[...cited].join(", ")}`).toBeLessThanOrEqual(2);
  // And no per-member table: no row carries a full DISC readout.
  expect(text).not.toMatch(/D \d+ · I \d+ · S \d+ · A \d+/);

  // The aggregate participation indicator stays.
  expect(text).toMatch(/\d+\/\d+/);
  expect(text.toLowerCase()).toContain("profiles completed");
  expect(text.toLowerCase()).toContain("participation");
});

test("team results: the report carries no facilitator recommendations", async ({ page }) => {
  await openTeamPage(page, "results");
  const text = await page.locator('[data-report="team-intelligence"]').innerText();
  expect(text.toLowerCase()).toContain("recommended actions");
  expect(text.toLowerCase()).toContain("for the team");
  expect(text.toLowerCase()).not.toContain("for the facilitator");
  expect(text.toLowerCase()).not.toContain("for the coach");
});

test("team results: every report page is exactly one sheet, footer and all", async ({ page }) => {
  await openTeamPage(page, "results");
  const pages = page.locator('[data-report="team-intelligence"] .report-page');
  const count = await pages.count();

  for (let index = 0; index < count; index++) {
    const box = await pages.nth(index).boundingBox();
    // 297mm at 96dpi ≈ 1122.5px. A page taller than its sheet would split.
    expect(Math.round(box!.height), `page ${index + 1} height`).toBeGreaterThan(1100);
    expect(Math.round(box!.height), `page ${index + 1} height`).toBeLessThan(1140);
    // Its footer carries the report identity and the page number.
    const footer = await pages.nth(index).locator(".report-footer").innerText();
    expect(footer).toContain("DISC360");
    expect(footer).toContain(`${index + 1} / ${count}`);
  }
});

test("team results: charts are atomic print blocks", async ({ page }) => {
  await openTeamPage(page, "results");
  const figures = page.locator('[data-report="team-intelligence"] .report-figure');
  expect(await figures.count()).toBeGreaterThan(0);
  const splittable = await figures.evaluateAll(
    (nodes) => nodes.filter((node) => getComputedStyle(node).breakInside !== "avoid").length,
  );
  expect(splittable, "figures that could split across a page").toBe(0);
});

test("team results: the report renders the report's charts", async ({ page }) => {
  await openTeamPage(page, "results");
  const report = page.locator('[data-report="team-intelligence"]');
  // Radar and composition map are SVG; the bars are DOM.
  expect(await report.locator("svg").count(), "SVG charts").toBeGreaterThanOrEqual(2);
  expectBarsMatchDeclared(
    await page.evaluate(() =>
      [...document.querySelectorAll('[data-report="team-intelligence"] [data-print-reveal="width"]')].map(
        (bar) => {
          const track = bar.parentElement?.getBoundingClientRect().width ?? 0;
          const declared = Number.parseFloat(
            getComputedStyle(bar).getPropertyValue("--print-reveal-width"),
          );
          return {
            width: bar.getBoundingClientRect().width,
            track,
            declared,
            expected: (track * declared) / 100,
          };
        },
      ),
    ),
  );
});

test("the report exposes no participant contact details, named or not", async ({ page }) => {
  await openTeamPage(page, "results");
  const text = await page.locator('[data-report="team-intelligence"]').innerText();

  expect(text, "an email address reached the report").not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  expect(text, "a database id reached the report").not.toMatch(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );

  // An anonymous team says so, and its members stay aliases.
  if (text.includes("reports anonymously")) {
    const cited = new Set(text.match(/\bMember [A-Z]\b/g) ?? []);
    for (const alias of cited) expect(alias).toMatch(/^Member [A-Z]$/);
  }
});

test("on screen, the results page is the interactive view — not the document", async ({ page }) => {
  await signIn(page, "demo@disc360.dev");
  await page.goto(`/app/teams/${ENG_TEAM}/results`);
  await page.waitForTimeout(1500);
  // The document exists in the DOM for print but must not be on screen.
  await expect(page.locator('[data-report="team-intelligence"]')).toBeHidden();
  await expect(page.getByRole("group", { name: "Information density" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export PDF" })).toBeVisible();
});

test("team results: screen-only chrome is left out of the export", async ({ page }) => {
  await openTeamPage(page, "results");

  const visibleCount = async (text: string) =>
    page
      .getByText(text)
      .evaluateAll((nodes) => nodes.filter((n) => (n as HTMLElement).checkVisibility()).length);

  await expect(page.getByRole("navigation", { name: "Team sections" })).toBeHidden();
  expect(await visibleCount("Hover or focus a member to inspect"), "map hover hint").toBe(0);
  expect(await visibleCount("Export PDF"), "export button").toBe(0);
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

test("A4 is scoped to the report surfaces, not imposed product-wide", async ({ page }) => {
  // `@page` is document-scoped — a bare rule in globals.css would silently
  // put every printable surface on A4. The report declares its paper; nothing
  // else should have had that decision made for it.
  const paperRules = async (path: string) => {
    await page.goto(path);
    await page.waitForTimeout(1200);
    return page.evaluate(() => {
      const found: string[] = [];
      const walk = (rules: CSSRuleList) => {
        for (const rule of Array.from(rules)) {
          if (rule.constructor.name === "CSSPageRule") found.push(rule.cssText);
          const nested = (rule as CSSGroupingRule).cssRules;
          if (nested) walk(nested);
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          walk(sheet.cssRules);
        } catch {
          /* cross-origin sheet — none of ours */
        }
      }
      return found;
    });
  };

  await signIn(page, "demo@disc360.dev");

  // A surface with no report on it must declare no unnamed page size.
  for (const path of ["/app", `/app/teams/${ENG_TEAM}/compare`, `/app/teams/${ENG_TEAM}/insights`]) {
    const rules = await paperRules(path);
    const unnamed = rules.filter((rule) => /^@page\s*\{/.test(rule.trim()));
    expect(unnamed, `${path} declares a product-wide paper size: ${unnamed.join(" ")}`).toHaveLength(0);
  }

  // The Team Intelligence report carries a NAMED page, which applies only to
  // the element that asks for it.
  const reportRules = await paperRules(`/app/teams/${ENG_TEAM}/results`);
  expect(reportRules.some((rule) => /@page\s+report/.test(rule)), "named @page report").toBe(true);

  // The Executive Brief declares A4 for its own route only.
  const execRules = await paperRules(`/app/teams/${ENG_TEAM}/executive`);
  expect(
    execRules.some((rule) => /^@page\s*\{/.test(rule.trim()) && /A4/i.test(rule)),
    "executive brief declares its own A4 paper",
  ).toBe(true);
});

test("the produced sheet is A4 for reports and untouched elsewhere", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "firefox", "page.pdf is Chromium-only");
  await signIn(page, "demo@disc360.dev");

  /** Width and height of the first page, from the PDF's own MediaBox. */
  const sheetOf = async (path: string) => {
    await page.goto(path);
    await page.waitForTimeout(2000);
    const raw = (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString("latin1");
    const box = raw.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);
    return { w: Math.round(Number(box?.[1] ?? 0)), h: Math.round(Number(box?.[2] ?? 0)) };
  };

  // A4 is 595 × 842pt; US Letter is 612 × 792pt.
  const report = await sheetOf(`/app/teams/${ENG_TEAM}/results`);
  expect(report, "Team Intelligence prints A4").toEqual({ w: 595, h: 842 });

  const executive = await sheetOf(`/app/teams/${ENG_TEAM}/executive`);
  expect(executive, "Executive Brief prints A4").toEqual({ w: 595, h: 842 });

  // Everything else keeps whatever the engine defaults to — the product is
  // not silently re-papered by a rule meant for two reports.
  const other = await sheetOf(`/app/teams/${ENG_TEAM}/compare`);
  expect(other.w, "Compare keeps the default paper").not.toBe(595);
});
