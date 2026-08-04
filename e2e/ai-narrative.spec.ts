import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Phase 3 regression: the AI narrative layer.
 *
 * The local stack runs without an ANTHROPIC_API_KEY, which is exactly the
 * state this suite has to prove is safe — the platform is complete without a
 * model, generation degrades to the evidence-written narrative, and the
 * provenance shown to a facilitator stays truthful. The paths that require a
 * key are covered by the register and merge unit tests, which exercise the
 * same code the model's reply flows through.
 */

const TEAM_PRODUCT = "30000000-0000-4000-8000-000000000001";
const TEAM_20 = "30000000-0000-4000-8000-000000000102";

const FACILITATOR = "demo@disc360.dev";
const MEMBER = "amara@atlasdemo.dev";
const SOLO = "solo@disc360.dev";

const insights = (page: Page, teamId: string) => page.goto(`/app/teams/${teamId}/insights`);

const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = (query: string) =>
  execSync(`psql "${DB}" -t -A -c ${JSON.stringify(query.replace(/\s+/g, " "))}`)
    .toString()
    .trim();

const clearGenerations = () =>
  sql("delete from audit_logs where action = 'ai_narrative.generated'");

/**
 * The hourly limit is real and durable, counted from audit rows — so a suite
 * that generates seven times per run exhausts a facilitator's quota after
 * three runs in an hour. Clearing the counter first keeps these tests about
 * the narrative layer; the limit itself is asserted deliberately at the end.
 */
test.beforeAll(clearGenerations);

const controls = (page: Page) => page.getByRole("region", { name: "Narrative controls" });
const brief = (page: Page) => page.getByRole("region", { name: "Facilitator brief" });

/**
 * A draft persists between tests, so the control is "Generate narrative" the
 * first time and "Regenerate" afterwards. Matching both keeps every test
 * independent of the order it runs in and of what a previous run left behind.
 */
async function generate(page: Page): Promise<void> {
  await controls(page)
    .getByRole("button", { name: /Generate narrative|Regenerate/ })
    .click();
  await expect(controls(page).getByText("Evidence rules")).toBeVisible({ timeout: 20_000 });
}

/* ── 1–4 · the surface stands on its own ────────────────────────────── */

test("the facilitator brief renders before any narrative is generated", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await insights(page, TEAM_PRODUCT);

  await expect(brief(page)).toBeVisible();
  await expect(brief(page).getByText("Open with this")).toBeVisible();
  await expect(brief(page).getByText("Ask the room")).toBeVisible();
  await expect(brief(page).getByText("Executive summary")).toBeVisible();
});

test("the brief opens with coverage rather than a claim", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await insights(page, TEAM_PRODUCT);

  await expect(brief(page).getByText(/people have completed the assessment/)).toBeVisible();
  await expect(
    brief(page).getByText(/not ability, not performance/),
  ).toBeVisible();
});

test("provenance says evidence rules until a model has written anything", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await insights(page, TEAM_20);

  await generate(page);
  await expect(page.getByText("Generated from team data")).toBeVisible();
  await expect(page.getByText("AI-generated", { exact: true })).toHaveCount(0);
});

test("the controls offer generation and explain what it does not change", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await insights(page, TEAM_PRODUCT);

  await expect(
    controls(page).getByRole("button", { name: /Generate narrative|Regenerate/ }),
  ).toBeVisible();
  await expect(
    controls(page).getByText(/sample sizes are unchanged|never the finding/),
  ).toBeVisible();
});

/* ── 5–8 · generating with no model configured ──────────────────────── */

test("generating without a configured model keeps the evidence narrative and says so", async ({
  page,
}) => {
  await signIn(page, FACILITATOR);
  await insights(page, TEAM_20);

  await expect(controls(page).getByText(/AI narration is not configured/)).toBeVisible();
  await controls(page)
    .getByRole("button", { name: /Generate narrative|Regenerate/ })
    .click();

  await expect(controls(page).getByRole("alert")).toContainText(
    /evidence-based narrative was kept/,
    { timeout: 20_000 },
  );
});

test("a fallback narrative is never labelled AI-generated", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await insights(page, TEAM_20);

  await generate(page);
  await expect(page.getByText("AI-generated", { exact: true })).toHaveCount(0);
});

test("a generated draft is a draft, and says participants never see it", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await insights(page, TEAM_20);

  await generate(page);
  await expect(controls(page).getByText("Draft — not shared")).toBeVisible();
  await expect(controls(page).getByText("Never shown this text")).toBeVisible();
});

test("the evidence figures are untouched by a generation", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await insights(page, TEAM_20);

  const coverage = page.getByText(/of \d+ completed · group data/);
  const before = await coverage.textContent();

  await generate(page);

  await expect(coverage).toHaveText(before ?? "");
  await page.getByRole("button", { name: "Show evidence and questions" }).first().click();
  await expect(page.getByText(/^\d+ of \d+ · \d+%$/).first()).toBeVisible();
});

/* ── 9–12 · editing, sharing, discarding ────────────────────────────── */

test("a facilitator can edit the narrative before it is used", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await insights(page, TEAM_20);
  await generate(page);

  await controls(page).getByRole("button", { name: "Edit" }).click();
  const editor = page.getByRole("region", { name: "Edit narrative" });
  await expect(editor).toBeVisible();

  await editor.getByLabel("Summary headline").fill("What this team told us about itself");
  await editor.getByRole("button", { name: "Save edits" }).click();

  await expect(editor).toBeHidden({ timeout: 20_000 });
  await expect(page.getByText("What this team told us about itself")).toBeVisible();
});

test("edited prose is refused when it leaves the platform's register", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await insights(page, TEAM_20);
  await generate(page);

  await controls(page).getByRole("button", { name: "Edit" }).click();
  const editor = page.getByRole("region", { name: "Edit narrative" });
  await editor.getByLabel("Summary headline").fill("Use this in the next promotion decision");
  await editor.getByRole("button", { name: "Save edits" }).click();

  await expect(editor.getByRole("alert")).toContainText(/outside what the platform will publish/, {
    timeout: 20_000,
  });
  await expect(editor).toBeVisible();
});

test("sharing is explicit and reversible, and never reaches participants", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await insights(page, TEAM_20);
  await generate(page);
  await expect(controls(page).getByText("Draft — not shared")).toBeVisible();

  await controls(page).getByRole("button", { name: "Share", exact: true }).click();
  await expect(controls(page).getByText("Shared with facilitators").first()).toBeVisible({
    timeout: 20_000,
  });

  await controls(page).getByRole("button", { name: "Shared with facilitators" }).click();
  await expect(controls(page).getByText("Draft — not shared")).toBeVisible({ timeout: 20_000 });
});

test("discarding a narrative leaves the deterministic insights intact", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await insights(page, TEAM_20);
  await generate(page);

  await controls(page).getByRole("button", { name: "Discard" }).click();
  await expect(controls(page).getByRole("button", { name: "Generate narrative" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("region", { name: "Insight cards" }).getByText("Team snapshot"),
  ).toBeVisible();
  await expect(brief(page)).toBeVisible();
});

/* ── 13–15 · scope and access ───────────────────────────────────────── */

test("a team member cannot reach the narrative controls", async ({ page }) => {
  await signIn(page, MEMBER);
  await page.goto(`/app/teams/${TEAM_PRODUCT}/insights`);

  // The insights route redirects a non-admin member away entirely.
  await expect(controls(page)).toHaveCount(0);
});

test("a non-member reaches nothing at all", async ({ page }) => {
  await signIn(page, SOLO);
  const response = await page.goto(`/app/teams/${TEAM_PRODUCT}/insights`);

  expect(response?.status()).toBe(404);
  await expect(controls(page)).toHaveCount(0);
});

test("presentation mode carries the brief at room scale", async ({ page }) => {
  await signIn(page, FACILITATOR);
  await insights(page, TEAM_PRODUCT);

  await page.getByRole("button", { name: "Presentation mode" }).click();
  const opening = brief(page).getByText("Open with this");
  await expect(opening).toBeVisible();

  const size = await opening.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  expect(size).toBeGreaterThan(13);
});

/* ── 16 · the rate limit ────────────────────────────────────────────── */

test("a facilitator at the hourly limit is refused, and told why", async ({ page }) => {
  // Twenty prior generations inside the window, written the way the action
  // writes them — the limit is counted from audit rows, not process memory,
  // so this is the same state a serverless instance would read.
  const facilitator = sql(`select id from profiles where email = '${FACILITATOR}'`);
  sql(`insert into audit_logs (actor_id, action, entity_type, entity_id, metadata)
       select '${facilitator}', 'ai_narrative.generated', 'ai_insight_narrative',
              '${TEAM_20}', '{}'::jsonb
       from generate_series(1, 20)`);

  try {
    await signIn(page, FACILITATOR);
    await insights(page, TEAM_20);
    await controls(page)
      .getByRole("button", { name: /Generate narrative|Regenerate/ })
      .click();

    await expect(controls(page).getByRole("alert")).toContainText(/which is the limit/, {
      timeout: 20_000,
    });
    await expect(controls(page).getByRole("alert")).toContainText(
      /evidence-based insights remain available/,
    );
    // The refusal changes nothing on the page.
    await expect(
      page.getByRole("region", { name: "Insight cards" }).getByText("Team snapshot"),
    ).toBeVisible();
  } finally {
    clearGenerations();
  }
});
