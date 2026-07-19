import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/**
 * Join-resolution regression suite for the SECURITY DEFINER RPCs
 * (resolve_join_token / resolve_team_code) and the states they surface:
 * valid token · valid/lowercase/whitespace team code · expired · revoked ·
 * inactive team · join-disabled · RLS-safe anonymous lookup · admin
 * dashboard still working · OAuth return preserving the invitation.
 *
 * Fixtures are created directly in the local database (service context) and
 * cleaned up after — the app under test only ever sees them anonymously.
 */

const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = (query: string) =>
  execSync(`psql "${DB}" -t -A -c ${JSON.stringify(query.replace(/\s+/g, " "))}`)
    .toString()
    .trim();

const ENG_TEAM = "30000000-0000-4000-8000-000000000002";
const FIX = "JRES"; // fixture code prefix

let orgId: string;
let creatorId: string;
const teamIds: string[] = [];

function makeTeam(opts: { code: string; archived?: boolean; joinEnabled?: boolean }): {
  id: string;
  token: string;
} {
  // CTE-wrapped so psql emits only the SELECT row (no INSERT command tag).
  const row = sql(
    `with created as (
       insert into teams (organization_id, name, description, team_code, created_by, join_enabled, archived_at)
       values ('${orgId}', 'Join Fixture ${opts.code}', 'join resolution fixture', '${opts.code}', '${creatorId}',
               ${opts.joinEnabled === false ? "false" : "true"},
               ${opts.archived ? "now()" : "null"})
       returning id, invite_token
     ) select id || '|' || invite_token from created`,
  );
  const [id, token] = row.split("|") as [string, string];
  teamIds.push(id);
  return { id, token };
}

test.beforeAll(() => {
  orgId = sql(`select organization_id from teams where id = '${ENG_TEAM}'`);
  creatorId = sql(`select created_by from teams where id = '${ENG_TEAM}'`);
});

test.afterAll(() => {
  if (teamIds.length) {
    sql(`delete from invitations where team_id in (${teamIds.map((t) => `'${t}'`).join(",")})`);
    sql(`delete from team_members where team_id in (${teamIds.map((t) => `'${t}'`).join(",")})`);
    sql(`delete from teams where id in (${teamIds.map((t) => `'${t}'`).join(",")})`);
  }
});

async function signInSolo(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("solo@disc360.dev");
  await page.getByLabel("Password", { exact: true }).fill("disc360-demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app**");
}

test("1+8: a valid token resolves anonymously to the join page (no auth, no service key path)", async ({
  page,
}) => {
  const team = makeTeam({ code: `${FIX}-1001` });
  await page.goto(`/join/${team.token}`);
  await expect(page.getByText(`Join Fixture ${FIX}-1001`)).toBeVisible();
  // The header sign-in keeps the invitation through auth (incl. OAuth return).
  await expect(page.getByRole("link", { name: /sign in/i })).toHaveAttribute(
    "href",
    `/sign-in?next=/join/${team.token}`,
  );
});

test("8b: the anon role cannot read the teams table directly", async () => {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const res = await fetch("http://127.0.0.1:54321/rest/v1/teams?select=id&limit=1", {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  const body = (await res.json()) as unknown[];
  // RLS: anonymous SELECT yields no rows — the RPC is the only public window.
  expect(Array.isArray(body) ? body.length : 0).toBe(0);
});

test("2+3+4: manual team code joins — exact, lowercase, and padded with spaces", async ({
  page,
}) => {
  const exact = makeTeam({ code: `${FIX}-2001` });
  const lower = makeTeam({ code: `${FIX}-2002` });
  const padded = makeTeam({ code: `${FIX}-2003` });
  void exact;

  await signInSolo(page);
  for (const [teamCode, input] of [
    [`${FIX}-2001`, `${FIX}-2001`],
    [`${FIX}-2002`, `${FIX.toLowerCase()}-2002`],
    [`${FIX}-2003`, `  ${FIX}-2003  `],
  ] as const) {
    await page.goto("/app/invitations");
    await page.getByLabel("Team code").fill(input);
    await page.getByRole("button", { name: "Join team" }).click();
    await page.waitForURL("**/app/teams/**", { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: `Join Fixture ${teamCode}` }),
    ).toBeVisible();
  }
  void lower;
  void padded;
});

test("5: an expired invitation says expired — not 'invalid link'", async ({ page }) => {
  const team = makeTeam({ code: `${FIX}-3001` });
  const token = sql(
    `with created as (
       insert into invitations (team_id, email, status, token, expires_at, invited_by)
       values ('${team.id}', 'expired-fixture@disc360.dev', 'pending', gen_random_uuid(), now() - interval '1 day', '${creatorId}')
       returning token
     ) select token from created`,
  );
  await page.goto(`/join/${token}`);
  await expect(page.getByText(/invitation has expired/i)).toBeVisible();
});

test("6: a revoked invitation says revoked", async ({ page }) => {
  const team = makeTeam({ code: `${FIX}-3002` });
  const token = sql(
    `with created as (
       insert into invitations (team_id, email, status, token, expires_at, invited_by)
       values ('${team.id}', 'revoked-fixture@disc360.dev', 'revoked', gen_random_uuid(), now() + interval '7 days', '${creatorId}')
       returning token
     ) select token from created`,
  );
  await page.goto(`/join/${token}`);
  await expect(page.getByText(/revoked by the team administrator/i)).toBeVisible();
});

test("7: an archived team reads as no longer active; join-disabled reads as disabled", async ({
  page,
}) => {
  const archived = makeTeam({ code: `${FIX}-3003`, archived: true });
  await page.goto(`/join/${archived.token}`);
  await expect(page.getByText(/no longer active/i)).toBeVisible();

  const disabled = makeTeam({ code: `${FIX}-3004`, joinEnabled: false });
  await page.goto(`/join/${disabled.token}`);
  await expect(page.getByText(/currently disabled/i)).toBeVisible();

  // The manual code path reports the same states distinctly.
  await signInSolo(page);
  await page.goto("/app/invitations");
  await page.getByLabel("Team code").fill(`${FIX}-3003`);
  await page.getByRole("button", { name: "Join team" }).click();
  await expect(page.getByText(/no longer active/i)).toBeVisible();
});

test("9: the team admin dashboard still resolves for an authenticated administrator", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("demo@disc360.dev");
  await page.getByLabel("Password", { exact: true }).fill("disc360-demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app**");
  await page.goto(`/app/teams/${ENG_TEAM}/dashboard`);
  await expect(page.getByRole("heading", { name: "Engineering Core" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Invite participants" })).toBeVisible();
});

test("10: an unknown token shows the invalid-link state (and only that)", async ({ page }) => {
  await page.goto("/join/00000000-0000-4000-8000-00000000dead");
  await expect(page.getByText(/join link is not valid/i)).toBeVisible();
});
