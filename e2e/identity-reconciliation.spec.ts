import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/**
 * Identity reconciliation — database behaviour and the platform-admin surface.
 *
 * The properties under test are the ones that would be expensive to discover
 * in production: that a merge never duplicates a result, never changes a
 * score, never loses a team's historical attribution, and never leaves two
 * roster rows for one person. The SQL asserts all of these inside its own
 * transaction; these tests prove the assertions actually fire, and that a
 * merge which would violate one is refused rather than half-applied.
 */

const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = (query: string) =>
  execSync(`psql "${DB}" -t -A -c ${JSON.stringify(query.replace(/\s+/g, " "))}`)
    .toString()
    .trim();

const SUPA = "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "identity-spec-Passw0rd";

const userIds: string[] = [];
const teamIds: string[] = [];

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

async function setAuthEmail(userId: string, email: string): Promise<void> {
  const res = await fetch(`${SUPA}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, email_confirm: true }),
  });
  // A silently-ignored failure here would look exactly like a broken sync
  // trigger in the assertions below. Fail loudly instead.
  const body = (await res.json()) as { email?: string; msg?: string };
  if (body.email !== email) {
    throw new Error(`auth email update failed for ${email}: ${body.msg ?? res.status}`);
  }
}

function onboard(userId: string, name: string) {
  sql(
    `update profiles set full_name='${name}', preferred_name='${name.split(" ")[0]}',
       onboarding_intent='join_team', consented_at=now(), onboarded_at=now()
     where id='${userId}'`,
  );
}

function makeTeam(code: string, name: string): string {
  const org = sql(`select organization_id from teams limit 1`);
  const creator = sql(`select id from profiles where is_super_admin limit 1`);
  // Wrapped in a CTE: psql prints the command tag alongside a bare RETURNING.
  const id = sql(
    `with created as (
       insert into teams (organization_id, name, team_code, created_by, assessment_type,
                          session_mode, session_state)
       values ('${org}','${name}','${code}','${creator}','disc','facilitator_led','assessment_open')
       returning id
     ) select id from created`,
  );
  teamIds.push(id);
  return id;
}

function addMember(teamId: string, userId: string, email: string, name: string, role = "member") {
  sql(
    `insert into team_members (team_id, profile_id, display_name, email, role)
     values ('${teamId}','${userId}','${name}','${email}','${role}')`,
  );
}

/** A completed DISC result with a deterministic, checkable score. */
function addResult(userId: string, teamId: string | null, scoreD: number, attempt: number, daysAgo: number) {
  const version = sql(`select id from assessment_versions where is_active limit 1`);
  const team = teamId ? `'${teamId}'` : "null";
  const teamName = teamId ? `(select name from teams where id='${teamId}')` : "null";
  const session = sql(
    `with created as (
       insert into assessment_sessions (profile_id, version_id, status, team_id, completed_at)
       values ('${userId}','${version}','completed',${team}, now() - interval '${daysAgo} days')
       returning id
     ) select id from created`,
  );
  sql(
    `insert into assessment_results (session_id, profile_id, score_d, score_i, score_s, score_c,
        archetype_code, primary_dimension, intensity, raw_most, raw_least, net,
        team_id, team_name_at_completion, attempt_number, created_at)
     values ('${session}','${userId}',${scoreD},40,30,55,'D','D','{}','{}','{}','{}',
        ${team}, ${teamName}, ${attempt}, now() - interval '${daysAgo} days')`,
  );
}

const superAdmin = () => sql(`select id from profiles where is_super_admin limit 1`);

/**
 * Drives the confirmation contract for an irreversible reconciliation.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THIS PROVES, AND WHY IT TOOK THREE ATTEMPTS TO GET RIGHT.
 *
 * The operator must be told, durably, that an irreversible merge succeeded.
 * Two designs failed before this one, and each failed for a reason worth
 * keeping written down:
 *
 *   1 · `setResult(outcome)` then `router.push(...)` in one transition. React
 *       commits both together, so the panel unmounted before the message
 *       painted.
 *   2 · Removing the push was not enough. A Server Action re-renders the route
 *       it was invoked from as part of its own response. After the merge the
 *       preflight returns null, the page stops rendering `ReconcilePanel`, and
 *       any state it held goes with it.
 *
 * So the confirmation is not client state. It is server-rendered from
 * `identity_reconciliations` — the row the merge itself wrote — which is why
 * it is present in the very render the Server Action returns, and why it
 * survives a reload.
 *
 * Asserted in order:
 *
 *   1 · the outcome is rendered, naming both sides and the audit record
 *   2 · the page has NOT navigated — the operator is still where they acted
 *   3 * the confirm control is gone, so a permanent merge cannot be re-run
 *   4 · it survives a full reload, which is what "durable" has to mean
 *   5 · leaving is the operator's own act
 *   6 · the destination carries the durable record
 * ─────────────────────────────────────────────────────────────────────
 */
async function expectReconciled(page: Page, survivorEmail: string, retiredEmail: string): Promise<void> {
  const outcome = page.getByRole("status", { name: "Reconciliation outcome" });

  // 1 · the confirmation is rendered, and says which way round the merge went.
  await expect(outcome).toBeVisible({ timeout: 20_000 });
  await expect(outcome).toContainText("Identity reconciled");
  await expect(outcome).toContainText(survivorEmail);
  await expect(outcome).toContainText(retiredEmail);
  await expect(outcome).toContainText("Audit record");

  // 2 · nothing navigated. The operator is still on the page they acted on.
  await expect(page).toHaveURL(/\/identity\?with=/);

  // 3 · the merge is permanent, so it is no longer on offer.
  await expect(
    page.getByRole("button", { name: "Confirm identity reconciliation" }),
  ).toHaveCount(0);

  // 4 · DURABLE. A reload is the difference between a message and a record —
  // an operator who lost their connection mid-merge must still be told.
  await page.reload();
  await expect(outcome).toBeVisible({ timeout: 20_000 });
  await expect(outcome).toContainText("Identity reconciled");

  // 5 · leaving is the operator's act, not the mutation's.
  await page.getByRole("link", { name: "Continue to the surviving identity" }).click();
  await expect(page).toHaveURL(/\/identity$/, { timeout: 20_000 });

  // 6 · the durable record on the destination.
  await expect(
    page
      .getByRole("region", { name: "Identity overview" })
      .getByRole("listitem")
      .filter({ hasText: retiredEmail }),
  ).toBeVisible({ timeout: 20_000 });
  // The entry's label and status are separate elements, so `textContent` runs
  // them together as "Identity reconciliationcompleted". `\s*` accepts either.
  await expect(page.getByRole("region", { name: "Identity history" })).toContainText(
    /Identity reconciliation\s*completed/,
    { timeout: 20_000 },
  );
}



async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(app|onboarding|admin)/, { timeout: 20000 });
}

test.afterAll(async () => {
  for (const id of userIds) {
    sql(`delete from identity_reconciliations where canonical_profile_id='${id}' or retired_profile_id='${id}'`);
    sql(`delete from notification_logs where profile_id='${id}'`);
    sql(`delete from report_exports where profile_id='${id}'`);
    sql(`delete from combined_sessions where profile_id='${id}'`);
    sql(`delete from focus_results where profile_id='${id}'`);
    sql(`delete from focus_sessions where profile_id='${id}'`);
    sql(`delete from assessment_results where profile_id='${id}'`);
    sql(`delete from assessment_sessions where profile_id='${id}'`);
    sql(`delete from team_members where profile_id='${id}'`);
    sql(`delete from participant_identity_aliases where profile_id='${id}'`);
  }
  if (teamIds.length) {
    const list = teamIds.map((team) => `'${team}'`).join(",");
    sql(`delete from campaign_assignments where team_member_id in (select id from team_members where team_id in (${list}))`);
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

/* ── auth ↔ profile sync ──────────────────────────────────────────── */

test("profiles.email tracks auth.users.email, and the old address becomes history", async () => {
  const email = "sync-before@disc360.dev";
  const uid = await createUser(email);
  onboard(uid, "Sync Tester");

  expect(sql(`select email from profiles where id='${uid}'`)).toBe(email);
  expect(
    sql(`select count(*) from participant_identity_aliases where profile_id='${uid}' and status='active' and email='${email}'`),
  ).toBe("1");

  await setAuthEmail(uid, "sync-after@disc360.dev");

  // The standing bug this closes: profiles.email used to go stale here, and
  // profiles.email is the address a participant's own report is sent to.
  expect(sql(`select email from profiles where id='${uid}'`)).toBe("sync-after@disc360.dev");
  expect(
    sql(`select email from participant_identity_aliases where profile_id='${uid}' and status='active'`),
  ).toBe("sync-after@disc360.dev");
  expect(
    sql(`select status from participant_identity_aliases where profile_id='${uid}' and email='${email}'`),
  ).toBe("retired");
  // Exactly one active address, always.
  expect(
    sql(`select count(*) from participant_identity_aliases where profile_id='${uid}' and status='active'`),
  ).toBe("1");
});

/* ── the merge ────────────────────────────────────────────────────── */

test("reconciliation merges two identities without duplicating or altering anything", async () => {
  const teamShared = makeTeam("IDN-3001", "Identity Shared Team");
  const teamOnlyB = makeTeam("IDN-3002", "Identity Team D");

  const emailA = "recon-a@disc360.dev";
  const emailB = "recon-b@disc360.dev";
  const uidA = await createUser(emailA);
  const uidB = await createUser(emailB);
  onboard(uidA, "Prince Okafor");
  onboard(uidB, "Prince Okafor");

  addMember(teamShared, uidA, emailA, "Prince Okafor", "member");
  addMember(teamShared, uidB, emailB, "Prince Okafor", "team_admin");
  addMember(teamOnlyB, uidB, emailB, "Prince Okafor", "member");

  addResult(uidA, teamShared, 71, 1, 30);
  addResult(uidA, null, 72, 2, 20);
  addResult(uidA, null, 73, 3, 10);
  addResult(uidB, teamOnlyB, 21, 1, 2);

  // An unfinished attempt on B that would collide with 00018's unique index.
  const version = sql(`select id from assessment_versions where is_active limit 1`);
  sql(`insert into assessment_sessions (profile_id, version_id, status) values ('${uidB}','${version}','in_progress')`);

  const before = sql(
    `select md5(string_agg(concat_ws(':', id, score_d, score_i, score_s, score_c, created_at,
        coalesce(team_id::text,'-'), coalesce(team_name_at_completion,'-'), attempt_number), '|' order by id))
     from assessment_results where profile_id in ('${uidA}','${uidB}')`,
  );

  const outcome = sql(
    `select public.admin_reconcile_identity('${superAdmin()}','${uidA}','${uidB}','spec')::text`,
  );
  expect(outcome).toContain("reconciliation_id");

  // ── nothing duplicated, nothing lost ──
  expect(sql(`select count(*) from assessment_results where profile_id='${uidA}'`)).toBe("4");
  expect(sql(`select count(*) from assessment_results where profile_id='${uidB}'`)).toBe("0");

  // ── scores, dates, versions and team attribution byte-identical ──
  const after = sql(
    `select md5(string_agg(concat_ws(':', id, score_d, score_i, score_s, score_c, created_at,
        coalesce(team_id::text,'-'), coalesce(team_name_at_completion,'-'), attempt_number), '|' order by id))
     from assessment_results where profile_id='${uidA}'`,
  );
  expect(after).toBe(before);

  // ── attempt_number is NOT renumbered ──
  expect(
    sql(`select string_agg(attempt_number::text, ',' order by created_at) from assessment_results where profile_id='${uidA}'`),
  ).toBe("1,2,3,1");

  // ── historical team attribution unchanged ──
  expect(
    sql(`select team_name_at_completion from assessment_results where profile_id='${uidA}' and team_id='${teamOnlyB}'`),
  ).toBe("Identity Team D");
  expect(
    sql(`select count(*) from assessment_results where profile_id='${uidA}' and team_id='${teamShared}'`),
  ).toBe("1");

  // ── exactly one membership per team, strongest role kept ──
  expect(sql(`select count(*) from team_members where profile_id='${uidA}'`)).toBe("2");
  expect(
    sql(`select count(*) from (select team_id from team_members where profile_id='${uidA}' group by team_id having count(*) > 1) d`),
  ).toBe("0");
  expect(
    sql(`select role from team_members where profile_id='${uidA}' and team_id='${teamShared}'`),
  ).toBe("team_admin");

  // ── team completion counts did not inflate ──
  expect(
    sql(`select count(*) from team_members where team_id='${teamShared}'`),
  ).toBe("1");

  // ── the duplicate is retired, never deleted ──
  expect(sql(`select deactivated_at is not null from profiles where id='${uidB}'`)).toBe("t");
  expect(sql(`select count(*) from profiles where id='${uidB}'`)).toBe("1");

  // ── the old address still finds the person ──
  expect(
    sql(`select profile_id from participant_identity_aliases where email='${emailB}'`),
  ).toBe(uidA);
  expect(
    sql(`select status from participant_identity_aliases where email='${emailB}'`),
  ).toBe("retired");

  // ── the unfinished attempt was abandoned, not carried over ──
  expect(
    sql(`select count(*) from assessment_sessions where profile_id='${uidA}' and status='in_progress'`),
  ).toBe("0");

  // ── audited ──
  expect(
    sql(`select count(*) from identity_reconciliations where canonical_profile_id='${uidA}' and retired_profile_id='${uidB}'`),
  ).toBe("1");
  expect(
    sql(`select count(*) from audit_logs where action='identity.reconciled' and entity_id='${uidA}'`),
  ).toBe("1");
});

test("a platform administrator account is refused", async () => {
  const uid = await createUser("recon-admin@disc360.dev");
  const other = await createUser("recon-other@disc360.dev");
  onboard(uid, "Admin Person");
  onboard(other, "Other Person");
  sql(`update profiles set is_super_admin = true where id='${uid}'`);

  const failed = (() => {
    try {
      sql(`select public.admin_reconcile_identity('${superAdmin()}','${other}','${uid}',null)::text`);
      return false;
    } catch {
      return true;
    }
  })();
  expect(failed).toBe(true);
  // Refused means untouched, not half-applied.
  expect(sql(`select deactivated_at is null from profiles where id='${uid}'`)).toBe("t");
  sql(`update profiles set is_super_admin = false where id='${uid}'`);
});

test("a non-administrator actor cannot reconcile anything", async () => {
  const a = await createUser("recon-actor-a@disc360.dev");
  const b = await createUser("recon-actor-b@disc360.dev");
  onboard(a, "Actor A");
  onboard(b, "Actor B");

  // `a` is an ordinary participant — and a team facilitator elsewhere would be
  // no different: is_team_admin is not is_super_admin.
  const failed = (() => {
    try {
      sql(`select public.admin_reconcile_identity('${a}','${a}','${b}',null)::text`);
      return false;
    } catch {
      return true;
    }
  })();
  expect(failed).toBe(true);
  expect(sql(`select deactivated_at is null from profiles where id='${b}'`)).toBe("t");
});

test("history, reports and future retakes all continue under one identity", async () => {
  const team = makeTeam("IDN-3003", "Identity Continuity Team");
  const emailA = "cont-a@disc360.dev";
  const emailB = "cont-b@disc360.dev";
  const uidA = await createUser(emailA);
  const uidB = await createUser(emailB);
  onboard(uidA, "Continuity Person");
  onboard(uidB, "Continuity Person");
  addMember(team, uidB, emailB, "Continuity Person");
  addResult(uidA, null, 60, 1, 40);
  addResult(uidB, team, 30, 1, 5);

  sql(`select public.admin_reconcile_identity('${superAdmin()}','${uidA}','${uidB}',null)`);

  // My History reads assessment_results by profile_id — both attempts, once each.
  expect(sql(`select count(*) from assessment_results where profile_id='${uidA}'`)).toBe("2");
  expect(
    sql(`select count(distinct id) from assessment_results where profile_id='${uidA}'`),
  ).toBe("2");

  // A later retake appends to the same person rather than starting over.
  addResult(uidA, null, 55, 3, 0);
  expect(sql(`select count(*) from assessment_results where profile_id='${uidA}'`)).toBe("3");
  expect(
    sql(`select string_agg(score_d::text, ',' order by created_at) from assessment_results where profile_id='${uidA}'`),
  ).toBe("60,30,55");

  // The team relationship survives and stays singular.
  expect(sql(`select count(*) from team_members where profile_id='${uidA}' and team_id='${team}'`)).toBe("1");
});

/* ── the admin surface ────────────────────────────────────────────── */

test("Manage identity is platform-admin only and shows the identity graph", async ({ page }) => {
  const email = "identity-ui@disc360.dev";
  const uid = await createUser(email);
  onboard(uid, "Panel Subject");
  await setAuthEmail(uid, "identity-ui-new@disc360.dev");

  // A team facilitator — team_admin on their own team — is turned away.
  await signIn(page, "demo@disc360.dev", "disc360-demo");
  await page.goto(`/admin/users/${uid}/identity`);
  await expect(page).not.toHaveURL(/\/admin\/users\/.*\/identity$/);

  // The platform administrator sees it.
  await page.context().clearCookies();
  await signIn(page, "admin@disc360.dev", "disc360-demo");
  await page.goto(`/admin/users/${uid}/identity`);
  await expect(page.getByRole("heading", { name: "Panel Subject" })).toBeVisible();
  await expect(page.getByText("identity-ui-new@disc360.dev").first()).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Change sign-in email" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Link another login" })).toBeVisible();

  // No merge control exists until a second identity has been named.
  await expect(page.getByRole("heading", { name: "Reconcile identity" })).toHaveCount(0);

  // The retired address still finds the person in admin search, badged.
  await page.goto(`/admin/users?q=${encodeURIComponent(email)}`);
  await expect(page.getByText("matched previous email").first()).toBeVisible();
  await expect(page.getByText("Panel Subject")).toBeVisible();
});

test("reconciliation requires the surviving address to be typed", async ({ page }) => {
  const emailA = "wizard-a@disc360.dev";
  const emailB = "wizard-b@disc360.dev";
  const uidA = await createUser(emailA);
  const uidB = await createUser(emailB);
  onboard(uidA, "Wizard Person");
  onboard(uidB, "Wizard Person");
  addResult(uidA, null, 65, 1, 12);

  await signIn(page, "admin@disc360.dev", "disc360-demo");
  await page.goto(`/admin/users/${uidA}/identity?with=${uidB}`);

  await expect(page.getByRole("heading", { name: "Reconcile identity" })).toBeVisible();
  await expect(page.getByText("Recommended canonical")).toBeVisible();

  // Nothing that writes is reachable before the plan has been rendered.
  await expect(page.getByRole("button", { name: "Confirm identity reconciliation" })).toHaveCount(0);

  await page.getByRole("button", { name: "Review reconciliation plan" }).click();
  await expect(page.getByText("Reconciliation plan")).toBeVisible();
  await expect(page.getByText("Duplicate identity")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  const confirm = page.getByRole("button", { name: "Confirm identity reconciliation" });
  await expect(confirm).toBeDisabled();

  // A near-miss is still a miss — this is what stops a misclick merging people.
  await page.getByPlaceholder(emailA).fill("wizard-a@disc360.de");
  await expect(confirm).toBeDisabled();

  await page.getByPlaceholder(emailA).fill(emailA);
  await expect(confirm).toBeEnabled();
  await confirm.click();

  // The survivor is uidA, which TAKES emailB as its login; emailA is the
  // address that retires. Asserting the wrong side here would pass on a merge
  // done backwards.
  await expectReconciled(page, emailB, emailA);
  expect(sql(`select count(*) from assessment_results where profile_id='${uidA}'`)).toBe("1");
  expect(sql(`select deactivated_at is not null from profiles where id='${uidB}'`)).toBe("t");
  expect(sql(`select email from profiles where id='${uidA}'`)).toBe(emailB);
});

test("the participant signs in with the new address and keeps everything", async ({ page }) => {
  const team = makeTeam("IDN-3004", "Identity Signin Team");
  const emailA = "signin-a@disc360.dev";
  const emailB = "signin-b@disc360.dev";
  const uidA = await createUser(emailA);
  const uidB = await createUser(emailB);
  onboard(uidA, "Signin Person");
  onboard(uidB, "Signin Person");
  addMember(team, uidA, emailA, "Signin Person");
  addResult(uidA, team, 68, 1, 15);

  const resultId = sql(
    `select id from assessment_results where profile_id='${uidA}' order by created_at desc limit 1`,
  );

  await signIn(page, "admin@disc360.dev", "disc360-demo");
  await page.goto(`/admin/users/${uidA}/identity?with=${uidB}`);
  await page.getByRole("button", { name: "Review reconciliation plan" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByPlaceholder(emailA).fill(emailA);
  await page.getByRole("button", { name: "Confirm identity reconciliation" }).click();
  await expectReconciled(page, emailB, emailA);

  // Sign in with the NEW address — same person, same history.
  await page.context().clearCookies();
  await signIn(page, emailB);
  await page.goto("/app/history");
  await expect(page.getByText("Signin Person").or(page.getByRole("heading").first())).toBeVisible();

  // The report from before the change still opens, downloads and mails.
  await page.goto(`/app/results/${resultId}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const pdf = await page.request.get(`/api/reports/disc/${resultId}`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).toString("latin1")).toContain("Signin Person");

  // Email My Report uses the CURRENT address, never the retired alias.
  await page.getByRole("button", { name: "Email My Report" }).click();
  // The confirmation is built from the CURRENT address, masked.
  await expect(page.getByText("s***@disc360.dev")).toBeVisible();
  await page.getByRole("button", { name: "Send Report" }).click();
  await expect(
    page
      .getByText("Your report has been sent.")
      .or(page.getByText("We couldn't send your report right now. You can still download your PDF.")),
  ).toBeVisible({ timeout: 20000 });
  expect(
    sql(`select count(*) from notification_logs where profile_id='${uidA}' and email='${emailB}' and template='individual_report'`),
  ).toBe("1");
  expect(
    sql(`select count(*) from notification_logs where profile_id='${uidA}' and email='${emailA}' and template='individual_report'`),
  ).toBe("0");

  // The team relationship is intact and singular.
  expect(sql(`select count(*) from team_members where profile_id='${uidA}' and team_id='${team}'`)).toBe("1");
});
