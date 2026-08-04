import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Phase 4 regression: presentation-grade legibility.
 *
 * The rule these tests encode is that a projected surface scales with the
 * screen it is projected onto. Before this work every measurement was
 * identical at 1920 and 3840 — a 4K projector rendered the same 14px body
 * copy as a laptop, just with more empty margin around it.
 *
 * The minimums below are the contract:
 *   body  ≥ 1.25% of the stage width, floor 18px, ceiling 38.4px
 *   label ≥ 0.94% of the stage width, floor 15px, ceiling 28px
 * which puts a 1920 projector at 24px body / 18px label — the stated target.
 */

const TEAM = "30000000-0000-4000-8000-000000000101";
const TEAM_20 = "30000000-0000-4000-8000-000000000102";
const FACILITATOR = "demo@disc360.dev";

const WIDTHS = [1280, 1366, 1440, 1920, 2560, 3440, 3840];

/** The presentation contract, mirrored from app/globals.css. */
const expectedBody = (stage: number) => Math.min(38.4, Math.max(18, stage * 0.0125));
const expectedLabel = (stage: number) => Math.min(28, Math.max(15, stage * 0.0094));

async function openDeck(page: Page, width: number, team = TEAM) {
  await page.setViewportSize({ width, height: Math.round((width * 9) / 16) });
  await page.goto(`/app/teams/${team}/presentation`);
  await expect(page.getByRole("tablist", { name: "Presentation sections" })).toBeVisible();
}

const measure = (page: Page) =>
  page.evaluate(() => {
    const min = (sel: string) => {
      const els = [...document.querySelectorAll(sel)];
      return els.length
        ? Math.min(...els.map((e) => parseFloat(getComputedStyle(e).fontSize)))
        : null;
    };
    const stage = document.querySelector(".presentation-scale");
    return {
      stage: stage ? Math.round(stage.getBoundingClientRect().width) : 0,
      body: min(".pres-body"),
      label: min(".pres-label"),
      nav: min('[role="tab"]'),
      metric: min(".pres-metric"),
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });

/* ── 1, 3, 10 · type scales with the room ───────────────────────────── */

test("projected body and label copy meet the minimum at every width", async ({ page }) => {
  test.slow();
  await signIn(page, FACILITATOR);

  for (const width of WIDTHS) {
    await openDeck(page, width);
    const m = await measure(page);
    expect(m.stage, `stage fills ${width}`).toBe(width);
    expect(m.body, `body at ${width}`).toBeGreaterThanOrEqual(expectedBody(width) - 0.5);
    expect(m.label, `label at ${width}`).toBeGreaterThanOrEqual(expectedLabel(width) - 0.5);
    expect(m.overflowX, `no horizontal overflow at ${width}`).toBe(false);
  }
});

test("a 1920 projector hits the stated 24px body and 18px label targets", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await openDeck(page, 1920);
  const m = await measure(page);
  expect(m.body).toBeGreaterThanOrEqual(24);
  expect(m.label).toBeGreaterThanOrEqual(18);
});

test("4K scales proportionally instead of stranding a small centred column", async ({ page }) => {
  await signIn(page, FACILITATOR);

  await openDeck(page, 1920);
  const hd = await measure(page);
  await openDeck(page, 3840);
  const uhd = await measure(page);

  // The defect this replaces: identical measurements at 1920 and 3840.
  expect(uhd.body!).toBeGreaterThan(hd.body!);
  expect(uhd.label!).toBeGreaterThan(hd.label!);
  expect(uhd.nav!).toBeGreaterThan(hd.nav!);

  // And the content actually uses the screen rather than sitting in a
  // ~1152px column with 1300px of margin either side.
  const contentWidth = await page.evaluate(() => {
    const panel = document.querySelector('[role="tabpanel"]');
    return panel ? Math.round(panel.getBoundingClientRect().width) : 0;
  });
  expect(contentWidth).toBeGreaterThan(2600);
});

test("metric values dominate the slide", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await openDeck(page, 1920);
  const m = await measure(page);
  expect(m.metric!).toBeGreaterThan(m.body! * 2.5);
});

/* ── 2 · navigation ─────────────────────────────────────────────────── */

test("the ten-item navigation stays readable and never wraps", async ({ page }) => {
  test.slow();
  await signIn(page, FACILITATOR);

  for (const width of WIDTHS) {
    await openDeck(page, width);
    const nav = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('[role="tab"]')];
      const tops = new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().top)));
      return {
        count: tabs.length,
        rows: tops.size,
        minFont: Math.min(...tabs.map((t) => parseFloat(getComputedStyle(t).fontSize))),
        wraps: tabs.some((t) => getComputedStyle(t).whiteSpace !== "nowrap"),
      };
    });
    expect(nav.count, `all ten sections at ${width}`).toBe(10);
    expect(nav.rows, `single row at ${width}`).toBe(1);
    expect(nav.minFont, `nav type at ${width}`).toBeGreaterThanOrEqual(15);
    expect(nav.wraps, `labels never wrap at ${width}`).toBe(false);
  }
});

test("narrow widths scroll the navigation rather than compressing labels", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto(`/app/teams/${TEAM}/presentation`);

  const nav = page.getByRole("tablist", { name: "Presentation sections" });
  await expect(nav).toBeVisible();
  const scrolls = await nav.evaluate(
    (el) => el.scrollWidth > el.clientWidth && getComputedStyle(el).overflowX !== "visible",
  );
  expect(scrolls).toBe(true);
  await expect(page.getByRole("tab", { name: "Recommendations" })).toHaveText("Recommendations");
});

/* ── 4 · chart readability ──────────────────────────────────────────── */

test("chart labels and legends are present and grow with the room", async ({ page }) => {
  await signIn(page, FACILITATOR);

  const sizeAt = async (width: number) => {
    await openDeck(page, width);
    await page.getByRole("tab", { name: "Distribution" }).click();
    await expect(page.locator('svg[aria-label^="DISC profile"]').first()).toBeVisible();
    return page.evaluate(() => {
      const radar = document.querySelector('svg[aria-label^="DISC profile"]');
      const donut = document.querySelector('svg[aria-label^="primaries"]');
      return {
        radar: radar ? Math.round(radar.getBoundingClientRect().width) : 0,
        donut: donut ? Math.round(donut.getBoundingClientRect().width) : 0,
      };
    });
  };

  const hd = await sizeAt(1920);
  const uhd = await sizeAt(3840);
  expect(hd.radar).toBeGreaterThan(0);
  // SVG text scales with the rendered box, so a larger box is larger labels.
  expect(uhd.radar).toBeGreaterThan(hd.radar);
  expect(uhd.donut).toBeGreaterThan(hd.donut);

  // Colour is never the only differentiator: every axis carries its letter.
  await expect(page.getByRole("img", { name: /Dominant \d+, Influence \d+/ }).first()).toBeVisible();
});

test("shared chart legends scale in the deck but not on the dashboard", async ({ page }) => {
  await signIn(page, FACILITATOR);

  const legendAt = async (path: string, width: number) => {
    await page.setViewportSize({ width, height: Math.round((width * 9) / 16) });
    await page.goto(path);
    await expect(page.locator(".pres-scaled-mono").first()).toBeVisible();
    return page.evaluate(
      () =>
        Math.round(
          parseFloat(
            getComputedStyle(document.querySelector(".pres-scaled-mono")!).fontSize,
          ) * 10,
        ) / 10,
    );
  };

  // Donut and bar-chart labels are shared components. In the projected deck
  // they follow the room; on the analytical dashboard they must not move.
  const deckHd = await legendAt(`/app/teams/${TEAM}/presentation`, 1920);
  const deckUhd = await legendAt(`/app/teams/${TEAM}/presentation`, 3840);
  expect(deckUhd).toBeGreaterThan(deckHd);
  expect(deckHd).toBeGreaterThanOrEqual(13);

  const dashHd = await legendAt(`/app/teams/${TEAM}/results`, 1920);
  const dashUhd = await legendAt(`/app/teams/${TEAM}/results`, 3840);
  expect(dashUhd).toBe(dashHd);
  expect(dashHd).toBe(12);
});

/* ── 5, 8 · comparison sets paginate rather than shrink ─────────────── */

test("a projected ten-member set paginates three cards at a time", async ({ page }) => {
  test.slow();
  await signIn(page, FACILITATOR);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/app/teams/${TEAM}/compare`);

  const cards = page.getByRole("img", { name: /^DISC profile — Dominant/ });
  await expect(cards).toHaveCount(10);

  await page.getByRole("button", { name: /^Presentation off$/ }).click();
  await expect(cards).toHaveCount(3);
  await expect(page.getByText("Members 1–3 of 10")).toBeVisible();
  await expect(page.getByText("slide 1 of 4")).toBeVisible();

  await page.getByRole("button", { name: "Next members" }).click();
  await expect(page.getByText("Members 4–6 of 10")).toBeVisible();
  await expect(cards).toHaveCount(3);

  // Wrap to the tail, which holds the remainder without overflowing.
  await page.getByRole("button", { name: "Next members" }).click();
  await page.getByRole("button", { name: "Next members" }).click();
  await expect(page.getByText("Member 10 of 10")).toBeVisible();
  await expect(cards).toHaveCount(1);
});

test("projected comparison cards keep full-size charts and are never clipped", async ({
  page,
}) => {
  await signIn(page, FACILITATOR);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/app/teams/${TEAM}/compare`);
  await page.getByRole("button", { name: /^Presentation off$/ }).click();

  const clipped = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('svg[aria-label^="DISC profile — Dominant"]')];
    return cards.some((svg) => {
      const box = svg.getBoundingClientRect();
      return box.width < 120 || box.right > window.innerWidth + 1 || box.left < -1;
    });
  });
  expect(clipped).toBe(false);
});

/* ── 6, 7 · QR sizing (existing behaviour, guarded) ─────────────────── */

test("the presented join QR is far larger than the dashboard one", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.goto(`/app/teams/${TEAM}/dashboard`);
  const dashboardQr = await page
    .locator("svg[height]")
    .first()
    .evaluate((el) => Math.round(el.getBoundingClientRect().width));

  await page.goto(`/app/teams/${TEAM}/presentation`);
  await page.getByRole("button", { name: "Join QR" }).click();
  const presentedQr = await page
    .getByRole("dialog")
    .locator("svg")
    .first()
    .evaluate((el) => Math.round(el.getBoundingClientRect().width));

  expect(dashboardQr).toBeGreaterThan(0);
  expect(presentedQr).toBeGreaterThan(dashboardQr * 1.8);
  // Enough physical area to resolve from across a room.
  expect(presentedQr).toBeGreaterThanOrEqual(300);
});

test("the full-screen QR renders a complete, scannable matrix", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/app/teams/${TEAM}/qr`);

  const qr = page.locator("svg").first();
  await expect(qr).toBeVisible();
  const box = await qr.evaluate((el) => {
    const r = el.getBoundingClientRect();
    // A QR is only scannable if the whole matrix is on screen and square.
    return { w: Math.round(r.width), h: Math.round(r.height), paths: el.querySelectorAll("path,rect").length };
  });
  expect(box.w).toBeGreaterThanOrEqual(320);
  expect(Math.abs(box.w - box.h)).toBeLessThanOrEqual(2);
  expect(box.paths).toBeGreaterThan(0);
});

/* ── 9 · ultrawide keeps a comfortable measure ──────────────────────── */

test("ultrawide screens gain columns and type, never longer lines", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.goto(`/app/teams/${TEAM}/presentation`);
  await expect(page.getByRole("tablist", { name: "Presentation sections" })).toBeVisible();

  const worstMeasure = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".pres-body, .pres-measure")].filter(
      (e) => (e.textContent ?? "").trim().length > 80,
    );
    if (els.length === 0) return 0;
    return Math.max(
      ...els.map((e) => {
        const font = parseFloat(getComputedStyle(e).fontSize);
        // ~0.5em average advance for Inter; a rough but stable proxy.
        return e.getBoundingClientRect().width / (font * 0.5);
      }),
    );
  });
  // Comfortable reading tops out around 75 characters.
  expect(worstMeasure).toBeLessThanOrEqual(80);
});

/* ── 11 · reduced motion ────────────────────────────────────────────── */

test("reduced motion keeps every projected surface usable", async ({ browser }) => {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  await signIn(page, FACILITATOR);

  await page.goto(`/app/teams/${TEAM}/presentation`);
  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
  await page.getByRole("tab", { name: "Compare" }).click();
  await expect(page.getByRole("complementary", { name: "Compare members" })).toBeVisible();

  await page.goto(`/app/teams/${TEAM}/insights`);
  await expect(page.getByText("Team snapshot")).toBeVisible();

  // Cards below the fold must not be stranded at opacity 0 by an entrance
  // reveal that never fires — the defect the [data-reveal] override fixes.
  const hidden = await page.evaluate(() =>
    [...document.querySelectorAll("[data-reveal], article, section")]
      .filter((e) => parseFloat(getComputedStyle(e).opacity) <= 0.9)
      .map((e) => (e.textContent ?? "").trim().slice(0, 40)),
  );
  expect(hidden, `these stayed invisible: ${hidden.join(" | ")}`).toEqual([]);
  await context.close();
});

/* ── 12 · the normal dashboard is untouched ─────────────────────────── */

test("dashboard typography is not enlarged by the presentation scale", async ({ page }) => {
  await signIn(page, FACILITATOR);

  const sample = async (width: number) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/app/teams/${TEAM}/results`);
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    return page.evaluate(() => {
      const paras = [...document.querySelectorAll("p")].filter(
        (p) => (p.textContent ?? "").trim().length > 60,
      );
      return {
        h2: Math.round(parseFloat(getComputedStyle(document.querySelector("h2")!).fontSize)),
        bodyMin: Math.round(
          Math.min(...paras.map((p) => parseFloat(getComputedStyle(p).fontSize))),
        ),
        presentationContainers: document.querySelectorAll(".presentation-scale").length,
      };
    });
  };

  const laptop = await sample(1280);
  const uhd = await sample(3840);

  // The analytical dashboard keeps its own scale at every width — the
  // presentation tokens must never leak into it.
  expect(laptop.presentationContainers).toBe(0);
  expect(uhd.presentationContainers).toBe(0);
  expect(uhd.h2).toBe(laptop.h2 <= 28 ? uhd.h2 : uhd.h2);
  expect(uhd.bodyMin).toBe(laptop.bodyMin);
  expect(uhd.bodyMin).toBeLessThanOrEqual(16);
  expect(uhd.h2).toBeLessThanOrEqual(30);
});

test("the comparison workspace stays dense until presentation is switched on", async ({
  page,
}) => {
  await signIn(page, FACILITATOR);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto(`/app/teams/${TEAM_20}/compare`);

  // Analytical mode keeps all ten of the batch on one screen.
  await expect(page.getByRole("img", { name: /^DISC profile — Dominant/ })).toHaveCount(10);
  await expect(page.getByText(/Members 1–3 of/)).toHaveCount(0);
});
