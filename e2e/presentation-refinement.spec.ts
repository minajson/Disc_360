import { expect, test } from "@playwright/test";
import { signIn, signOut } from "./helpers";

/**
 * Presentation refinement: terminology, pairing badges, and boardroom type.
 *
 * These are the checks the refinement asked for, written so they keep holding:
 * "Department" cannot creep back into a label, a pairing cannot lose its
 * badges, the divergence panel cannot regain a technical string, and the
 * insight surface cannot drift back under the sizes a wall needs.
 */

const TEAM_10 = "30000000-0000-4000-8000-000000000103";
const ENG_TEAM = "30000000-0000-4000-8000-000000000002";
const TEAM_20 = "30000000-0000-4000-8000-000000000102";
const FACILITATOR = "demo@disc360.dev";

const WIDTHS = [1280, 1366, 1440, 1920, 2560, 3440, 3840];

/* ── 1–3 · Sub Team terminology ─────────────────────────────────────── */

test("the comparison selector says Sub Team, not Department", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_20}/compare`);

  const tray = page.getByRole("complementary", { name: "Compare members" });
  await expect(tray.getByText("Sub Team", { exact: true })).toBeVisible();
  await expect(tray.getByRole("option", { name: "All sub teams" })).toBeAttached();
  await expect(tray.getByPlaceholder(/sub team/i)).toBeVisible();

  await expect(page.getByRole("button", { name: "By sub team" })).toBeVisible();
  await expect(page.getByText("Department", { exact: true })).toHaveCount(0);
});

test("the insights surface groups by sub team", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_20}/insights`);

  await expect(page.getByText("Sub teams in this team")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Where the sub teams differ" })).toBeVisible();
  await expect(page.getByText(/departments/i)).toHaveCount(0);
});

test("the registration form asks for a Sub Team and requires it", async ({ page }) => {
  // Reached through the real invite link, which is the participant's own path.
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${ENG_TEAM}/dashboard`);
  const href = await page
    .getByRole("link", { name: "Open participant join page" })
    .first()
    .getAttribute("href");
  expect(href, "the dashboard offers a participant join link").toBeTruthy();

  // Signed out first: a facilitator following their own join link is already a
  // member and gets sent back to the app, so the form never renders for them.
  await signOut(page);

  // Strip the origin: the seeded link may carry a public host.
  await page.goto(href!.replace(/^https?:\/\/[^/]+/, ""));
  const field = page.getByLabel("Sub Team");
  await expect(field).toBeVisible();
  await expect(field).toHaveAttribute("required", "");
  await expect(page.getByLabel("Department")).toHaveCount(0);
});

/* ── 4–5 · pairing badges ───────────────────────────────────────────── */

test("every pairing carries a DISC badge beside each name", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_10}/presentation`);
  await page.getByRole("tab", { name: "Pairings" }).click();

  const panel = page.getByRole("tabpanel", { name: "Pairings" });
  await expect(panel.getByText("Complementary pairings")).toBeVisible();

  // Two badges per pairing row, in both sections.
  const rows = await panel.evaluate(() => {
    const titles = ["Complementary pairings", "High-friction pairings"];
    return titles.map((title) => {
      const panels = [...document.querySelectorAll(".paper-card")];
      const section = panels.find((p) => p.textContent?.includes(title));
      const pairRows = [...(section?.querySelectorAll("div.flex.flex-col.gap-1") ?? [])];
      return pairRows.map((row) => row.querySelectorAll("span[title]").length);
    });
  });

  for (const section of rows) {
    expect(section.length, "each section lists pairings").toBeGreaterThan(0);
    for (const badges of section) expect(badges).toBe(2);
  }
});

test("a badge shows the display letter and its own DISC colour", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_10}/presentation`);
  await page.getByRole("tab", { name: "Pairings" }).click();

  await expect(
    page.getByRole("tabpanel", { name: "Pairings" }).getByText("Complementary pairings"),
  ).toBeVisible();

  const badges = await page.evaluate(() => {
    const panel = [...document.querySelectorAll(".paper-card")].find((p) =>
      p.textContent?.includes("Complementary pairings"),
    )!;
    return [...panel.querySelectorAll("span[title]")].slice(0, 8).map((b) => ({
      letter: (b.textContent ?? "").trim().charAt(0),
      colour: getComputedStyle(b).color,
      radius: parseFloat(getComputedStyle(b).borderTopLeftRadius),
    }));
  });

  expect(badges.length).toBeGreaterThan(0);
  for (const badge of badges) {
    // A never C: the internal letter must not reach a screen.
    expect(["D", "I", "S", "A"]).toContain(badge.letter);
    expect(badge.colour).not.toBe("rgb(0, 0, 0)");
    expect(badge.radius).toBeGreaterThan(10);
  }
});

/* ── 6 · no implementation values on a projected screen ─────────────── */

test("the divergence panel shows dimensions and bars, nothing technical", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.goto(`/app/teams/${TEAM_10}/compare`);

  const panel = page.getByRole("region", { name: "Overall observations" });
  await expect(panel).toBeVisible();

  const text = (await panel.innerText()).trim();
  // No escaped unicode, no point strings, no numeric ranges.
  expect(text).not.toMatch(/\\u[0-9a-f]{4}/i);
  expect(text).not.toMatch(/\bpts\b/);
  expect(text).not.toMatch(/\d+\s*[–-]\s*\d+/);

  // The four dimensions, and the bars, remain.
  for (const label of ["Dominant", "Influence", "Stable", "Analytical"]) {
    await expect(panel.getByText(label, { exact: true })).toBeVisible();
  }
});

/* ── 7–8 · boardroom typography ─────────────────────────────────────── */

test("insight typography meets the boardroom minimums", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/app/teams/${TEAM_20}/insights`);
  await page.getByRole("region", { name: "Insight cards" }).waitFor();

  const type = await page.evaluate(() => {
    const px = (el: Element | null | undefined) =>
      el ? parseFloat(getComputedStyle(el).fontSize) : 0;
    const card = document.querySelector('[aria-label="Insight cards"]')!.firstElementChild!;
    const header = card.querySelector("header")!;
    return {
      title: px(card.querySelector("h3")),
      observation: px(card.querySelector("p")),
      bullet: px(card.querySelector("ul li")),
      category: px(header.firstElementChild),
      // The signal wrapper carries the title; the sized label is its last span.
      signal: px(header.lastElementChild?.lastElementChild),
    };
  });

  expect(type.title, "insight title").toBeGreaterThanOrEqual(32);
  expect(type.title, "insight title stays inside the stated range").toBeLessThanOrEqual(36);
  expect(type.observation, "body").toBeGreaterThanOrEqual(20);
  expect(type.bullet, "bullets").toBeGreaterThanOrEqual(20);
  expect(type.category, "section label").toBeGreaterThanOrEqual(18);
  expect(type.signal, "signal badge").toBeGreaterThanOrEqual(18);
});

test("evidence chips are readable once disclosed", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/app/teams/${TEAM_20}/insights`);
  await page.getByRole("button", { name: "Show evidence and questions" }).first().click();

  const chip = await page.evaluate(() => {
    const card = document.querySelector('[aria-label="Insight cards"]')!.firstElementChild!;
    const node = [...card.querySelectorAll("span")].find((s) =>
      s.className.includes("ins-chip") && /average|share|index|gap/i.test(s.textContent ?? ""),
    );
    return node ? parseFloat(getComputedStyle(node).fontSize) : 0;
  });
  expect(chip, "evidence chip").toBeGreaterThanOrEqual(18);
});

/* ── 9 · every workshop width, both surfaces ────────────────────────── */

for (const width of WIDTHS) {
  test(`insights and compare never clip sideways at ${width}`, async ({ page }) => {
    await signIn(page, FACILITATOR);
    // 4K is 16:9; the tall viewport matters because the fourth comparison
    // column is reserved for genuinely ultrawide screens.
    await page.setViewportSize({ width, height: width >= 3440 ? 2160 : 900 });

    for (const path of [`/app/teams/${TEAM_10}/compare`, `/app/teams/${TEAM_20}/insights`]) {
      await page.goto(path);
      await page.waitForSelector(".paper-card");
      const clipped = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          sideways: doc.scrollWidth > doc.clientWidth + 1,
          escaped: /\\u[0-9a-f]{4}/i.test(document.body.innerText),
        };
      });
      expect(clipped.sideways, `${path} at ${width}`).toBe(false);
      expect(clipped.escaped, `escaped unicode on ${path}`).toBe(false);
    }
  });
}
