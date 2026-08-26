import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const code = (path: string) =>
  read(path)
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
    })
    .join("\n");

const MIGRATION = read("supabase/migrations/00032_wellbeing_campaign_type.sql");

/**
 * The product boundary.
 *
 * A Wellbeing Pulse campaign is stored as a team — it has members, an
 * organisation, a join token and a facilitator, and duplicating all of that
 * would have meant two identity models to keep in step. What made a campaign
 * render the DISC team dashboard was that nothing ever told the rest of the
 * product it was a different product: `assessment_type` kept its default.
 *
 * These tests hold that boundary at the three places it can be lost.
 */

test("choosing an instrument makes a team a wellbeing campaign", () => {
  const fn = MIGRATION.slice(MIGRATION.indexOf("function public.enforce_wellbeing_campaign_type"));
  assert.match(fn, /new\.assessment_type := 'wellbeing'/);
  assert.match(
    MIGRATION,
    /before insert or update of wellbeing_instrument_key, assessment_type on public\.teams/,
    "both fields must be watched, or an UPDATE to one can desynchronise them",
  );
});

test("the backfill never converts a team holding DISC or Focus work", () => {
  const update = MIGRATION.slice(MIGRATION.indexOf("update public.teams"), MIGRATION.indexOf("do $$"));
  assert.match(update, /not exists[\s\S]*assessment_sessions/, "a DISC team is left alone");
  assert.match(update, /not exists[\s\S]*focus_sessions/, "a Focus team is left alone");
});

test("the migration reads and writes no result, score or session", () => {
  assert.ok(
    !/(assessment_results|focus_results|wellbeing_results)/.test(MIGRATION),
    "relabelling a team must not touch anybody's results",
  );
  assert.ok(!/\bdelete\s+from\b|\bdrop\s+table\b/i.test(MIGRATION), "nothing destructive");
});

test("the DISC team layout refuses a wellbeing campaign", () => {
  const layout = code("app/app/(shell)/teams/[teamId]/layout.tsx");
  assert.match(layout, /assessment_type === "wellbeing"/);
  assert.match(layout, /redirect\(`\/wellbeing\/admin\/campaigns\/\$\{teamId\}`\)/);
  // The guard has to run before the DISC chrome RENDERS. Compare against the
  // JSX usage, not the import — the import is at the top of every file and
  // would make this assertion impossible to satisfy.
  assert.ok(
    layout.indexOf('assessment_type === "wellbeing"') < layout.indexOf("<TeamTabs"),
    "the boundary must be enforced before any DISC surface is composed",
  );
});

test("the DISC teams list excludes wellbeing campaigns", () => {
  const page = code("app/app/(shell)/teams/page.tsx");
  assert.match(page, /\.neq\("assessment_type", "wellbeing"\)/, "admin listing filters them out");
  assert.match(page, /assessment_type !== "wellbeing"/, "membership listing filters them too");
});

test("campaign creation sets the product type and the instrument together", () => {
  const action = code("lib/actions/wellbeing-admin.ts");
  const fn = action.slice(action.indexOf("export async function createWellbeingCampaignAction"));
  assert.match(fn, /assessment_type: "wellbeing"/);
  assert.match(fn, /wellbeing_instrument_key: instrumentKey/);
});

test("campaign creation refuses an instrument the licensing gate will not serve", () => {
  const action = code("lib/actions/wellbeing-admin.ts");
  const fn = action.slice(action.indexOf("export async function createWellbeingCampaignAction"));
  assert.match(fn, /canServeToParticipants\(/);
  // The gate must be consulted BEFORE the row is written, or a campaign exists
  // whose QR code refuses everyone who scans it.
  assert.ok(
    fn.indexOf("canServeToParticipants") < fn.indexOf('.from("teams")'),
    "licensing is checked before the campaign is created",
  );
});

test("a campaign is created for exactly one instrument, chosen up front", () => {
  const form = code("components/wellbeing/NewCampaignForm.tsx");
  assert.match(form, /name="instrument_key"/);
  assert.match(form, /type="radio"/, "one instrument, not a multi-select");
  assert.match(form, /disabled=\{!instrument\.available\}/, "unlicensed options cannot be chosen");
});

test("the pilot home offers both journeys for every instrument", () => {
  const page = code("app/(wellbeing)/wellbeing/admin/pilot/page.tsx");
  assert.match(page, /Test as participant|Preview participant experience/);
  assert.match(page, /View management experience/);
  assert.ok(!/recommended|best choice|we suggest/i.test(page), "no instrument is presented as the winner");
});

test("no wellbeing management surface offers a named-person comparison", () => {
  for (const path of [
    "app/(wellbeing)/wellbeing/admin/pilot/page.tsx",
    "app/(wellbeing)/wellbeing/admin/campaigns/[teamId]/page.tsx",
    "app/(wellbeing)/wellbeing/analytics/page.tsx",
    "components/wellbeing/analytics/WorkspaceNav.tsx",
  ]) {
    const source = code(path);
    assert.ok(
      !/Compare Members|compare-members|comparePeople/i.test(source),
      `${path} must never compare named people's wellbeing`,
    );
  }
});
