import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * Facilitator-led session + QR onboarding regression suite.
 *
 * Covers: invitation onboarding without a team code · manual path keeps the
 * code field · invitation survives auth · consent joins the resolved team ·
 * per-assessment session cards (disc/focus/combined) · self-paced catalogue ·
 * live slide following · review gating · QR PNG export (name, type, size) ·
 * full-screen QR page. Fixtures live in the local stack and are removed.
 */

const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = (query: string) =>
  execSync(`psql "${DB}" -t -A -c ${JSON.stringify(query.replace(/\s+/g, " "))}`)
    .toString()
    .trim();

const SUPA = "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ENG_TEAM = "30000000-0000-4000-8000-000000000002";
const PASSWORD = "facil-spec-Passw0rd";

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
  // Upsert: the auth trigger that creates the profiles row can race this
  // call, so never depend on the row already existing.
  sql(
    `insert into profiles (id, email, full_name, preferred_name, onboarding_intent, consented_at, onboarded_at)
     values ('${userId}', '${email}', '${name}', '${name.split(" ")[0]}', 'join_team', now(), now())
     on conflict (id) do update set
       full_name=excluded.full_name, preferred_name=excluded.preferred_name,
       onboarding_intent=excluded.onboarding_intent,
       consented_at=excluded.consented_at, onboarded_at=excluded.onboarded_at`,
  );
}

function makeTeam(opts: {
  code: string;
  assessment: "disc" | "focus" | "combined";
  state: string;
  access?: string;
  slide?: number | null;
  facilitator?: string;
}): { id: string; token: string } {
  const row = sql(
    `with created as (
       insert into teams (organization_id, name, description, team_code, created_by,
                          assessment_type, session_mode, session_state, presentation_access, active_slide, facilitator_name)
       values ('${orgId}', 'Facil ${opts.code}', 'facilitated fixture', '${opts.code}', '${creatorId}',
               '${opts.assessment}', 'facilitator_led', '${opts.state}',
               '${opts.access ?? "live_and_review"}', ${opts.slide ?? "null"},
               ${opts.facilitator ? `'${opts.facilitator}'` : "null"})
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

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(app|onboarding)/, { timeout: 20000 });
}

test.beforeAll(() => {
  orgId = sql(`select organization_id from teams where id = '${ENG_TEAM}'`);
  creatorId = sql(`select created_by from teams where id = '${ENG_TEAM}'`);
});

test.afterAll(async () => {
  if (teamIds.length) {
    const list = teamIds.map((t) => `'${t}'`).join(",");
    sql(`delete from invitations where team_id in (${list})`);
    sql(`delete from team_members where team_id in (${list})`);
    sql(`delete from teams where id in (${list})`);
  }
  for (const id of userIds) {
    sql(`delete from team_members where profile_id='${id}'`);
    sql(`delete from assessment_results where profile_id='${id}'`);
    sql(`delete from assessment_sessions where profile_id='${id}'`);
    sql(`delete from profiles where id='${id}'`);
    await fetch(`${SUPA}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
  }
});

test("1+4: invitation onboarding shows the summary, hides the team code, and consent joins the resolved team", async ({
  page,
}) => {
  const team = makeTeam({ code: "FCL-1001", assessment: "disc", state: "draft", facilitator: "Amara External" });
  const email = "facil-invitee@disc360.dev";
  await createUser(email);

  await signIn(page, email); // not onboarded → lands on /onboarding
  await page.goto(`/join/${team.token}`); // carries the invitation into onboarding
  await page.waitForURL(`**/onboarding?join=${team.token}`);

  // Invitation summary, pathway choice, and NO team-code field anywhere.
  await expect(page.getByText("You are joining")).toBeVisible();
  await expect(page.getByText("Facil FCL-1001", { exact: true })).toBeVisible();
  await expect(page.getByText("DISC Behaviour Assessment")).toBeVisible();
  // The DISPLAYED facilitator is the configured name, not the signed-in owner.
  await expect(page.getByText("Facilitated by Amara External")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Join as participant/ })).toBeVisible();
  await expect(page.getByLabel("Team code")).toHaveCount(0);

  // Complete the participant pathway with required consent.
  await page.getByLabel("Full name").fill("Invitee Example");
  await page.getByLabel("Preferred name").fill("Invitee");
  await page.getByLabel("Country").fill("Norway");
  await page.getByRole("checkbox", { name: /consent to DISC360 processing/i }).check();
  await page.getByRole("button", { name: /Join Facil FCL-1001/ }).click();
  await page.waitForURL("**/app", { timeout: 20000 });

  // Membership landed on exactly the invited team; the session card shows.
  const memberCount = sql(
    `select count(*) from team_members where team_id='${team.id}' and email='${email}'`,
  );
  expect(memberCount).toBe("1");
  await expect(page.getByText("Today’s session · Facil FCL-1001")).toBeVisible();
  await expect(page.getByText("Your facilitator has not started the session yet.")).toBeVisible();
});

test("2: the manual path still asks for a team code", async ({ page }) => {
  const email = "facil-manual@disc360.dev";
  await createUser(email);
  await signIn(page, email);
  await page.waitForURL("**/onboarding**");
  await page.getByRole("radio", { name: /Join a team/ }).click();
  await expect(page.getByLabel("Team code")).toBeVisible();
});

test("3: a signed-in onboarded account opening a join link lands joined — no re-registration, no code", async ({
  page,
}) => {
  const team = makeTeam({ code: "FCL-1003", assessment: "disc", state: "draft" });
  const email = "facil-returning@disc360.dev";
  const uid = await createUser(email);
  onboardProfile(uid, email, "Returning Participant");

  await signIn(page, email);
  await page.goto(`/join/${team.token}`);
  await page.waitForURL("**/app", { timeout: 20000 });
  await expect(page.getByText("Today’s session · Facil FCL-1003")).toBeVisible();
  const memberCount = sql(
    `select count(*) from team_members where team_id='${team.id}' and email='${email}'`,
  );
  expect(memberCount).toBe("1");
});

for (const [n, assessment, label, absent] of [
  ["5", "disc", "DISC Behaviour Assessment", "Focus & Digital Dopamine Pulse"],
  ["6", "focus", "Focus & Digital Dopamine Pulse", "Combined DISC + Focus"],
  ["7", "combined", "Combined DISC + Focus", "DISC Behaviour Assessment"],
] as const) {
  test(`${n}: facilitator-led ${assessment} team shows only ${assessment}`, async ({ page }) => {
    const team = makeTeam({
      code: `FCL-2${assessment.length}0${n}`,
      assessment,
      state: "assessment_open",
    });
    const email = `facil-${assessment}@disc360.dev`;
    const uid = await createUser(email);
    onboardProfile(uid, email, `Member ${assessment}`);
    addMember(team.id, uid, email, `Member ${assessment}`);

    await signIn(page, email);
    await page.goto("/app");
    await expect(page.getByText(`Today’s session · Facil`)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
    // The catalogue and the other products are not offered.
    await expect(page.getByRole("heading", { name: "Assessments" })).toHaveCount(0);
    await expect(page.getByText(absent)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Begin assessment" })).toBeVisible();
  });
}

test("8: a self-paced individual keeps the assessment catalogue", async ({ page }) => {
  await signIn(page, "solo@disc360.dev", "disc360-demo");
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Assessments" })).toBeVisible();
  await expect(page.getByText("DISC Behaviour", { exact: false }).first()).toBeVisible();
});

test("9+10: a participant follows the coach's slide and cannot browse in live mode", async ({
  page,
}) => {
  const team = makeTeam({
    code: "FCL-3001",
    assessment: "disc",
    state: "presentation",
    slide: 2,
  });
  const email = "facil-live@disc360.dev";
  const uid = await createUser(email);
  onboardProfile(uid, email, "Live Follower");
  addMember(team.id, uid, email, "Live Follower");

  await signIn(page, email);
  await page.goto("/app");
  await expect(page.getByText("Presentation in progress")).toBeVisible();
  await page.getByRole("link", { name: "Join live presentation" }).click();
  await page.waitForURL("**/live");

  // Slide 3 (index 2) of the DISC deck.
  await expect(page.getByText("Four ways of showing up")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Following your facilitator")).toBeVisible();
  // no navigation controls in live mode
  await expect(page.getByRole("button", { name: "Next slide" })).toHaveCount(0);

  // Coach advances → the follower updates by polling.
  sql(`update teams set active_slide=4 where id='${team.id}'`);
  await expect(page.getByText("A strength, overused, becomes a pressure point")).toBeVisible({
    timeout: 8000,
  });

  // Coach opens the assessment → the follower is redirected off the deck.
  sql(`update teams set session_state='assessment_open' where id='${team.id}'`);
  await expect(page.getByText("The presentation has moved on.")).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole("link", { name: "Go to your session" })).toBeVisible();
});

test("11: review access follows the coach's presentation setting", async ({ page }) => {
  const noReview = makeTeam({
    code: "FCL-4001",
    assessment: "disc",
    state: "results",
    access: "live_only",
  });
  const withReview = makeTeam({
    code: "FCL-4002",
    assessment: "disc",
    state: "results",
    access: "live_and_review",
  });
  const email = "facil-review@disc360.dev";
  const uid = await createUser(email);
  onboardProfile(uid, email, "Review Member");
  addMember(noReview.id, uid, email, "Review Member");
  addMember(withReview.id, uid, email, "Review Member");

  await signIn(page, email);
  await page.goto(`/app/teams/${noReview.id}/live?mode=review`);
  await page.waitForURL("**/app", { timeout: 15000 });

  await page.goto(`/app/teams/${withReview.id}/live?mode=review`);
  await expect(
    page.getByText("How do people lead, communicate and respond when it matters?"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Next slide" })).toBeVisible();
});

test("12+13: QR download is a real PNG named for the team, at presentation size", async ({
  page,
}) => {
  await signIn(page, "demo@disc360.dev", "disc360-demo");
  await page.goto(`/app/teams/${ENG_TEAM}/dashboard`);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download QR code" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("DISC360-Engineering-Core-QR.png");

  const path = await download.path();
  const bytes = readFileSync(path!);
  // PNG signature
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  // IHDR width/height (bytes 16..24)
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  expect(width).toBeGreaterThanOrEqual(1600);
  expect(height).toBeGreaterThanOrEqual(1600);
});

test("14: the full-screen QR page projects on desktop and phone", async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await desktop.newPage();
  await signIn(d, "demo@disc360.dev", "disc360-demo");
  await d.goto(`/app/teams/${ENG_TEAM}/qr`);
  await expect(d.getByRole("heading", { name: "Join Engineering Core" })).toBeVisible();
  await expect(d.getByText(/Team code:/)).toBeVisible();
  await expect(d.getByRole("button", { name: /Print \/ Save as PDF/ })).toBeVisible();

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: await desktop.storageState(),
  });
  const m = await phone.newPage();
  await m.goto(`/app/teams/${ENG_TEAM}/qr`);
  await expect(m.getByRole("heading", { name: "Join Engineering Core" })).toBeVisible();
  await desktop.close();
  await phone.close();
});

test("15: the backend rejects assessments the facilitator did not select", async ({ page }) => {
  const team = makeTeam({ code: "FCL-5001", assessment: "disc", state: "assessment_open" });
  const email = "facil-locked@disc360.dev";
  const uid = await createUser(email);
  onboardProfile(uid, email, "Locked Member");
  addMember(team.id, uid, email, "Locked Member");

  await signIn(page, email);

  // Deep-link straight to the Focus product and try to start it.
  await page.goto("/focus");
  const focusStart = page.getByRole("button", { name: /Start|Begin|assessment/i }).first();
  if (await focusStart.isVisible().catch(() => false)) {
    await focusStart.click();
    await page.waitForURL(/\/app(\?notice=|$)/, { timeout: 15000 });
  }
  const focusSessions = sql(`select count(*) from focus_sessions where profile_id='${uid}'`);
  expect(focusSessions).toBe("0");

  // Combined too.
  await page.goto("/combined");
  const combinedStart = page.getByRole("button", { name: /Start|Begin|assessment/i }).first();
  if (await combinedStart.isVisible().catch(() => false)) {
    await combinedStart.click();
    await page.waitForURL(/\/app(\?notice=|$)/, { timeout: 15000 });
  }
  const combinedSessions = sql(`select count(*) from combined_sessions where profile_id='${uid}'`);
  expect(combinedSessions).toBe("0");

  // The selected assessment still starts normally.
  await page.goto("/app");
  await page.getByRole("button", { name: "Begin assessment" }).click();
  await page.waitForURL("**/app/assessments/**", { timeout: 15000 });
  const discSessions = sql(`select count(*) from assessment_sessions where profile_id='${uid}'`);
  expect(discSessions).toBe("1");
});

test("16: combined facilitated flow — DISC then Focus, wait for release, then view result", async ({
  page,
}) => {
  test.slow();
  const team = makeTeam({ code: "FCL-6001", assessment: "combined", state: "assessment_open" });
  const email = "facil-combined-run@disc360.dev";
  const uid = await createUser(email);
  onboardProfile(uid, email, "Combined Runner");
  addMember(team.id, uid, email, "Combined Runner");

  await signIn(page, email);
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Combined DISC + Focus" })).toBeVisible();
  await page.getByRole("button", { name: "Begin assessment" }).click();

  // Stage 1: the 24 DISC scenarios.
  await page.waitForURL("**/app/assessments/**", { timeout: 20000 });
  for (let scenario = 0; scenario < 24; scenario++) {
    await expect(page.getByText(`Scenario ${scenario + 1} of 24`)).toBeVisible({ timeout: 15000 });
    const options = page.getByRole("group").getByRole("button");
    await options.first().click();
    await options.nth(1).click();
  }
  await page.getByRole("button", { name: "Submit assessment" }).click();

  // Stage 2: the Focus questions (controller hands over automatically).
  await page.waitForURL("**/focus/assessment/**", { timeout: 30000 });
  for (let i = 0; i < 6; i++) {
    await page.getByText(new RegExp(`Question ${i + 1} of 6`)).waitFor({ timeout: 15000 });
    const isScale = await page.getByRole("button", { name: "6", exact: true }).isVisible().catch(() => false);
    if (isScale) await page.getByRole("button", { name: "6", exact: true }).click();
    else await page.getByRole("group").getByRole("button").first().click();
  }
  await page.getByRole("button", { name: /See my Focus profile|Submit/i }).click();

  // Results are HELD: the participant lands on the waiting card, and even a
  // deep link to the combined result bounces back.
  await page.waitForURL("**/app", { timeout: 30000 });
  await expect(page.getByText("Assessment submitted")).toBeVisible();
  const combinedId = sql(
    `select id from combined_sessions where profile_id='${uid}' order by created_at desc limit 1`,
  );
  await page.goto(`/combined/results/${combinedId}`);
  await page.waitForURL(/\/app\?notice=result_not_released/, { timeout: 15000 });
  await expect(
    page.getByText("Your facilitator has not released results yet."),
  ).toBeVisible();

  // Facilitator releases → the card flips and the result opens.
  sql(`update teams set session_state='results' where id='${team.id}'`);
  await page.goto("/app");
  await expect(page.getByText("Your result is ready")).toBeVisible();
  await page.getByRole("link", { name: "View result" }).click();
  await page.waitForURL("**/combined/results/**", { timeout: 20000 });
  await expect(page.getByText(/Behaviour|Focus/i).first()).toBeVisible();

  sql(`delete from combined_sessions where profile_id='${uid}'`);
  sql(`delete from focus_results where profile_id='${uid}'`);
  sql(`delete from focus_sessions where profile_id='${uid}'`);
});

test("17: two teams, two participants — attempts and reports are fully isolated", async ({
  browser,
}) => {
  test.slow();
  const alpha = makeTeam({ code: "FCL-7A01", assessment: "disc", state: "assessment_open" });
  const beta = makeTeam({ code: "FCL-7B01", assessment: "disc", state: "assessment_open" });
  const emailA = "facil-alpha@disc360.dev";
  const emailB = "facil-beta@disc360.dev";
  const uidA = await createUser(emailA);
  const uidB = await createUser(emailB);
  onboardProfile(uidA, emailA, "Alpha Person");
  onboardProfile(uidB, emailB, "Beta Person");
  addMember(alpha.id, uidA, emailA, "Alpha Person");
  addMember(beta.id, uidB, emailB, "Beta Person");
  // Participant A ALSO belongs to Beta — attempts must stay distinct per team.
  addMember(beta.id, uidA, emailA, "Alpha Person");

  // Real distinct auth users in separate browser contexts.
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  // A completes DISC in Alpha (bound to Alpha explicitly via the card CTA).
  await signIn(pageA, emailA);
  await pageA.goto("/app");
  await pageA.getByRole("button", { name: "Begin assessment" }).first().click();
  await pageA.waitForURL("**/app/assessments/**", { timeout: 20000 });
  for (let scenario = 0; scenario < 24; scenario++) {
    await expect(pageA.getByText(`Scenario ${scenario + 1} of 24`)).toBeVisible({ timeout: 15000 });
    const options = pageA.getByRole("group").getByRole("button");
    await options.first().click();
    await options.nth(1).click();
  }
  await pageA.getByRole("button", { name: "Submit assessment" }).click();
  await pageA.waitForURL(/\/app(\?|$)/, { timeout: 30000 });
  await expect(pageA.getByText("Assessment submitted")).toBeVisible({ timeout: 15000 });

  // A's attempt/result is bound to exactly ONE team.
  const aAttemptTeams = sql(
    `select coalesce(team_id::text,'null') from assessment_sessions where profile_id='${uidA}'`,
  ).split("\n");
  expect(aAttemptTeams.filter((t) => t !== "null").length).toBe(1);
  const aResultTeam = sql(`select team_id from assessment_results where profile_id='${uidA}'`);
  expect([alpha.id, beta.id]).toContain(aResultTeam);

  // B in Beta can start independently (multi-user launch defect regression).
  await signIn(pageB, emailB);
  await pageB.goto("/app");
  await expect(pageB.getByRole("heading", { name: "DISC Behaviour Assessment" })).toBeVisible();
  await pageB.getByRole("button", { name: "Begin assessment" }).click();
  await pageB.waitForURL("**/app/assessments/**", { timeout: 20000 });
  await expect(pageB.getByText("Scenario 1 of 24")).toBeVisible();
  const bAttempt = sql(
    `select team_id from assessment_sessions where profile_id='${uidB}' and status='in_progress'`,
  );
  expect(bAttempt).toBe(beta.id);

  // Report isolation: the completed Alpha result appears ONLY in the team it
  // was taken for — the other roster shows zero completed.
  const aTeam = aResultTeam;
  const otherTeam = aTeam === alpha.id ? beta.id : alpha.id;
  const inTeam = sql(
    `select count(*) from assessment_results where profile_id='${uidA}' and team_id='${aTeam}'`,
  );
  const inOther = sql(
    `select count(*) from assessment_results where profile_id='${uidA}' and team_id='${otherTeam}'`,
  );
  expect(inTeam).toBe("1");
  expect(inOther).toBe("0");

  // The admin dashboards reflect the same isolation.
  const admin = await browser.newContext();
  const pageAdmin = await admin.newPage();
  await signIn(pageAdmin, "demo@disc360.dev", "disc360-demo");
  await pageAdmin.goto(`/app/teams/${otherTeam}/dashboard`);
  await expect(pageAdmin.getByText("Completed").locator("..").getByText("0")).toBeVisible();

  await ctxA.close();
  await ctxB.close();
  await admin.close();
});

test("18: denial reasons are explicit, never silent", async ({ page }) => {
  const team = makeTeam({ code: "FCL-8001", assessment: "disc", state: "draft" });
  const email = "facil-denied@disc360.dev";
  const uid = await createUser(email);
  onboardProfile(uid, email, "Denied Member");
  addMember(team.id, uid, email, "Denied Member");

  await signIn(page, email);
  // Direct deep-link to the DISC product start while the session is draft.
  await page.goto("/disc");
  const start = page.getByRole("button", { name: /Start|Begin|assessment/i }).first();
  if (await start.isVisible().catch(() => false)) {
    await start.click();
    await page.waitForURL("**/app?notice=session_not_open", { timeout: 15000 });
    await expect(
      page.getByText("The assessment has not been opened by the facilitator yet."),
    ).toBeVisible();
  }
  // Wrong product while facilitated: explicit reason too.
  await page.goto("/focus");
  const focusStart = page.getByRole("button", { name: /Start|Begin|assessment/i }).first();
  if (await focusStart.isVisible().catch(() => false)) {
    await focusStart.click();
    await page.waitForURL(/notice=(wrong_assessment|session_not_open)/, { timeout: 15000 });
  }
});

test("19: with several facilitated teams, the ACTIVE session wins — never a stale draft", async ({
  page,
}) => {
  const draftTeam = makeTeam({ code: "FCL-9001", assessment: "combined", state: "draft" });
  const openTeam = makeTeam({ code: "FCL-9002", assessment: "disc", state: "assessment_open" });
  const email = "facil-multi@disc360.dev";
  const uid = await createUser(email);
  onboardProfile(uid, email, "Multi Member");
  // Membership order mirrors production: the DRAFT team row comes first.
  addMember(draftTeam.id, uid, email, "Multi Member");
  addMember(openTeam.id, uid, email, "Multi Member");

  await signIn(page, email);
  await page.goto("/app");
  // The open session is chosen — not the first-returned draft membership.
  await expect(page.getByText("Today’s session · Facil FCL-9002")).toBeVisible();
  await expect(page.getByRole("button", { name: "Begin assessment" })).toBeVisible();
  // Both sessions reachable through the switcher; the draft one explains itself.
  await page.getByRole("link", { name: "Facil FCL-9001", exact: true }).click();
  await expect(
    page.getByText("Your facilitator has not started the session yet."),
  ).toBeVisible();
});
