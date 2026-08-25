import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Campaign instrument selection, locking and routing.
 *
 * Source-level, because these are absolutes about what CANNOT happen. The
 * database trigger and the RLS policies are exercised separately by
 * scripts/verify-wellbeing-privacy.sql and the campaign-locking checks in it;
 * what is asserted here is that no application path bypasses them.
 */

const ROOT = new URL("../../", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const ACTIONS = read("lib/actions/wellbeing.ts");
const ADMIN_ACTIONS = read("lib/actions/wellbeing-admin.ts");
const MIGRATION = read("supabase/migrations/00029_wellbeing_campaign_locking.sql");

/* ── exactly one instrument per campaign ────────────────────────────── */

test("a campaign stores exactly one instrument key", () => {
  const migration = read("supabase/migrations/00025_wellbeing_instruments.sql");
  // A single scalar column with a foreign key — not an array, not a join table.
  assert.match(
    migration,
    /add column wellbeing_instrument_key text\s*\n\s*references public\.wellbeing_instruments \(key\)/,
  );
  assert.ok(
    !/wellbeing_instrument_keys/.test(migration),
    "a campaign must not be able to hold several instruments",
  );
});

/* ── locking ────────────────────────────────────────────────────────── */

test("the instrument lock is enforced by a database trigger, not the UI", () => {
  assert.match(MIGRATION, /create trigger wellbeing_instrument_lock/);
  assert.match(MIGRATION, /before update of wellbeing_instrument_key on public\.teams/);
  assert.match(MIGRATION, /raise exception/);
});

test("the lock counts attempts on the OUTGOING instrument", () => {
  // Counting the incoming instrument would let a switch through whenever the
  // new instrument happened to have no attempts — which is always, at first.
  assert.match(MIGRATION, /s\.instrument_key = old\.wellbeing_instrument_key/);
});

test("the lock permits first selection and pre-launch changes", () => {
  assert.match(
    MIGRATION,
    /if old\.wellbeing_instrument_key is null then\s*\n\s*return new;/,
    "setting an instrument for the first time must be allowed",
  );
  assert.match(
    MIGRATION,
    /is not distinct from old\.wellbeing_instrument_key/,
    "a no-op update must not be treated as a change",
  );
});

test("the action surfaces the lock rather than reimplementing it", () => {
  const setter = ADMIN_ACTIONS.slice(
    ADMIN_ACTIONS.indexOf("export async function setCampaignInstrumentAction"),
  );
  assert.match(setter, /Wellbeing instrument is locked/, "it recognises the trigger's message");
  assert.match(setter, /Create a new campaign/, "and tells the facilitator what to do instead");
});

/* ── licensing is re-checked server-side ────────────────────────────── */

test("selecting an instrument re-checks the licensing gate on the server", () => {
  const setter = ADMIN_ACTIONS.slice(
    ADMIN_ACTIONS.indexOf("export async function setCampaignInstrumentAction"),
  );
  assert.match(setter, /canServeToParticipants\(/);
  assert.match(setter, /isProductionEnvironment\(\)/);
  assert.match(setter, /isWellbeingDemoEnabled\(\)/);
  assert.match(setter, /requireTeamAdmin\(/, "and authorizes the facilitator");
});

/* ── the participant never chooses ──────────────────────────────────── */

test("a team campaign's instrument overrides anything the client sends", () => {
  const begin = ACTIONS.slice(
    ACTIONS.indexOf("export async function beginWellbeingPulse"),
    ACTIONS.indexOf("/* ── context step"),
  );
  // Team first, client value only for a solo attempt.
  assert.match(begin, /teamInstrument \?\? \(teamId \? null : \(parsed\.data\.instrumentKey \?\? null\)\)/);
  assert.match(begin, /getTeamInstrument\(context, teamId\)/);
});

test("a campaign with no instrument refuses to start rather than guessing", () => {
  const begin = ACTIONS.slice(ACTIONS.indexOf("export async function beginWellbeingPulse"));
  assert.match(begin, /has not been configured with a questionnaire yet/);
  assert.ok(
    !/\|\|\s*"disc360_wellbeing_v1"/.test(begin),
    "no silent substitution of a default instrument",
  );
});

test("the runner serves the session's own instrument, never a re-resolved one", () => {
  const page = code("app/(wellbeing)/wellbeing/assessment/[sessionId]/page.tsx");
  assert.match(page, /session\.instrument_key/);
  assert.match(page, /getActiveQuestionnaire\(context, instrumentKey\)/);
});

test("starting a pulse validates any client-supplied instrument against the registry", () => {
  assert.match(ACTIONS, /isInstrumentKey\(requested\)/);
  assert.match(
    ACTIONS,
    /instrumentKey: z\.enum\(\["ghq12", "disc360_wellbeing_v1"\]\)|z\.enum\(\[/,
    "the schema constrains the value",
  );
});

/* ── restricted instruments cannot launch ───────────────────────────── */

test("the participant start path refuses an instrument with no live version", () => {
  const begin = ACTIONS.slice(ACTIONS.indexOf("export async function beginWellbeingPulse"));
  assert.match(begin, /awaiting licence confirmation/);
  assert.match(begin, /external_rights_required/);
});

/* ── demo surfaces are gated and invisible to participants ──────────── */

test("management demo routes require both the environment flag and elevated scope", () => {
  const gate = read("lib/wellbeing/demo-access.ts");
  assert.match(gate, /isProductionEnvironment\(\)/);
  assert.match(gate, /isWellbeingDemoEnabled\(\)/);
  assert.match(gate, /is_super_admin/);
  assert.match(gate, /wellbeing_role_grants/);
  // Redirect, not an error page — the surface is not advertised.
  assert.match(gate, /redirect\("\/wellbeing"\)/);
});

test("every management demo page is behind the gate", () => {
  for (const path of [
    "app/(wellbeing)/wellbeing/admin/demo/page.tsx",
    "app/(wellbeing)/wellbeing/admin/demo/[instrument]/page.tsx",
  ]) {
    assert.match(read(path), /requireManagementDemo\(\)/, `${path} must be gated`);
  }
});

test("NO page under /wellbeing/admin is reachable on requireOnboarded alone", () => {
  // The instrument comparison carries no participant data, which once made
  // `requireOnboarded` look sufficient. It is not: "carries nothing private"
  // and "is for participants" are different questions, and every surface in
  // this directory answers no to the second.
  for (const path of [
    "app/(wellbeing)/wellbeing/admin/demo/page.tsx",
    "app/(wellbeing)/wellbeing/admin/demo/[instrument]/page.tsx",
    "app/(wellbeing)/wellbeing/admin/instruments/page.tsx",
    "app/(wellbeing)/wellbeing/admin/campaigns/[teamId]/page.tsx",
  ]) {
    const source = read(path);
    assert.match(
      source,
      /requireManagementDemo\(\)|requireManagementSurface\(\)|requireTeamAdmin\(/,
      `${path} must demand elevated scope`,
    );
    assert.ok(
      !/await requireOnboarded\(\)/.test(source),
      `${path} must not settle for merely being signed in`,
    );
  }
});

test("the management-surface gate demands elevated scope and redirects", () => {
  const gate = read("lib/wellbeing/demo-access.ts");
  const fn = gate.slice(gate.indexOf("export async function requireManagementSurface"));
  assert.match(fn, /is_super_admin/, "platform admin passes");
  assert.match(fn, /wellbeing_role_grants/, "a wellbeing role passes");
  assert.match(fn, /team_members/, "a team admin passes — they choose the instrument");
  assert.match(fn, /redirect\("\/wellbeing"\)/, "everyone else is redirected, not refused");
});

test("the participant shell never links to a management demo route", () => {
  for (const path of [
    "components/wellbeing/PulseChrome.tsx",
    "app/(wellbeing)/layout.tsx",
    "app/(wellbeing)/wellbeing/page.tsx",
    "app/(wellbeing)/wellbeing/history/page.tsx",
    "app/(wellbeing)/wellbeing/result/[resultId]/page.tsx",
  ]) {
    const source = code(path);
    assert.ok(
      !source.includes("/wellbeing/admin"),
      `${path} must not expose a management route to participants`,
    );
  }
});

/* ── the facilitator never sees a score ─────────────────────────────── */

test("the campaign dashboard reads session STATE and never a result", () => {
  const page = code("app/(wellbeing)/wellbeing/admin/campaigns/[teamId]/page.tsx");
  for (const forbidden of [
    "wellbeing_results",
    "wellbeing_result_dimensions",
    "wellbeing_responses",
    "total_score",
    "index_score",
  ]) {
    assert.ok(
      !page.includes(forbidden),
      `the facilitator dashboard must not read ${forbidden} — names and scores stay apart`,
    );
  }
  assert.match(page, /from\("wellbeing_sessions"\)/);
  assert.match(page, /"profile_id, status, instrument_key, completed_at"/);
});

test("live progress reports only not-started, in-progress and completed", () => {
  const page = read("app/(wellbeing)/wellbeing/admin/campaigns/[teamId]/page.tsx");
  assert.match(page, /"Not started"/);
  assert.match(page, /"In progress"/);
  assert.match(page, /"Completed"/);
});
