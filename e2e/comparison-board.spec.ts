import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * The executive comparison board.
 *
 * The complaint this replaces was specific: comparing eight to ten people
 * compressed the cards into a horizontal strip. So the assertions are equally
 * specific — the page never scrolls sideways at any width a workshop uses, the
 * cards are wide enough and typed large enough to read across a room, and the
 * summary arrives before the members rather than after them.
 */

const TEAM_10 = "30000000-0000-4000-8000-000000000103";
const TEAM_20 = "30000000-0000-4000-8000-000000000102";
const TEAM_5 = "30000000-0000-4000-8000-000000000104";
const FACILITATOR = "demo@disc360.dev";

const memberCards = (page: Page) =>
  page.getByRole("img", { name: /^DISC profile — Dominant/ });

/** Every width a laptop, monitor, ultrawide or 4K workshop actually uses. */
const WIDTHS = [1280, 1440, 1920, 2560, 3440, 3840];

async function board(page: Page, teamId: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: width > 2000 ? 1440 : 900 });
  await page.goto(`/app/teams/${teamId}/compare`);
  await expect(memberCards(page).first()).toBeVisible();
}

/* ── 1–6 · never sideways, at any width ─────────────────────────────── */

for (const width of WIDTHS) {
  test(`no horizontal scrolling at ${width}`, async ({ page }) => {
    await signIn(page, FACILITATOR);
    await board(page, TEAM_10, width);

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      // Any element wider than the viewport is what produces the sideways
      // drag, so the check looks for the cause, not just the symptom.
      const widest = [...document.querySelectorAll("*")]
        .map((node) => {
          const box = node.getBoundingClientRect();
          return { right: box.right, left: box.left };
        })
        .filter((box) => box.right > window.innerWidth + 1 || box.left < -1).length;
      return {
        documentScrolls: doc.scrollWidth > doc.clientWidth + 1,
        overflowing: widest,
      };
    });

    expect(overflow.documentScrolls).toBe(false);
    expect(overflow.overflowing).toBe(0);
  });
}

/* ── 7–9 · columns are added, cards never shrink ────────────────────── */

test("the board holds at most four columns, and three on a 4K screen", async ({ page }) => {
  await signIn(page, FACILITATOR);

  const columnsAt = async (width: number, height: number) => {
    await page.setViewportSize({ width, height });
    await page.goto(`/app/teams/${TEAM_10}/compare`);
    await expect(memberCards(page).first()).toBeVisible();
    return page.evaluate(() => {
      const grid = document.querySelector(".comparison-grid");
      if (!grid) return 0;
      return getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
    });
  };

  expect(await columnsAt(1920, 1080)).toBe(3);
  expect(await columnsAt(2560, 1440)).toBe(3);
  // 4K is a tall screen: three large cards, not four smaller ones.
  expect(await columnsAt(3840, 2160)).toBe(3);
  // Ultrawide is horizontal room, and earns the fourth column.
  expect(await columnsAt(3440, 1440)).toBe(4);
});

test("a card gets wider on a bigger screen, never narrower", async ({ page }) => {
  await signIn(page, FACILITATOR);

  const cardWidth = async (width: number, height: number) => {
    await page.setViewportSize({ width, height });
    await page.goto(`/app/teams/${TEAM_10}/compare`);
    await expect(memberCards(page).first()).toBeVisible();
    return page.evaluate(() => {
      const card = document.querySelector(".comparison-grid > *");
      return card ? Math.round(card.getBoundingClientRect().width) : 0;
    });
  };

  const laptop = await cardWidth(1280, 900);
  const monitor = await cardWidth(1920, 1080);
  const uhd = await cardWidth(3840, 2160);

  expect(monitor).toBeGreaterThan(laptop);
  expect(uhd).toBeGreaterThan(monitor);
  // The old strip put ten cards at ~240px. Nothing on this board is that thin.
  expect(laptop).toBeGreaterThan(320);
});

test("every card is a card: rounded, shadowed, on its own", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await board(page, TEAM_5, 1920);

  const style = await page.evaluate(() => {
    const card = document.querySelector(".comparison-grid > *") as HTMLElement;
    const s = getComputedStyle(card);
    return { radius: parseFloat(s.borderTopLeftRadius), shadow: s.boxShadow };
  });
  expect(style.radius).toBeGreaterThan(8);
  expect(style.shadow).not.toBe("none");
});

/* ── 10–12 · readable across a room ─────────────────────────────────── */

test("body, names and bullets meet the stated reading minimums", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await board(page, TEAM_10, 1920);

  const type = await page.evaluate(() => {
    const px = (selector: string) => {
      const node = document.querySelector(selector);
      return node ? parseFloat(getComputedStyle(node).fontSize) : 0;
    };
    const card = document.querySelector(".comparison-grid > *")!;
    const bullet = card.querySelector("ul li");
    return {
      name: px(".comparison-grid h3"),
      bullet: bullet ? parseFloat(getComputedStyle(bullet).fontSize) : 0,
      heading: px(".comparison-board h2"),
    };
  });

  expect(type.name).toBeGreaterThanOrEqual(24);
  expect(type.bullet).toBeGreaterThanOrEqual(18);
  expect(type.heading).toBeGreaterThanOrEqual(24);
  expect(type.heading).toBeLessThanOrEqual(36);
});

test("the radar is substantially larger than the old tile chart", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await board(page, TEAM_10, 1920);

  const size = await memberCards(page)
    .first()
    .evaluate((node) => Math.round(node.getBoundingClientRect().width));
  // The tile chart capped at 200px.
  expect(size).toBeGreaterThan(240);
});

/* ── 13–15 · reading flow and the pinned selector ───────────────────── */

test("the summary is read before the members, and observations after", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await board(page, TEAM_10, 1920);

  const order = await page.evaluate(() => {
    const top = (selector: string) => {
      const node = document.querySelector(selector);
      return node ? node.getBoundingClientRect().top + window.scrollY : Infinity;
    };
    return {
      summary: top('[aria-label="Set summary"]'),
      grid: top(".comparison-grid"),
      observations: top('[aria-label="Overall observations"]'),
    };
  });

  expect(order.summary).toBeLessThan(order.grid);
  expect(order.grid).toBeLessThan(order.observations);
});

test("the selector stays pinned while the board scrolls", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await board(page, TEAM_20, 1920);

  const tray = page.getByRole("complementary", { name: "Compare members" });
  const before = await tray.boundingBox();

  await page.evaluate(() => window.scrollTo({ top: 1600, behavior: "instant" }));
  await page.waitForFunction(() => window.scrollY > 400);
  const after = await tray.boundingBox();

  // It travels up to the pinned offset and stops there — rather than
  // scrolling away with the board, which is what it used to do.
  expect(after?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect(after?.y ?? 999).toBeLessThan(64);
  expect(after?.y ?? 0).toBeLessThan(before?.y ?? 0);
  await expect(tray).toBeInViewport();

  // Still usable where it landed: the Compare button has not been pushed off.
  await expect(tray.getByRole("button", { name: "Compare", exact: true })).toBeInViewport();
});

test("the selector filters by sub team without leaving the page", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await board(page, TEAM_20, 1920);

  const tray = page.getByRole("complementary", { name: "Compare members" });
  const select = tray.getByLabel("Sub Team");
  await expect(select).toBeVisible();

  const options = await select.locator("option").allTextContents();
  expect(options[0]).toBe("All sub teams");
  expect(options.length).toBeGreaterThan(1);

  await select.selectOption({ index: 1 });
  await expect(tray.getByRole("checkbox").first()).toBeVisible();
});

/* ── 16 · presentation mode is untouched ────────────────────────────── */

test("presentation mode still paginates three at a time", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await board(page, TEAM_10, 1920);

  await page.getByRole("button", { name: /^Presentation off$/ }).click();
  await expect(memberCards(page)).toHaveCount(3);
  await expect(page.getByText("Members 1–3 of 10")).toBeVisible();
  await expect(page.getByText("slide 1 of 4")).toBeVisible();
});

