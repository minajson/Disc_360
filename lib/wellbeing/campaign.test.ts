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

test("a campaign's instrument and version override anything the client sends", () => {
  const begin = ACTIONS.slice(
    ACTIONS.indexOf("export async function beginWellbeingPulse"),
    ACTIONS.indexOf("/* ── context step"),
  );
  // ─────────────────────────────────────────────────────────────────
  // This asserted `teamInstrument ?? (teamId ? ...)`, because the instrument
  // used to come from the TEAM and the version from whatever was active. Both
  // now come from the CAMPAIGN, which is the whole point: a team knows its
  // instrument but not which questionnaire version its participants were
  // pinned to, so a team-derived answer had to be completed by a clock-derived
  // one.
  // ─────────────────────────────────────────────────────────────────
  assert.match(
    begin,
    /campaign\?\.instrumentKey \?\? \(campaignId \? null : \(parsed\.data\.instrumentKey \?\? null\)\)/,
    "a campaign's instrument wins; a client value is honoured only for a solo attempt",
  );
  assert.match(
    begin,
    /loadAuthorisedCampaignById\(campaignId\)/,
    "the campaign is loaded server-side from its id",
  );
  // The version is the campaign's pin, never a re-resolved active one.
  assert.match(begin, /getQuestionnaireByVersion\(context, campaign\.versionId\)/);
  assert.ok(
    !/getActiveQuestionnaire\(context, instrumentKey\)[^]*campaign/.test(begin) ||
      /campaign\s*\?\s*await getQuestionnaireByVersion/.test(begin),
    "the active-version lookup must be the SOLO branch only",
  );
  // And nothing consequential is read from the form.
  assert.ok(
    !/formData\.get\("instrument_key"\)/.test(begin),
    "the instrument must not be read from the client inside the campaign path",
  );
});

test("a campaign with no instrument refuses to start rather than guessing", () => {
  const begin = ACTIONS.slice(ACTIONS.indexOf("export async function beginWellbeingPulse"));
  assert.match(begin, /has not been configured with a questionnaire yet/);
  assert.ok(
    !/\|\|\s*"disc360_wellbeing_v1"/.test(begin),
    "no silent substitution of a default instrument",
  );
});

test("the runner serves the session's own PINNED version, never a re-resolved one", () => {
  const page = code("app/(wellbeing)/wellbeing/assessment/[sessionId]/page.tsx");
  assert.match(page, /session\.instrument_key/);
  // ─────────────────────────────────────────────────────────────────
  // THE DEFECT THIS TEST USED TO CERTIFY.
  //
  // It asserted `getActiveQuestionnaire(context, instrumentKey)` while the
  // page's own comment said the questionnaire was "the one THIS session was
  // started with — never a freshly resolved active one". The test agreed with
  // the code and both disagreed with the comment: `getActiveQuestionnaire`
  // resolves by `is_active` and never reads `session.version_id`.
  //
  // So a participant part-way through a campaign would have had their
  // remaining items swapped under them the moment a new version was activated.
  // The test is now the one that would catch it.
  // ─────────────────────────────────────────────────────────────────
  assert.match(
    page,
    /getQuestionnaireByVersion\(context, session\.version_id as string\)/,
    "the runner must read the session's pinned version id",
  );
  assert.ok(
    !/getActiveQuestionnaire\(/.test(page),
    "the runner must never resolve a questionnaire by its active flag",
  );
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
    "app/(wellbeing)/wellbeing/admin/pilot/page.tsx",
    "app/(wellbeing)/wellbeing/admin/campaigns/new/page.tsx",
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

  // Every campaign tab authorises through ONE loader rather than each
  // repeating the guard — repetition is how a seventh tab ships without one.
  const loader = read("lib/wellbeing/campaign-workspace.ts");
  assert.match(loader, /export async function loadCampaignIdentity/);
  assert.match(loader, /await requireTeamAdmin\(teamId\)/, "administration is team administration");
  const identity = loader.slice(
    loader.indexOf("export async function loadCampaignIdentity"),
    loader.indexOf("/* ── participation administration"),
  );
  assert.ok(
    identity.indexOf("requireTeamAdmin") < identity.indexOf("createSupabaseAdminClient"),
    "the guard must run before the service role is created",
  );
  assert.match(
    identity,
    /assessment_type !== "wellbeing"/,
    "and a DISC team must not render the wellbeing workspace either",
  );

  for (const tab of ["", "/analytics", "/compare", "/trends", "/reports", "/settings"]) {
    const source = read(`app/(wellbeing)/wellbeing/admin/campaigns/[teamId]${tab}/page.tsx`);
    assert.match(
      source,
      /loadCampaignIdentity\(|loadCampaignReporting\(/,
      `campaign tab "${tab || "overview"}" must resolve through the guarded loader`,
    );
    assert.ok(
      !/await requireOnboarded\(\)/.test(source),
      `campaign tab "${tab || "overview"}" must not settle for merely being signed in`,
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

test("no participant surface links to a management route", () => {
  for (const path of [
    "components/wellbeing/PulseChrome.tsx",
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

test("the shell offers Campaigns only to somebody who runs one", () => {
  // A facilitator needs the campaign list in the navigation — burying the
  // product's central object at the bottom of a settings page is what this
  // link exists to fix. A participant must still never see it, and the gate
  // is resolved on the SERVER from memberships, not from a prop or a search
  // parameter.
  const layout = code("app/(wellbeing)/layout.tsx");

  const link = layout.indexOf("/wellbeing/admin/campaigns");
  assert.ok(link > -1, "a facilitator must be able to reach their campaigns");

  const guarded = layout.slice(Math.max(0, link - 120), link);
  assert.match(guarded, /if \(runsCampaigns\)/, "the campaigns link must be conditional");

  assert.match(
    layout,
    /const runsCampaigns =\s*\n?\s*profile\.is_super_admin/,
    "and the condition must be computed from server-resolved memberships",
  );

  // Team administration of a DISC team is not a reason to be shown a wellbeing
  // campaign list, so the membership lookup that grants it is instrument-typed.
  assert.match(layout, /assessment_type", "wellbeing"/);
});

/* ── the facilitator never sees a score ─────────────────────────────── */

test("the campaign roster reads session STATE and never a result", () => {
  const loader = code("lib/wellbeing/campaign-workspace.ts");
  for (const forbidden of [
    "wellbeing_results",
    "wellbeing_result_dimensions",
    "wellbeing_responses",
    "total_score",
    "index_score",
    "at_or_above_threshold",
  ]) {
    assert.ok(
      !loader.includes(forbidden),
      `the campaign workspace must not read ${forbidden} — names and scores stay apart`,
    );
  }
  assert.match(loader, /from\("wellbeing_sessions"\)/);
  assert.match(loader, /"profile_id, status, current_index, instrument_key, completed_at"/);
});

test("participation is a funnel of five states and none of them is a score", () => {
  const loader = read("lib/wellbeing/campaign-workspace.ts");
  const states = loader.slice(
    loader.indexOf("export const PARTICIPANT_STATE_LABEL"),
    loader.indexOf("export interface CampaignParticipant"),
  );
  assert.match(states, /"Not started"/);
  assert.match(states, /"Opened"/);
  assert.match(states, /"In progress"/);
  assert.match(states, /"Completed"/);

  // The vocabulary is closed. A sixth state is the edit that would turn
  // administrative status into result visibility.
  assert.match(
    loader,
    /export type ParticipantState = "pending" \| "opened" \| "started" \| "completed";/,
  );
});

test("completion status grants no route to a result", () => {
  const page = code("app/(wellbeing)/wellbeing/admin/campaigns/[teamId]/page.tsx");
  assert.ok(
    !/\/wellbeing\/result\//.test(page),
    "no roster row may link to anybody's individual result",
  );
  assert.ok(
    !/api\/wellbeing\/report/.test(page),
    "and no roster row may link to anybody's individual report",
  );
});
