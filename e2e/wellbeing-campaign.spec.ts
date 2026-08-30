import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, submitSignIn } from "./helpers";

/**
 * The Wellbeing Pulse campaign workspace, and the product boundary around it.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THIS SPEC IS FOR.
 *
 * A wellbeing campaign is stored as a team. That was the right call — a
 * campaign has members, an organisation, a join token and a facilitator — and
 * it is also why the campaign once rendered the full DISC team dashboard,
 * Compare Members included. Unit tests hold the rules at the source level;
 * this spec holds them where a facilitator actually is: in a browser, on a
 * URL they could type.
 *
 * It needs a wellbeing campaign to exist. `npx supabase db reset` alone does
 * not create one — that is `scripts/seed-wellbeing-demo.sql`, which is local
 * only — so the spec DISCOVERS the campaign and skips when there is none,
 * rather than failing a build for a fixture that was never installed.
 * ─────────────────────────────────────────────────────────────────────
 */

const FACILITATOR = "demo@disc360.dev";

/** A plain participant: no team administration, no wellbeing role. */
const PARTICIPANT = "solo@disc360.dev";

async function signInTo(page: Page, email: string, next: string): Promise<void> {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  /*
   * `submitSignIn` rather than a bare click.
   *
   * Against a production build the form is server-rendered and looks
   * interactive before React has attached its submit handler; a click
   * dispatched inside that window is swallowed and the page simply stays on
   * /sign-in. `helpers.ts` documents the race and retries through it, and this
   * spec had its own single-click copy that did not — so an acceptance run
   * failed "a plain participant cannot open a campaign workspace by URL" with
   * a 90s timeout in the HELPER, before the privacy assertion ran at all.
   *
   * A privacy test that fails for a hydration race is a privacy test people
   * learn to re-run rather than read.
   */
  await submitSignIn(page, `**${next.split("?")[0]}**`);
}

/**
 * The first wellbeing campaign this facilitator can open, or null.
 *
 * "Create campaign" points at /campaigns/new and sits ABOVE the campaign list
 * in the DOM, so a bare `.first()` finds the button rather than a campaign and
 * every test that depends on one silently skips. The id has to look like a
 * campaign id, not merely like a campaigns URL.
 */
async function findCampaign(page: Page): Promise<string | null> {
  await page.goto("/wellbeing/admin/pilot");
  const hrefs = await page.locator('a[href^="/wellbeing/admin/campaigns/"]').evaluateAll(
    (links) => links.map((link) => link.getAttribute("href") ?? ""),
  );
  for (const href of hrefs) {
    const id = href.split("/").pop() ?? "";
    if (/^[0-9a-f-]{36}$/i.test(id)) return id;
  }
  return null;
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    overflow.scrollWidth,
    `page scrolls horizontally at ${overflow.clientWidth}px`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

/* ── the product boundary ───────────────────────────────────────────── */

test("a wellbeing campaign refuses to render the DISC team dashboard", async ({ page }) => {
  await signInTo(page, FACILITATOR, "/app");
  const campaign = await findCampaign(page);
  test.skip(campaign === null, "no wellbeing campaign seeded");

  // The URL a facilitator would reach a DISC team by. It must not serve the
  // DISC experience for a campaign — Compare Members above all, which is a
  // named-person comparison a wellbeing campaign must never offer.
  await page.goto(`/app/teams/${campaign}/dashboard`);
  await page.waitForURL(`**/wellbeing/admin/campaigns/${campaign}**`);

  await expect(page.getByRole("link", { name: "Compare Members" })).toHaveCount(0);
  await expect(page.getByText("DISC Behaviour Assessment")).toHaveCount(0);
});

test("a wellbeing campaign is absent from the DISC teams list", async ({ page }) => {
  await signInTo(page, FACILITATOR, "/app");
  const campaign = await findCampaign(page);
  test.skip(campaign === null, "no wellbeing campaign seeded");

  await page.goto("/app/teams");
  await expect(page.locator(`a[href*="${campaign}"]`)).toHaveCount(0);
});

/* ── the campaign workspace ─────────────────────────────────────────── */

test("the campaign header names the questionnaire, the wave and the status", async ({ page }) => {
  await signInTo(page, FACILITATOR, "/app");
  const campaign = await findCampaign(page);
  test.skip(campaign === null, "no wellbeing campaign seeded");

  await page.goto(`/wellbeing/admin/campaigns/${campaign}`);
  await expect(page.getByText("Wellbeing Pulse campaign")).toBeVisible();
  await expect(page.getByText(/Wave \d+ · \w+ \d{4}/)).toBeVisible();
  // The lifecycle vocabulary a facilitator actually operates. "At capacity"
  // is deliberately absent: capacity is a fact reported BESIDE the state, not
  // a state with no action attached to it.
  await expect(page.getByText(/^(Open|Paused|Draft|Closed|Archived)$/).first()).toBeVisible();
});

test("the campaign says whether people can join, and offers the control", async ({ page }) => {
  await signInTo(page, FACILITATOR, "/app");
  const campaign = await findCampaign(page);
  test.skip(campaign === null, "no wellbeing campaign seeded");

  await page.goto(`/wellbeing/admin/campaigns/${campaign}`);
  const status = page.getByRole("region", { name: "Campaign status" });
  await expect(status).toBeVisible();

  // Whatever state it is in, exactly one of these sentences is true and shown.
  await expect(
    status.getByText(
      /Participants can join using the QR code or link\.|New participants cannot currently join\.|This campaign has ended\.|Not yet open\.|Archived and no longer running\./,
    ),
  ).toBeVisible();

  // And there is always something to press — except when archived, which is
  // the one state with nothing left to do.
  const archived = await status.getByRole("heading", { name: "Campaign archived" }).count();
  if (archived === 0) {
    await expect(status.getByRole("button").first()).toBeVisible();
  }
});

test("every campaign tab opens for a facilitator who holds reporting", async ({ page }) => {
  await signInTo(page, FACILITATOR, "/app");
  const campaign = await findCampaign(page);
  test.skip(campaign === null, "no wellbeing campaign seeded");

  await page.goto(`/wellbeing/admin/campaigns/${campaign}`);
  const reporting = await page.getByRole("link", { name: "Analytics", exact: true }).count();
  test.skip(reporting === 0, "this facilitator holds no wellbeing role");

  // Driven by the nav itself rather than a hand-written list. A tab written
  // into the nav and omitted from a test list is exactly how Presentation
  // came to point at a route that did not exist.
  const tabs = await page
    .locator('nav[aria-label="Campaign"] a')
    .evaluateAll((links) =>
      links.map((link) => ({
        label: link.textContent?.trim() ?? "",
        href: link.getAttribute("href") ?? "",
      })),
    );
  expect(tabs.length, "the campaign nav rendered no tabs").toBeGreaterThan(5);

  for (const tab of tabs) {
    const response = await page.goto(tab.href);
    expect(response?.status(), `${tab.label} (${tab.href}) did not render`).toBeLessThan(400);
    await expectNoHorizontalScroll(page);
  }
});

/* ── the facilitator sees status, never a score ─────────────────────── */

test("the roster shows completion state and no individual result", async ({ page }) => {
  await signInTo(page, FACILITATOR, "/app");
  const campaign = await findCampaign(page);
  test.skip(campaign === null, "no wellbeing campaign seeded");

  await page.goto(`/wellbeing/admin/campaigns/${campaign}`);
  await expect(page.getByRole("heading", { name: "Participants" })).toBeVisible();

  // Completion status is present...
  await expect(page.getByText(/Completed|Not started|In progress/).first()).toBeVisible();

  // ...and it grants no route to anybody's result or report.
  await expect(page.locator('a[href*="/wellbeing/result/"]')).toHaveCount(0);
  await expect(page.locator('a[href*="/api/wellbeing/report/"]')).toHaveCount(0);
});

/* ── compare is cohorts, never people ───────────────────────────────── */

test("Compare offers cohort dimensions and no person", async ({ page }) => {
  await signInTo(page, FACILITATOR, "/app");
  const campaign = await findCampaign(page);
  test.skip(campaign === null, "no wellbeing campaign seeded");

  const response = await page.goto(`/wellbeing/admin/campaigns/${campaign}/compare`);
  test.skip((response?.status() ?? 500) >= 400, "reporting not available to this account");

  const body = await page.locator("body").innerText();
  test.skip(
    body.includes("Reporting is separately governed"),
    "this facilitator holds no wellbeing role",
  );

  for (const dimension of ["Department / Function", "Team", "Work Location", "Office Location"]) {
    await expect(page.getByRole("link", { name: dimension })).toBeVisible();
  }
  expect(body).not.toContain("Compare Members");
  expect(body).toContain("never ordered by their figures");
});

/* ── the escape route is authorised, and only there ─────────────────── */

test("a facilitator gets a workspace switcher, not a branded link", async ({ page }) => {
  await signInTo(page, FACILITATOR, "/app");
  await page.goto("/wellbeing");

  // Wellbeing Pulse is its own product and its chrome carries its own name.
  // The crossing is still there for somebody who holds scope in the other
  // workspace — it is a switcher, closed until opened.
  const switcher = page.getByLabel("Switch workspace");
  await expect(switcher).toBeVisible();

  // Closed by default: nothing in the chrome a participant or a facilitator
  // reads at a glance carries the other product's brand.
  const other = page.locator('header a[href="/app"]');
  await expect(other).not.toBeVisible();

  // And it is a real crossing once opened.
  await switcher.click();
  await expect(other).toBeVisible();
  await expect(other).toHaveText(/DISC360/);
});

test("a plain participant gets no route into DISC360", async ({ page }) => {
  await signInTo(page, PARTICIPANT, "/wellbeing");
  await expect(page.getByRole("link", { name: /DISC360/ })).toHaveCount(0);
  await expect(page.locator('a[href="/app"]')).toHaveCount(0);
});

test("a plain participant cannot open a campaign workspace by URL", async ({ page }) => {
  await signInTo(page, FACILITATOR, "/app");
  const campaign = await findCampaign(page);
  test.skip(campaign === null, "no wellbeing campaign seeded");

  await page.context().clearCookies();
  await signInTo(page, PARTICIPANT, "/wellbeing");

  const response = await page.goto(`/wellbeing/admin/campaigns/${campaign}`);
  const status = response?.status() ?? 0;
  const url = page.url();
  expect(
    status >= 400 || !url.includes(`/wellbeing/admin/campaigns/${campaign}`),
    "a participant reached a campaign workspace",
  ).toBeTruthy();
});

/* ── presentation carries aggregates and nothing else ───────────────── */

test("presentation mode shows no participant and no navigation", async ({ page }) => {
  await signInTo(page, FACILITATOR, "/app");
  const campaign = await findCampaign(page);
  test.skip(campaign === null, "no wellbeing campaign seeded");

  const response = await page.goto(`/wellbeing/present/${campaign}`);
  test.skip((response?.status() ?? 500) >= 400, "presentation not available to this account");

  const body = await page.locator("body").innerText();
  test.skip(
    body.includes("Presentation unavailable"),
    "this facilitator holds no wellbeing role",
  );

  // The projected shell carries no product navigation at all.
  await expect(page.getByRole("link", { name: /Open DISC360|DISC360 →/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "My History" })).toHaveCount(0);

  // And no participant name from the roster reaches a slide.
  expect(body).not.toContain("Demo Participant");

  // It is a deck: keyboard-driven, with a slide count.
  await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible();
  await page.keyboard.press("ArrowRight");

  /*
   * Asserted by REACHABILITY, not by position.
   *
   * This used to expect "Participation and coverage" on the second slide, so
   * inserting the room slide — the QR people scan, with live counts beside it
   * — broke a test about privacy for a reason that had nothing to do with
   * privacy. What matters is that the deck advances and that the participation
   * slide exists somewhere in it.
   */
  await expect(page.getByText(/\d+ \/ \d+/)).toContainText(/^(?!1 \/)/);

  const headings: string[] = [];
  for (let step = 0; step < 12; step += 1) {
    headings.push(await page.locator("main").innerText());
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
  }
  // `innerText` returns CSS-transformed text, and the deck's eyebrows are
  // uppercased in the stylesheet — so these are matched case-insensitively
  // rather than against the casing that happens to be in the source.
  const deck = headings.join("\n");
  expect(deck, `the deck must reach participation and coverage. Deck was:\n${deck}`).toMatch(
    /participation and coverage/i,
  );

  // A campaign that is OPEN puts the code people scan on a slide of its own.
  expect(deck, "an open campaign projects its join code").toMatch(/scan to join/i);

  // And nowhere in the whole deck does a participant appear.
  expect(deck).not.toContain("Demo Participant");
  expect(deck).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
});

/* ── the DISC dashboard entry is a workspace, not an assessment ─────── */

test("the DISC dashboard offers Wellbeing as a separate workspace", async ({ page }) => {
  await signInTo(page, FACILITATOR, "/app");
  const entry = page.locator('[aria-labelledby="wellbeing-workspace-heading"]');
  test.skip((await entry.count()) === 0, "this account holds no wellbeing scope");

  await expect(entry.getByText("Separate workspace")).toBeVisible();
  await expect(entry.getByRole("link", { name: "Open Wellbeing" })).toBeVisible();
  await expect(entry).toContainText("Organisational wellbeing measurement");
});

/* ── the management surfaces fit the screens they are used on ───────── */

for (const width of [1440, 1920]) {
  test(`the campaign workspace fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signInTo(page, FACILITATOR, "/app");
    const campaign = await findCampaign(page);
    test.skip(campaign === null, "no wellbeing campaign seeded");

    for (const path of ["", "/compare", "/trends", "/settings"]) {
      await page.goto(`/wellbeing/admin/campaigns/${campaign}${path}`);
      await expectNoHorizontalScroll(page);
    }
  });
}

for (const width of [360, 390, 430]) {
  test(`the campaign workspace fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await signInTo(page, FACILITATOR, "/app");
    const campaign = await findCampaign(page);
    test.skip(campaign === null, "no wellbeing campaign seeded");

    for (const path of ["", "/settings"]) {
      await page.goto(`/wellbeing/admin/campaigns/${campaign}${path}`);
      await expectNoHorizontalScroll(page);
    }
  });
}
