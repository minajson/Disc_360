import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/**
 * Participant access to their OWN individual report.
 *
 * The regression this suite exists for: a completed assessment used to be
 * gated on `teams.session_state`, so a participant in a facilitator-led
 * session was told to wait for their facilitator before they could open,
 * download or email a report about themselves. Every test here runs against a
 * team the facilitator has NOT advanced — `assessment_open` throughout — and
 * asserts the participant is never blocked.
 *
 * It also pins the boundary that must NOT move: a participant reaches their
 * own result and nothing else.
 */

const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = (query: string) =>
  execSync(`psql "${DB}" -t -A -c ${JSON.stringify(query.replace(/\s+/g, " "))}`)
    .toString()
    .trim();

const SUPA = "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ENG_TEAM = "30000000-0000-4000-8000-000000000002";
const PASSWORD = "report-spec-Passw0rd";

let orgId: string;
let creatorId: string;
const teamIds: string[] = [];
const userIds: string[] = [];

async function createUser(email: string): Promise<string> {
  const res = await fetch(`${SUPA}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  const body = (await res.json()) as { id?: string };
  if (!body.id) throw new Error(`user create failed for ${email}`);
  userIds.push(body.id);
  return body.id;
}

function onboardProfile(userId: string, email: string, name: string) {
  sql(
    `insert into profiles (id, email, full_name, preferred_name, onboarding_intent, consented_at, onboarded_at)
     values ('${userId}', '${email}', '${name}', '${name.split(" ")[0]}', 'join_team', now(), now())
     on conflict (id) do update set
       full_name=excluded.full_name, preferred_name=excluded.preferred_name,
       onboarding_intent=excluded.onboarding_intent,
       consented_at=excluded.consented_at, onboarded_at=excluded.onboarded_at`,
  );
}

function makeTeam(code: string, assessment: "disc" | "focus" | "combined"): { id: string; token: string } {
  // `assessment_open`: the facilitator has NOT released results. Nothing in
  // this suite may depend on that changing.
  const row = sql(
    `with created as (
       insert into teams (organization_id, name, description, team_code, created_by,
                          assessment_type, session_mode, session_state, presentation_access)
       values ('${orgId}', 'Report ${code}', 'participant-report fixture', '${code}', '${creatorId}',
               '${assessment}', 'facilitator_led', 'assessment_open', 'live_and_review')
       returning id, invite_token
     ) select id || '|' || invite_token from created`,
  );
  const [id, token] = row.split("|") as [string, string];
  teamIds.push(id);
  return { id, token };
}

function addMember(teamId: string, userId: string, email: string, name: string) {
  sql(
    `insert into team_members (team_id, profile_id, display_name, email, role)
     values ('${teamId}', '${userId}', '${name}', '${email}', 'member')`,
  );
}

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(app|onboarding)/, { timeout: 20000 });
}

/** Answers the 24 DISC scenarios and submits. */
async function completeDisc(page: Page) {
  for (let scenario = 0; scenario < 24; scenario++) {
    await expect(page.getByText(`Scenario ${scenario + 1} of 24`)).toBeVisible({ timeout: 15000 });
    const options = page.getByRole("group").getByRole("button");
    await options.first().click();
    await options.nth(1).click();
  }
  await page.getByRole("button", { name: "Submit assessment" }).click();
}

/** Answers the 6 Focus questions and submits. */
async function completeFocus(page: Page) {
  for (let index = 0; index < 6; index++) {
    await page.getByText(new RegExp(`Question ${index + 1} of 6`)).waitFor({ timeout: 15000 });
    const isScale = await page
      .getByRole("button", { name: "6", exact: true })
      .isVisible()
      .catch(() => false);
    if (isScale) await page.getByRole("button", { name: "6", exact: true }).click();
    else await page.getByRole("group").getByRole("button").first().click();
  }
  await page.getByRole("button", { name: /See my Focus profile|Submit/i }).click();
}

test.beforeAll(() => {
  orgId = sql(`select organization_id from teams where id = '${ENG_TEAM}'`);
  creatorId = sql(`select created_by from teams where id = '${ENG_TEAM}'`);
});

test.afterAll(async () => {
  for (const id of userIds) {
    sql(`delete from notification_logs where profile_id='${id}'`);
    sql(`delete from report_exports where profile_id='${id}'`);
    sql(`delete from combined_sessions where profile_id='${id}'`);
    sql(`delete from focus_results where profile_id='${id}'`);
    sql(`delete from focus_sessions where profile_id='${id}'`);
    sql(`delete from assessment_results where profile_id='${id}'`);
    sql(`delete from assessment_sessions where profile_id='${id}'`);
    sql(`delete from team_members where profile_id='${id}'`);
  }
  if (teamIds.length) {
    const list = teamIds.map((team) => `'${team}'`).join(",");
    sql(`delete from invitations where team_id in (${list})`);
    sql(`delete from team_members where team_id in (${list})`);
    sql(`delete from teams where id in (${list})`);
  }
  for (const id of userIds) {
    sql(`delete from profiles where id='${id}'`);
    await fetch(`${SUPA}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
  }
});

test("DISC: completion screen, own result, PDF and email — with no facilitator release", async ({
  page,
}) => {
  test.slow();
  const team = makeTeam("RPT-2001", "disc");
  const email = "report-disc@disc360.dev";
  const uid = await createUser(email);
  onboardProfile(uid, email, "Mina Allison");
  addMember(team.id, uid, email, "Mina Allison");

  await signIn(page, email);
  await page.goto("/app");
  await page.getByRole("button", { name: "Begin assessment" }).click();
  await page.waitForURL("**/app/assessments/**", { timeout: 20000 });
  await completeDisc(page);

  // ── Completion screen ──
  await page.waitForURL("**/app/complete/disc/**", { timeout: 30000 });
  await expect(page.getByRole("heading", { name: /Your assessment is complete/ })).toBeVisible();
  await expect(page.getByText("Your individual report is ready.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View my results" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download PDF" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Email My Report" })).toBeVisible();

  // The facilitator has not touched the session.
  expect(sql(`select session_state from teams where id='${team.id}'`)).toBe("assessment_open");

  const resultId = sql(
    `select id from assessment_results where profile_id='${uid}' order by created_at desc limit 1`,
  );

  // ── The full individual report ──
  await page.getByRole("link", { name: "View my results" }).click();
  await page.waitForURL(`**/app/results/${resultId}`, { timeout: 20000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Strengths")).toBeVisible();

  // ── PDF: correct participant, correct filename, no team content ──
  const pdf = await page.request.get(`/api/reports/disc/${resultId}`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect(pdf.headers()["content-disposition"]).toContain(
    'filename="DISC360_Mina_Allison_Report.pdf"',
  );
  const body = (await pdf.body()).toString("latin1");
  expect(body.startsWith("%PDF")).toBe(true);
  expect(body).toContain("Mina Allison");
  for (const forbidden of ["facilitator", "Report RPT-2001", team.id, uid, email]) {
    expect(body).not.toContain(forbidden);
  }

  // ── Email: never a false success, and always to the participant ──
  await page.getByRole("button", { name: "Email My Report" }).click();
  await expect(page.getByText(/Send your DISC360 report to/)).toBeVisible();
  // Masked, never the full address, on a device that may be shared.
  await expect(page.getByText("r***@disc360.dev")).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Send Report" }).click();

  const delivered = process.env.RESEND_API_KEY ? "sent" : "logged";
  if (delivered === "sent") {
    await expect(page.getByText("Your report has been sent.")).toBeVisible({ timeout: 20000 });
  } else {
    // No provider configured: the UI must say so rather than claim success.
    await expect(
      page.getByText("We couldn't send your report right now. You can still download your PDF."),
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByText("Your report has been sent.")).toHaveCount(0);
  }

  // Whatever the provider did, the message was addressed to the participant.
  expect(
    sql(
      `select count(*) from notification_logs
       where profile_id='${uid}' and email='${email}' and template='individual_report'`,
    ),
  ).toBe("1");

  // ── Viewport matrix: the two actions must never be buried ──
  for (const width of [375, 390, 430, 768, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 500 ? 812 : 900 });
    await page.goto(`/app/complete/disc/${resultId}`);
    for (const [name, control] of [
      ["View my results", page.getByRole("link", { name: "View my results" })],
      ["Download PDF", page.getByRole("link", { name: "Download PDF" }).first()],
      ["Email My Report", page.getByRole("button", { name: "Email My Report" })],
    ] as const) {
      await expect(control, `${name} @${width}px`).toBeInViewport();
      const box = await control.boundingBox();
      expect(box!.height, `${name} tap target @${width}px`).toBeGreaterThanOrEqual(40);
      expect(box!.x + box!.width, `${name} overflow @${width}px`).toBeLessThanOrEqual(width);
    }

    await page.goto(`/app/results/${resultId}`);
    await expect(
      page.getByRole("link", { name: "Download PDF" }).first(),
      `report bar @${width}px`,
    ).toBeInViewport();
    // The page itself must never scroll sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow @${width}px`).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  // ── Secure return access ──
  await page.goto("/app");
  await expect(page.getByText("Your result is ready")).toBeVisible();
  await page.getByRole("link", { name: "View result" }).click();
  await page.waitForURL(`**/app/results/${resultId}`, { timeout: 20000 });
});

test("Focus: own result immediately, no facilitator release", async ({ page }) => {
  test.slow();
  const team = makeTeam("RPT-2002", "focus");
  const email = "report-focus@disc360.dev";
  const uid = await createUser(email);
  onboardProfile(uid, email, "Femi Adeyemi");
  addMember(team.id, uid, email, "Femi Adeyemi");

  await signIn(page, email);
  await page.goto("/app");
  await page.getByRole("button", { name: "Begin assessment" }).click();
  await page.waitForURL("**/focus/assessment/**", { timeout: 20000 });
  await completeFocus(page);

  await page.waitForURL("**/app/complete/focus/**", { timeout: 30000 });
  await expect(page.getByRole("heading", { name: /Your assessment is complete/ })).toBeVisible();
  expect(sql(`select session_state from teams where id='${team.id}'`)).toBe("assessment_open");

  const resultId = sql(
    `select id from focus_results where profile_id='${uid}' order by created_at desc limit 1`,
  );
  await page.getByRole("link", { name: "View my results" }).click();
  await page.waitForURL(`**/focus/results/${resultId}`, { timeout: 20000 });
  await expect(page.getByText("Your attention pattern")).toBeVisible();

  const pdf = await page.request.get(`/api/reports/focus/${resultId}`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-disposition"]).toContain(
    'filename="DISC360_Femi_Adeyemi_Focus_Report.pdf"',
  );
  expect((await pdf.body()).toString("latin1")).toContain("Femi Adeyemi");
});

test("QR-joined participant keeps access to their own report", async ({ page }) => {
  test.slow();
  const team = makeTeam("RPT-2003", "disc");
  const email = "report-qr@disc360.dev";

  // The QR path: scan → register → straight into the assessment.
  await page.goto(`/join/${team.token}`);
  await page.waitForURL(/\/(join|sign-up|onboarding)/, { timeout: 20000 });

  const uid = await createUser(email);
  onboardProfile(uid, email, "Ada Nwosu");
  addMember(team.id, uid, email, "Ada Nwosu");
  await signIn(page, email);

  await page.goto("/app");
  await page.getByRole("button", { name: "Begin assessment" }).click();
  await page.waitForURL("**/app/assessments/**", { timeout: 20000 });
  await completeDisc(page);

  await page.waitForURL("**/app/complete/disc/**", { timeout: 30000 });
  const resultId = sql(
    `select id from assessment_results where profile_id='${uid}' order by created_at desc limit 1`,
  );

  // The team relationship survives; the report is still the participant's own.
  expect(sql(`select count(*) from team_members where team_id='${team.id}' and profile_id='${uid}'`)).toBe("1");
  const pdf = await page.request.get(`/api/reports/disc/${resultId}`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).toString("latin1")).toContain("Ada Nwosu");
});

test("a participant can reach only their OWN result — page and PDF alike", async ({ browser }) => {
  test.slow();
  const team = makeTeam("RPT-2004", "disc");

  const emailA = "report-owner-a@disc360.dev";
  const emailB = "report-owner-b@disc360.dev";
  const uidA = await createUser(emailA);
  const uidB = await createUser(emailB);
  onboardProfile(uidA, emailA, "Owner Alpha");
  onboardProfile(uidB, emailB, "Owner Beta");
  addMember(team.id, uidA, emailA, "Owner Alpha");
  addMember(team.id, uidB, emailB, "Owner Beta");

  // A completes an assessment.
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await signIn(pageA, emailA);
  await pageA.goto("/app");
  await pageA.getByRole("button", { name: "Begin assessment" }).click();
  await pageA.waitForURL("**/app/assessments/**", { timeout: 20000 });
  await completeDisc(pageA);
  await pageA.waitForURL("**/app/complete/disc/**", { timeout: 30000 });
  const resultA = sql(
    `select id from assessment_results where profile_id='${uidA}' order by created_at desc limit 1`,
  );
  await contextA.close();

  // B — same team, same session — cannot reach it by any id in the URL.
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await signIn(pageB, emailB);

  const pdf = await pageB.request.get(`/api/reports/disc/${resultA}`);
  expect(pdf.status()).toBe(404);
  // Not-found and not-yours answer identically — no id probing.
  const missing = await pageB.request.get(`/api/reports/disc/${crypto.randomUUID()}`);
  expect(missing.status()).toBe(404);
  // The combined and focus routes are no back door into a DISC result either.
  expect((await pageB.request.get(`/api/reports/focus/${resultA}`)).status()).toBe(404);
  expect((await pageB.request.get(`/api/reports/combined/${resultA}`)).status()).toBe(404);

  const page404 = await pageB.request.get(`/app/results/${resultA}`);
  expect(page404.status()).toBe(404);
  const complete404 = await pageB.request.get(`/app/complete/disc/${resultA}`);
  expect(complete404.status()).toBe(404);

  await contextB.close();
});

test("participant access does not open any facilitator surface", async ({ page }) => {
  test.slow();
  const team = makeTeam("RPT-2005", "disc");
  const email = "report-boundary@disc360.dev";
  const uid = await createUser(email);
  onboardProfile(uid, email, "Boundary Tester");
  addMember(team.id, uid, email, "Boundary Tester");

  await signIn(page, email);
  await page.goto("/app");
  await page.getByRole("button", { name: "Begin assessment" }).click();
  await page.waitForURL("**/app/assessments/**", { timeout: 20000 });
  await completeDisc(page);
  await page.waitForURL("**/app/complete/disc/**", { timeout: 30000 });

  // Facilitator-only surfaces stay closed. (The shared team summary at
  // /results is NOT one of them — it is member-visible by design, governed by
  // the team's own `members_can_view_summary` / `results_named` settings, and
  // this change did not touch that.)
  for (const path of ["compare", "executive", "settings", "dashboard"]) {
    await page.goto(`/app/teams/${team.id}/${path}`);
    await page.waitForURL(/\/app\/teams(\?|$)/, { timeout: 15000 });
    await expect(page).toHaveURL(/denied=admin/);
  }

  // The deck is admin scope too.
  await page.goto(`/app/teams/${team.id}/presentation`);
  await expect(page).not.toHaveURL(new RegExp(`${team.id}/presentation$`));

  // The member-visibility setting still governs the shared summary.
  sql(`update teams set members_can_view_summary=false where id='${team.id}'`);
  await page.goto(`/app/teams/${team.id}/results`);
  await expect(
    page.getByText("The team summary isn't shared with members on this team."),
  ).toBeVisible();
  sql(`update teams set members_can_view_summary=true where id='${team.id}'`);

  // And the facilitator's own session controls remain untouched by this change.
  expect(sql(`select session_state from teams where id='${team.id}'`)).toBe("assessment_open");
});
