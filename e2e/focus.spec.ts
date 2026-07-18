import { expect, test, type Page } from "@playwright/test";

/**
 * Focus Pulse & Combined — proving the products are real, not presentation-only:
 * they appear publicly, run independently, save, score, and drive team mode.
 */

async function signUpIndividual(page: Page, name: string, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("disc360-playwright");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding**");
  await page.getByRole("radio", { name: /Understand myself/i }).click();
  await page.getByLabel("Country").fill("US");
  await page.getByText(/I consent to DISC360 processing/).click();
  await page.getByRole("button", { name: /Continue to your dashboard/i }).click();
  await page.waitForURL("**/app");
}

/** Answer all six Focus questions (5 single-select auto-advance + one scale). */
async function completeFocus(page: Page) {
  for (let i = 0; i < 6; i++) {
    await page.getByText(new RegExp(`Question ${i + 1} of 6`)).waitFor({ timeout: 12_000 });
    await page.waitForTimeout(600); // let the entrance animation settle
    const isScale = await page.getByText(/How noisy does your mind feel/i).isVisible().catch(() => false);
    if (isScale) await page.getByRole("button", { name: "6", exact: true }).click();
    else await page.getByRole("group").getByRole("button").first().click();
    if (i < 5) await page.getByText(new RegExp(`Question ${i + 2} of 6`)).waitFor({ timeout: 12_000 }).catch(() => {});
  }
  await page.getByRole("button", { name: /See my Focus profile/i }).click();
}

const FOCUS_PATTERN = /Intentional Focuser|Responsive Multitasker|Socially Stimulated Worker|Deadline Activator|Quiet Deep Worker|Overloaded Switcher/;

/* ── homepage & independence ────────────────────────────────────────── */

test("Focus and Combined appear on the public homepage", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Focus & Digital Dopamine Pulse" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Combined DISC + Focus Assessment" })).toBeVisible();
  await expect(page.getByText("Under 90 seconds", { exact: false }).first()).toBeVisible();
});

test("Focus starts independently, saves, scores and stores its own result", async ({ page }) => {
  test.slow();
  await signUpIndividual(page, "Focus Solo", `pw-focus-${Date.now()}@disc360.dev`);

  await page.goto("/focus");
  await page.getByRole("button", { name: /Go straight to assessment/i }).click();
  await page.waitForURL("**/focus/assessment/**", { timeout: 20_000 });

  // Questions render and answers autosave.
  await expect(page.getByText("Question 1 of 6")).toBeVisible();
  await expect(page.getByText(/pick up your phone without consciously deciding/i)).toBeVisible();
  await page.waitForTimeout(600);
  await page.getByRole("group").getByRole("button").first().click();
  await expect(page.getByText("Autosaved")).toBeVisible();

  // Complete from Q2 onward.
  for (let i = 1; i < 6; i++) {
    await page.getByText(new RegExp(`Question ${i + 1} of 6`)).waitFor({ timeout: 12_000 });
    await page.waitForTimeout(600);
    const isScale = await page.getByText(/How noisy does your mind feel/i).isVisible().catch(() => false);
    if (isScale) await page.getByRole("button", { name: "6", exact: true }).click();
    else await page.getByRole("group").getByRole("button").first().click();
    if (i < 5) await page.getByText(new RegExp(`Question ${i + 2} of 6`)).waitFor({ timeout: 12_000 }).catch(() => {});
  }
  await page.getByRole("button", { name: /See my Focus profile/i }).click();

  await page.waitForURL("**/focus/results/**", { timeout: 20_000 });
  await expect(page.getByText(FOCUS_PATTERN).first()).toBeVisible();
  await expect(page.getByText("Automaticity")).toBeVisible();
  await expect(page.getByText("Recovery readiness")).toBeVisible();
  await expect(page.getByText("Three things to try")).toBeVisible();

  // Presentation mode for the individual Focus result.
  await page.getByRole("link", { name: /Present this result/i }).click();
  await page.waitForURL("**/present");
  await expect(page.getByText(FOCUS_PATTERN).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Fullscreen/i })).toBeVisible();
});

/* ── team mode ──────────────────────────────────────────────────────── */

/** Create a team of the given assessment type via the wizard; returns its name. */
async function createTeam(page: Page, type: "focus" | "combined", label: string): Promise<string> {
  await page.goto("/pricing?intent=create-team");
  await page.getByRole("button", { name: /Buy Team plan/i }).first().click();
  await page.waitForURL("**/app/teams/new");

  // Select the assessment type via the radio directly (the label input is
  // visually hidden), which is more robust than clicking label text.
  await page.locator(`input[name="assessment_type"][value="${type}"]`).check({ force: true });
  const teamName = `${label} ${Date.now() % 100000}`;
  await page.getByLabel("Team name").fill(teamName);
  await page.getByLabel("Organization or company").fill("Attention Co");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("wizard-review")).toContainText(
    type === "focus" ? "Focus Pulse only" : "Combined DISC + Focus",
  );
  await page.getByRole("button", { name: "Create team" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  return teamName;
}

test("a facilitator can create a Focus team and its dashboard points at the Focus summary", async ({ page }) => {
  test.slow();
  await signUpIndividual(page, "Focus Facilitator", `pw-ffac-${Date.now()}@disc360.dev`);
  await createTeam(page, "focus", "Focus Team");

  // The dashboard summary link goes to the Focus team summary, which renders.
  await page.getByRole("link", { name: "Team summary" }).click();
  await page.waitForURL("**/focus");
  await expect(page.getByText(/Focus Pulse · team summary/i)).toBeVisible();
  await expect(page.getByText("Recommended team agreements")).toBeVisible();

  // Presentation mode for the team Focus summary.
  await page.getByRole("link", { name: /Present this summary/i }).click();
  await page.waitForURL("**/present/focus");
  await expect(page.getByRole("button", { name: /Fullscreen/i })).toBeVisible();
});

test("a facilitator can create a Combined team", async ({ page }) => {
  test.slow();
  await signUpIndividual(page, "Combined Facilitator", `pw-cfac-${Date.now()}@disc360.dev`);
  await createTeam(page, "combined", "Combined Team");
  await page.getByRole("link", { name: "Team summary" }).click();
  await page.waitForURL("**/combined");
  await expect(page.getByText(/Combined · team summary/i)).toBeVisible();
});

test("QR join opens the Focus assessment for a Focus team", async ({ page, browser }) => {
  test.slow();
  // Facilitator creates a Focus team and grabs the join link.
  await signUpIndividual(page, "QR Facilitator", `pw-qrfac-${Date.now()}@disc360.dev`);
  await createTeam(page, "focus", "QR Focus");
  const joinHref = await page
    .getByRole("link", { name: "Open participant join page" })
    .getAttribute("href");
  expect(joinHref).toBeTruthy();

  // A brand-new participant in a SEPARATE context (no shared cookies, so they
  // aren't already signed in) scans/opens the link → registers → Focus runner.
  const participantContext = await browser.newContext();
  const participant = await participantContext.newPage();
  await participant.goto(joinHref!);
  await expect(participant.getByText(/QR Focus/).first()).toBeVisible();
  await participant.getByLabel("Full name").fill("Focus Joiner");
  await participant.getByLabel(/email/i).first().fill(`pw-join-${Date.now()}@atlasdemo.dev`);
  await participant.getByText(/I consent/i).click();
  await participant.getByRole("button", { name: /Start|Join|Begin/i }).first().click();

  // The correct assessment opens: the Focus runner, not DISC.
  await participant.waitForURL("**/focus/assessment/**", { timeout: 30_000 });
  await expect(participant.getByText("Question 1 of 6")).toBeVisible();
  await completeFocus(participant);
  await participant.waitForURL("**/focus/results/**", { timeout: 20_000 });
  await participantContext.close();

  // The facilitator's Focus summary now reflects the participant's completion
  // (the facilitator is also a member and hasn't taken it, so it reads "1/2").
  await page.goto(page.url().replace(/\/dashboard.*/, "/focus"));
  await expect(page.getByText(/Focus Pulse · team summary/i)).toBeVisible();
  await expect(page.getByText(/^1\/\d+$/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Attention patterns" })).toBeVisible();
});

/* ── combined runs both ─────────────────────────────────────────────── */

test("Combined runs DISC then Focus and the result shows both", async ({ page }) => {
  test.slow();
  test.setTimeout(180_000);
  await signUpIndividual(page, "Combined Solo", `pw-comb-${Date.now()}@disc360.dev`);

  await page.goto("/combined");
  await page.getByRole("button", { name: /Go straight to assessment/i }).click();

  // Stage 1: the DISC assessment (24 scenarios).
  await page.waitForURL("**/app/assessments/**", { timeout: 20_000 });
  for (let s = 0; s < 24; s++) {
    await expect(page.getByText(`Scenario ${s + 1} of 24`)).toBeVisible();
    const options = page.getByRole("group").getByRole("button");
    await options.first().click();
    await options.nth(1).click();
  }
  await page.getByRole("button", { name: "Submit assessment" }).click();

  // Stage 2: the controller sends us into the Focus Pulse.
  await page.waitForURL("**/focus/assessment/**", { timeout: 30_000 });
  await completeFocus(page);

  // Stage 3: the combined result shows both profiles.
  await page.waitForURL("**/combined/results/**", { timeout: 30_000 });
  await expect(page.getByText(/behaviour × attention/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Behaviour" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Attention" }).first()).toBeVisible();
  await expect(page.getByText(FOCUS_PATTERN).first()).toBeVisible();

  // Combined presentation mode works.
  await page.getByRole("link", { name: /Present this result/i }).click();
  await page.waitForURL("**/present");
  await expect(page.getByRole("button", { name: /Fullscreen/i })).toBeVisible();
});
