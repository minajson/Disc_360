import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { test } from "node:test";
import { campaignAdmissionRefusal, ADMISSION_MARKERS } from "./admission.ts";

/**
 * ONE campaign architecture, and the boundary that keeps it one.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE IS FOR.
 *
 * `wellbeing_campaigns` shipped in 00044 — identity, join token, organisation,
 * instrument, PINNED questionnaire version, capacity, lifecycle — and for a
 * while no application code read or wrote it. The journey went on running
 * through DISC's machinery:
 *
 *   teams.invite_token → resolve_join_token → getActiveQuestionnaire()
 *
 * A table that exists but is not used is worse than no table: its harness
 * passes, its constraints look enforced, and the invariant it was built for
 * — a participant answers the version their campaign pinned — is simply not in
 * force. That gap was invisible because exactly one version per instrument may
 * be active, so "the active one" was accidentally the right answer.
 *
 * The adoption is done. This file is what stops it being undone, silently, by
 * a later change that reaches for the older and more familiar resolver.
 *
 * DISC IS NOT THE TARGET. `teams`, `invite_token` and `resolve_join_token` are
 * DISC's own architecture and stay exactly as they are. What is asserted here
 * is that WELLBEING does not depend on them.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");
/** Source with comments stripped — a comment about a boundary is not a boundary. */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");

function walk(dir: URL): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const child = new URL(`${entry}${entry.includes(".") ? "" : "/"}`, dir);
    const path = decodeURIComponent(child.pathname);
    if (statSync(path).isDirectory()) out.push(...walk(child));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

const ROOT_PATH = decodeURIComponent(ROOT.pathname);
const rel = (file: string) => file.slice(ROOT_PATH.length);

/** Every non-test source file that belongs to the WELLBEING product. */
function wellbeingSources(): { path: string; source: string }[] {
  const roots = [
    new URL("app/(wellbeing)/", ROOT),
    new URL("app/(wellbeing-public)/", ROOT),
    new URL("app/(wellbeing-present)/", ROOT),
    new URL("lib/wellbeing/", ROOT),
    new URL("components/wellbeing/", ROOT),
  ];
  return roots.flatMap((root) =>
    walk(root).map((file) => ({
      path: rel(file),
      source: readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/.*$/gm, " "),
    })),
  );
}

/* ── 1 · no wellbeing surface depends on DISC's resolver ─────────────── */

test("no wellbeing surface resolves a participant through DISC's join token", () => {
  const offenders: string[] = [];
  for (const { path, source } of wellbeingSources()) {
    if (/resolve_join_token|getJoinContext\(|acceptTeamLink\(/.test(source)) {
      offenders.push(path);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "a wellbeing surface reached for DISC's invitation resolver — the campaign token is the only credential",
  );
});

test("no wellbeing surface builds a join link from a team invite token", () => {
  const offenders: string[] = [];
  for (const { path, source } of wellbeingSources()) {
    if (/invite_token|inviteToken/.test(source)) offenders.push(path);
  }
  assert.deepEqual(
    offenders,
    [],
    "a wellbeing surface still carries a DISC team credential",
  );
});

/* ── 2 · the version is the campaign's pin, everywhere it matters ────── */

/**
 * `getActiveQuestionnaire` resolves by `is_active` — a fact about the clock.
 * It has exactly ONE legitimate caller left: the solo branch of
 * `beginWellbeingPulse`, for an attempt that belongs to no campaign and so has
 * no pin to read. Every other participant-facing read must go through
 * `getQuestionnaireByVersion`.
 */
test("the active-version lookup has exactly one caller, and it is the solo branch", () => {
  const callers: string[] = [];
  for (const { path, source } of wellbeingSources()) {
    if (path === "lib/wellbeing/queries.ts") continue; // where it is defined
    if (/getActiveQuestionnaire\(/.test(source)) callers.push(path);
  }
  assert.deepEqual(callers, [], "no wellbeing page or module may resolve by the active flag");

  const action = code("lib/actions/wellbeing.ts");
  const begin = action.slice(
    action.indexOf("export async function beginWellbeingPulse"),
    action.indexOf("export async function saveWellbeingContext"),
  );
  const activeCalls = begin.match(/getActiveQuestionnaire\(/g) ?? [];
  assert.equal(activeCalls.length, 1, "exactly one active-version lookup remains");
  assert.match(
    begin,
    /campaign\s*\?\s*await getQuestionnaireByVersion\(context, campaign\.versionId\)\s*:\s*await getActiveQuestionnaire\(/,
    "and it is the SOLO side of the campaign branch",
  );
});

test("a session is written with the campaign's own instrument and version", () => {
  const action = code("lib/actions/wellbeing.ts");
  const begin = action.slice(
    action.indexOf("export async function beginWellbeingPulse"),
    action.indexOf("export async function saveWellbeingContext"),
  );
  const insert = begin.slice(begin.indexOf('.from("wellbeing_sessions")\n    .insert('));
  assert.match(insert, /campaign_id: campaign\?\.campaignId \?\? null/);
  assert.match(insert, /version_id: questionnaire\.versionId/);
  // And the organisation is the campaign's, never a client's.
  assert.ok(
    !/organization_id: input\.|organization_id: parsed\.data\./.test(begin),
    "the organisation must never come from the caller",
  );
});

/* ── 3 · admission is the database's decision ────────────────────────── */

/**
 * Capacity and lifecycle cannot be enforced outside the transaction. Two
 * participants racing for the last place both pass any check made in the
 * application; only a row lock makes the final place gettable exactly once.
 * So the application must not be *deciding* — it must be translating.
 */
test("capacity and lifecycle are enforced in the database, not in the action", () => {
  const migration = read("supabase/migrations/00047_wellbeing_campaign_adoption.sql");
  assert.match(migration, /create trigger wellbeing_campaign_admission\s+before insert on public\.wellbeing_sessions/);
  assert.match(migration, /for update/, "the campaign row must be locked before counting");
  assert.match(migration, /count\(distinct s\.profile_id\)/, "capacity counts DISTINCT participants");
  // A participant who already holds a place keeps it — retake and resume.
  assert.match(
    migration,
    /where s\.campaign_id = new\.campaign_id and s\.profile_id = new\.profile_id/,
    "an existing participant must not consume a second place",
  );
  for (const marker of ADMISSION_MARKERS) {
    assert.ok(migration.includes(marker), `the trigger must raise ${marker}`);
  }
});

/**
 * The trigger must read the campaign as the RULE, not as the participant.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE DEFECT THIS PINS, WHICH TOOK THE LONGEST TO FIND.
 *
 * The admission trigger opens with `select ... from wellbeing_campaigns where
 * id = new.campaign_id FOR UPDATE`, and raises CAMPAIGN_NOT_FOUND if that
 * returns nothing. Written as a plain SECURITY INVOKER function, that read
 * runs with the inserting participant's privileges — and a LOCKING read is not
 * an ordinary read: PostgreSQL applies the UPDATE policies' USING clauses to
 * `SELECT ... FOR UPDATE` as well as the SELECT policies, because the row must
 * be lockable rather than merely readable.
 *
 * `wellbeing_campaigns_governance_updates` is governance-only, so for every
 * ordinary participant the row failed that check, the lookup found nothing,
 * and the trigger refused the attempt — reporting that the campaign did not
 * exist, while the application had just loaded it successfully.
 *
 * Granting participants SELECT (00048) was necessary and NOT sufficient: it
 * does not make a row lockable. Widening the UPDATE policy would have given
 * participants a write-shaped privilege on a governance table to satisfy a
 * read, so the functions became SECURITY DEFINER instead — they are
 * enforcement, they expose nothing, and their search_path is pinned.
 * ─────────────────────────────────────────────────────────────────────
 */
test("the admission and provenance triggers run as definer, with a pinned search_path", () => {
  const migration = read("supabase/migrations/00049_wellbeing_admission_security_definer.sql");
  for (const fn of [
    "enforce_wellbeing_campaign_admission",
    "enforce_wellbeing_result_provenance",
  ]) {
    const start = migration.indexOf(`create or replace function public.${fn}()`);
    assert.ok(start > -1, `${fn} must be redefined here`);
    const header = migration.slice(start, start + 220);
    assert.match(header, /security definer/, `${fn} must read as the rule, not the participant`);
    assert.match(header, /set search_path = public/, `${fn} must pin its search_path`);
  }
  // A definer function is only as narrow as who may call it.
  assert.match(migration, /revoke all on function public\.enforce_wellbeing_campaign_admission\(\) from public/);
  assert.match(migration, /revoke all on function public\.enforce_wellbeing_result_provenance\(\) from public/);
});

/**
 * The participant policy alone cannot be mistaken for the whole fix.
 *
 * 00048 grants SELECT; it is the definer change in 00049 that makes the
 * locking read work. Asserting them together is what stops somebody reverting
 * one on the grounds that the other covers it.
 */
test("participant read and definer enforcement are both present", () => {
  const select = read("supabase/migrations/00048_wellbeing_campaign_participant_read.sql");
  const definer = read("supabase/migrations/00049_wellbeing_admission_security_definer.sql");
  assert.match(select, /create policy wellbeing_campaigns_read_own_membership/);
  assert.match(definer, /security definer/);
});

test("every admission refusal is translated, and nothing else is", () => {
  for (const marker of ADMISSION_MARKERS) {
    assert.ok(campaignAdmissionRefusal({ hint: marker }), `${marker} must have a message`);
    // PostgREST does not always forward `hint`.
    assert.ok(campaignAdmissionRefusal({ message: `... ${marker} ...` }));
  }
  // A real fault is NOT dressed up as a full campaign.
  assert.equal(campaignAdmissionRefusal({ message: "connection reset" }), null);
  assert.equal(campaignAdmissionRefusal(null), null);
  assert.equal(campaignAdmissionRefusal(undefined), null);
});

test("a refusal never discloses a count, an id or an instrument", () => {
  for (const marker of ADMISSION_MARKERS) {
    const message = campaignAdmissionRefusal({
      hint: marker,
      // The database's own message carries ids and counts. None may leak.
      message: `Campaign 7f3a-uuid already has 9 of 10 places; instrument ghq28; version 00000000-0000-4000-8000-0000000000e1`,
    })!;
    for (const leak of ["uuid", "ghq28", "00000000", "9 of 10", "instrument"]) {
      assert.ok(
        !message.toLowerCase().includes(leak.toLowerCase()),
        `refusal for ${marker} leaked "${leak}": ${message}`,
      );
    }
  }
});

/* ── 4 · result provenance cannot drift ──────────────────────────────── */

/**
 * The WRITER's half of the provenance rule.
 *
 * The trigger below refuses a result whose campaign disagrees with its
 * session's — including a result that names no campaign at all when its
 * session does. That is exactly what happened: `completeWellbeingPulse` was
 * not updated to copy `campaign_id`, so every campaign-backed completion
 * failed at the last click. The constraint caught it, which is what it is for,
 * and this asserts the writer so the constraint does not have to.
 */
test("the completion writes the session's campaign onto the result", () => {
  const action = code("lib/actions/wellbeing.ts");
  const complete = action.slice(
    action.indexOf("export async function completeWellbeingPulse"),
    action.indexOf("export async function startWellbeingPulseAction"),
  );
  assert.match(
    complete,
    /\.select\(\s*"[^"]*campaign_id[^"]*"/,
    "the session's campaign must be read",
  );
  const insert = complete.slice(complete.indexOf('.from("wellbeing_results")'));
  assert.match(
    insert,
    /campaign_id: \(session\.campaign_id as string \| null\) \?\? null/,
    "and copied onto the result — never re-derived",
  );
  assert.match(insert, /version_id: session\.version_id/, "as is the version the session ran");
  assert.match(insert, /instrument_key: instrumentKey/);
});

test("a result must carry its session's campaign, instrument and version", () => {
  const migration = read("supabase/migrations/00047_wellbeing_campaign_adoption.sql");
  assert.match(migration, /create trigger wellbeing_results_provenance\s+before insert on public\.wellbeing_results/);
  assert.match(migration, /RESULT_CAMPAIGN_MISMATCH/);
  assert.match(migration, /RESULT_PROVENANCE_MISMATCH/);
  assert.match(migration, /RESULT_CAMPAIGN_INSTRUMENT_MISMATCH/);
});

/* ── 5 · the token ───────────────────────────────────────────────────── */

test("a new join token is CSPRNG-derived and not built from the campaign id", () => {
  const source = code("lib/wellbeing/campaigns.ts");
  assert.match(source, /randomBytes\(32\)\.toString\("base64url"\)/);
  // The function BODY only — a wider window catches the next declaration and
  // reports a false positive on the word it happens to contain.
  const start = source.indexOf("export function generateJoinToken");
  const body = source.slice(start, source.indexOf("}", start) + 1);
  assert.ok(
    !/campaignId|\bid\b|uuid/i.test(body),
    `a token must not be derived from the row it names: ${body}`,
  );
  // The column's own rule, so the application refuses before the database has to.
  assert.match(source, /\^\[A-Za-z0-9_-\]\{24,64\}\$/);
});

test("the campaign token is never written to an audit log", () => {
  const admin = code("lib/actions/wellbeing-admin.ts");
  const create = admin.slice(admin.indexOf("export async function createWellbeingCampaignAction"));
  const audit = create.slice(create.indexOf('action: "wellbeing.campaign_created"'));
  assert.ok(
    !/join_token|joinToken/.test(audit.slice(0, 600)),
    "an audit row is read by more people than may join",
  );
});

/* ── 6 · creation pins the version, once ─────────────────────────────── */

test("campaign creation writes a campaign row and pins a licensed active version", () => {
  const admin = code("lib/actions/wellbeing-admin.ts");
  const create = admin.slice(
    admin.indexOf("export async function createWellbeingCampaignAction"),
  );
  assert.match(create, /\.from\("wellbeing_campaigns"\)\s*\.insert\(/, "a campaign row is created");
  assert.match(create, /\.eq\("is_active", true\)/);
  assert.match(create, /\.eq\("content_status", "licensed"\)/);
  assert.match(create, /version_id: version\.id/, "and that version is pinned");
  assert.match(create, /join_token: generateJoinToken\(\)/);
  // The serving gate still runs, so a campaign cannot be created for an
  // instrument that may not be served here.
  assert.match(create, /canServeToParticipants\(/);

  // The roster team is created with joining DISABLED, so the campaign is not
  // reachable through the DISC invitation route.
  assert.match(create, /join_enabled: false/);
});

/* ── 7 · the roster team carries no live DISC invitation ─────────────── */

test("a wellbeing roster team cannot be joined through the DISC route", () => {
  const admin = code("lib/actions/wellbeing-admin.ts");
  const create = admin.slice(admin.indexOf("export async function createWellbeingCampaignAction"));
  const teamInsert = create.slice(create.indexOf('.from("teams")'), create.indexOf('.from("wellbeing_campaigns")'));
  assert.match(teamInsert, /join_enabled: false/);
  assert.match(teamInsert, /assessment_type: "wellbeing"/);
});
