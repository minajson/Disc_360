import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD } from "./helpers";

/**
 * Wellbeing Pulse journey.
 *
 * Covers the three things that are hard to hold together by review alone: the
 * standalone shell never leaks DISC360 to a participant, the participant
 * journey works at every phone width the brief names, and the privacy
 * boundary is enforced by the server rather than by a hidden menu item.
 *
 * Requires the local Supabase stack seeded with an ACTIVE questionnaire —
 * `scripts/seed-wellbeing-smoke.sql`. Where no version is active the module is
 * deliberately closed, and the flow tests skip rather than fail: "not licensed
 * yet" is a correct product state, not a broken build.
 */

/** Every width the brief requires the participant flow to work at. */
const PHONE_WIDTHS = [320, 360, 375, 390, 412, 430];

/**
 * A plain participant: no team administration, no wellbeing role.
 *
 * Deliberately NOT demo@, which holds team-admin scope and may be granted a
 * wellbeing role in a seeded environment — a boundary test whose subject can
 * acquire the very privilege under test proves nothing.
 */
const PARTICIPANT = "solo@disc360.dev";

async function signInTo(page: Page, email: string, next: string): Promise<void> {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`**${next.split("?")[0]}**`);
}

/** True when a licensed questionnaire is live in this environment. */
async function questionnaireIsOpen(page: Page): Promise<boolean> {
  return page.getByRole("button", { name: "Start my Wellbeing Pulse" }).isVisible();
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  expect(
    overflow.scrollWidth,
    `page scrolls horizontally at ${overflow.clientWidth}px`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

/* ── the shell is standalone ────────────────────────────────────────── */

test("the participant shell carries no DISC360 navigation", async ({ page }) => {
  await signInTo(page, "demo@disc360.dev", "/wellbeing");

  await expect(page.getByRole("link", { name: "Wellbeing Pulse" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Wellbeing Pulse" })).toBeVisible();

  // None of the other product areas may appear.
  for (const forbidden of [
    "DISC Behaviour",
    "Focus Pulse",
    "Combined",
    "Take Assessment",
    "My Teams",
    "Participants",
    "Platform Admin",
  ]) {
    await expect(page.getByRole("link", { name: forbidden, exact: true })).toHaveCount(0);
  }
});

test("the browser tab is branded Wellbeing Pulse, not DISC360", async ({ page }) => {
  await signInTo(page, "demo@disc360.dev", "/wellbeing");
  await expect(page).toHaveTitle(/Wellbeing Pulse$/);
  await expect(page).not.toHaveTitle(/DISC360/);
});

test("the disclaimer and privacy line appear on every wellbeing surface", async ({ page }) => {
  await signInTo(page, "demo@disc360.dev", "/wellbeing");
  for (const path of ["/wellbeing", "/wellbeing/history"]) {
    await page.goto(path);
    await expect(
      page.getByText("GHQ-12 is a screening questionnaire and does not provide a diagnosis.").first(),
    ).toBeVisible();
    await expect(page.getByText(/not visible to your manager/i).first()).toBeVisible();
  }
});

/* ── consent ────────────────────────────────────────────────────────── */

test("declining consent records nothing and says so", async ({ page }) => {
  await signInTo(page, "demo@disc360.dev", "/wellbeing");
  test.skip(!(await questionnaireIsOpen(page)), "no licensed questionnaire in this environment");

  await page.getByRole("link", { name: "I would rather not take part" }).click();
  await page.waitForURL("**/wellbeing/declined");
  await expect(page.getByText(/Nothing has been recorded/i)).toBeVisible();
});

test("the pulse cannot start without explicit consent", async ({ page }) => {
  await signInTo(page, "demo@disc360.dev", "/wellbeing");
  test.skip(!(await questionnaireIsOpen(page)), "no licensed questionnaire in this environment");

  await page.getByRole("button", { name: "Start my Wellbeing Pulse" }).click();
  // The consent box is `required`, so the browser blocks submission.
  await expect(page).toHaveURL(/\/wellbeing(\?.*)?$/);
});

/* ── Office Location is conditional ─────────────────────────────────── */

test("Office Location appears only for office-based work", async ({ page }) => {
  await signInTo(page, "demo@disc360.dev", "/wellbeing");
  test.skip(!(await questionnaireIsOpen(page)), "no licensed questionnaire in this environment");

  await page.locator("input[name=consent]").check();
  await page.getByRole("button", { name: "Start my Wellbeing Pulse" }).click();
  await page.waitForURL("**/wellbeing/assessment/**");

  // Department / Function is populated from the governed lookup, not hard-coded.
  const department = page.getByLabel("Department / Function");
  await expect(department.locator("option")).not.toHaveCount(1);

  await expect(page.getByLabel("Office Location")).toHaveCount(0);
  await page.getByRole("radio", { name: "Office Based" }).check();
  await expect(page.getByLabel("Office Location")).toBeVisible();
  await page.getByRole("radio", { name: "Field Based" }).check();
  await expect(page.getByLabel("Office Location")).toHaveCount(0);
});

test("the form never calls Department / Function a Sub Team", async ({ page }) => {
  await signInTo(page, "demo@disc360.dev", "/wellbeing");
  test.skip(!(await questionnaireIsOpen(page)), "no licensed questionnaire in this environment");

  await page.locator("input[name=consent]").check();
  await page.getByRole("button", { name: "Start my Wellbeing Pulse" }).click();
  await page.waitForURL("**/wellbeing/assessment/**");
  await expect(page.getByText(/sub team/i)).toHaveCount(0);
});

/* ── responsiveness ─────────────────────────────────────────────────── */

for (const width of PHONE_WIDTHS) {
  test(`the participant surfaces fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await signInTo(page, "demo@disc360.dev", "/wellbeing");

    for (const path of ["/wellbeing", "/wellbeing/history"]) {
      await page.goto(path);
      await expect(page.getByRole("banner")).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
  });
}

test("the analytics workspace fits on a tablet and a presentation screen", async ({ page }) => {
  // Sign in once: /sign-in redirects an authenticated session straight to the
  // product, so re-running the sign-in form inside the loop would hang.
  await signInTo(page, "demo@disc360.dev", "/wellbeing");

  for (const size of [
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size);
    await page.goto("/wellbeing/analytics");
    await expectNoHorizontalScroll(page);
  }
});

/* ── the privacy boundary is server-side ────────────────────────────── */

test("a participant without a wellbeing role cannot reach analytics by URL", async ({ page }) => {
  await signInTo(page, PARTICIPANT, "/wellbeing");

  // The nav does not offer it…
  await expect(page.getByRole("link", { name: "Analytics" })).toHaveCount(0);

  // …and hiding the link is not the control. Typing the URL is refused too.
  await page.goto("/wellbeing/analytics");
  await expect(page.getByText(/do not hold a Wellbeing Pulse analytics role/i)).toBeVisible();
  await expect(page.getByText(/Median GHQ/i)).toHaveCount(0);
  await expect(page.getByText(/Score distribution/i)).toHaveCount(0);
});

test("an ordinary participant sees no route back into DISC360", async ({ page }) => {
  await signInTo(page, PARTICIPANT, "/wellbeing");
  await expect(page.getByRole("link", { name: /Open DISC360/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /DISC360/i })).toHaveCount(0);
});

test("another participant's result is a 404, not a permission error", async ({ page }) => {
  await signInTo(page, "demo@disc360.dev", "/wellbeing");
  const response = await page.goto("/wellbeing/result/00000000-0000-4000-8000-0000000000ff");
  expect(response?.status()).toBe(404);
});

test("another participant's report PDF is a 404", async ({ page }) => {
  await signInTo(page, "demo@disc360.dev", "/wellbeing");
  const response = await page.request.get(
    "/api/wellbeing/report/00000000-0000-4000-8000-0000000000ff",
  );
  expect(response.status()).toBe(404);
});

test("wellbeing routes require authentication", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/wellbeing/history");
  await expect(page).toHaveURL(/\/sign-in/);
  await context.close();
});

/* ── no score in a URL ──────────────────────────────────────────────── */

test("no wellbeing URL carries a score or an answer", async ({ page }) => {
  await signInTo(page, "demo@disc360.dev", "/wellbeing");
  const seen: string[] = [];
  page.on("request", (request) => seen.push(request.url()));

  await page.goto("/wellbeing/history");
  await page.goto("/wellbeing");

  for (const url of seen) {
    expect(url).not.toMatch(/[?&](score|total|ghq|answer|item)=/i);
  }
});
