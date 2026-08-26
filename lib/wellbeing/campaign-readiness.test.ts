import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * Sub-unit / Team is a governed REQUIRED dimension, and readiness is how that
 * is made possible.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE RULE THESE TESTS EXIST TO HOLD.
 *
 * The field was briefly required "only where a catalogue exists". That reads
 * as resilience and is data loss: every response collected in that window has
 * a hole in a dimension the analytics compares on, and nobody finds out until
 * a cohort comparison is inexplicably thin.
 *
 * The correct shape is the opposite — the field is always required, and a
 * campaign whose organisation has no catalogue never opens. The configuration
 * problem belongs to the person who can fix it, not to somebody standing in a
 * corridor with a phone.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");
const code = (path: string) =>
  read(path)
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
    })
    .join("\n");

/* ── 1 · required, unconditionally ───────────────────────────────────── */

test("the context form requires every governed dimension", () => {
  const form = code("components/wellbeing/PulseFlow.tsx");
  assert.match(
    form,
    /if \(!departmentName \|\| !subUnitName \|\| !workLocation\)/,
    "department, sub-unit and work location are all required",
  );
  // No conditional requiredness anywhere near the sub-unit field.
  assert.ok(
    !/required=\{subUnitOptions\.length > 0\}/.test(form),
    "sub-unit must not be conditionally required",
  );
  assert.ok(
    !/disabled=\{subUnitOptions\.length === 0\}/.test(form),
    "and must not be silently disabled when unconfigured",
  );
  // Office Location stays conditional on WORK LOCATION, which is correct:
  // field-based work has no office, and the database refuses one.
  assert.match(form, /officeRequired = workLocation === "office_based"/);
  assert.match(form, /if \(officeRequired && !officeLocationName\)/);
  // Job title is the only optional field.
  assert.match(form, /Job Title/);
});

test("the server requires it too, with no escape branch", () => {
  const action = code("lib/actions/wellbeing.ts");
  const schema = action.slice(
    action.indexOf("const contextSchema"),
    action.indexOf("export interface ContextResult"),
  );
  assert.match(schema, /subUnitName: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(120\)/);
  assert.ok(
    !/subUnitName: z\.string\(\)[^,]*\.nullable\(\)/.test(schema),
    "a nullable sub-unit is the conditional rule coming back",
  );
  const save = action.slice(action.indexOf("export async function saveWellbeingContext"));
  assert.ok(
    !/configuredSubUnits/.test(save),
    "the action must not decide requiredness from catalogue contents",
  );
});

test("a resumed session that predates the field answers it", () => {
  const page = code("app/(wellbeing)/wellbeing/assessment/[sessionId]/page.tsx");
  assert.match(
    page,
    /session\.department_name &&\s*\n\s*session\.sub_unit_name &&/,
    "an incomplete context returns to the context step",
  );
});

/* ── 2 · readiness is what makes that possible ───────────────────────── */

test("readiness checks every lookup the context form is built from", () => {
  const readiness = code("lib/wellbeing/readiness.ts");
  for (const code_ of [
    "no_instrument",
    "instrument_not_servable",
    "no_questionnaire_content",
    "no_departments",
    "no_sub_units",
    "no_office_locations",
  ]) {
    assert.ok(readiness.includes(code_), `readiness must check ${code_}`);
  }
  // Work Location is a fixed enum, not a catalogue — nothing to check.
  assert.match(read("lib/wellbeing/readiness.ts"), /WORK_LOCATION_NEEDS_NO_CONFIGURATION/);
  assert.match(readiness, /canServeToParticipants\(/, "licensing is respected");
});

test("every readiness issue is actionable, not a status", () => {
  const readiness = read("lib/wellbeing/readiness.ts");
  // Every push, matched as a whole block — `code:` and `message:` are not
  // always adjacent, because some carry an explanatory comment between them.
  const pushes = [...readiness.matchAll(/issues\.push\(\{[\s\S]*?\}\);/g)].map((m) => m[0]);
  assert.ok(pushes.length >= 5, `only found ${pushes.length} issues`);
  // A message with no fix is a status, and a facilitator cannot act on a
  // status.
  for (const push of pushes) {
    assert.match(push, /code: "/, `an issue without a code: ${push.slice(0, 60)}`);
    assert.match(push, /message:/, `an issue without a message: ${push.slice(0, 60)}`);
    assert.match(push, /fix:/, `an issue without a fix is not actionable: ${push.slice(0, 60)}`);
  }
  // The escape hatch for an organisation that genuinely has none is stated as
  // configuration rather than left to be worked out.
  assert.match(readiness, /Not Applicable/, "the no-sub-units case names its own answer");
});

test("a participant is never shown the organisation's configuration state", () => {
  const readiness = code("lib/wellbeing/readiness.ts");
  assert.match(readiness, /CAMPAIGN_NOT_READY_PARTICIPANT_MESSAGE/);
  const message = /CAMPAIGN_NOT_READY_PARTICIPANT_MESSAGE =\s*\n?\s*"([^"]+)"/.exec(
    read("lib/wellbeing/readiness.ts"),
  )?.[1];
  assert.ok(message, "the participant message must exist");
  for (const leak of ["Sub-unit", "Department", "catalogue", "configure", "instrument"]) {
    assert.ok(
      !message!.toLowerCase().includes(leak.toLowerCase()),
      `the participant message must not expose "${leak}"`,
    );
  }
});

test("readiness is enforced before the invitation and before a session starts", () => {
  const invitation = code("app/(wellbeing-public)/wellbeing/join/[token]/page.tsx");
  assert.match(invitation, /await checkCampaignReadiness\(/);
  // Compared against the CALL, not the imported name — every import sits at
  // the top of the file and would make this assertion impossible to satisfy.
  assert.ok(
    invitation.indexOf("await checkCampaignReadiness(") <
      invitation.indexOf("acceptTeamLink(token)"),
    "an unready campaign must be refused before membership is granted",
  );

  // And again at the start action: a signed-in participant can reach it by a
  // link without passing the invitation.
  const action = code("lib/actions/wellbeing.ts");
  const begin = action.slice(
    action.indexOf("export async function beginWellbeingPulse"),
    action.indexOf("export async function saveWellbeingContext"),
  );
  assert.match(begin, /checkCampaignReadiness\(teamId, instrumentKey\)/);
  assert.ok(
    begin.indexOf("checkCampaignReadiness(teamId") < begin.indexOf(".insert({"),
    "readiness must be checked before a session row is written",
  );
});

test("the facilitator sees the actionable list, on both surfaces", () => {
  for (const path of [
    "app/(wellbeing)/wellbeing/admin/campaigns/[teamId]/page.tsx",
    "app/(wellbeing)/wellbeing/admin/campaigns/[teamId]/settings/page.tsx",
  ]) {
    const page = code(path);
    assert.match(page, /<ReadinessPanel readiness=\{readiness\} \/>/, `${path} must show it`);
    assert.match(page, /checkCampaignReadiness\(teamId, identity\.instrumentKey\)/);
  }
  const panel = code("components/wellbeing/campaign/ReadinessPanel.tsx");
  assert.match(panel, /issue\.message/);
  assert.match(panel, /issue\.fix/);
  assert.match(panel, /if \(readiness\.ready\) return null;/, "it disappears when there is nothing to do");
});

/* ── 3 · the analytics dimensions are already possible ───────────────── */

test("every intended Compare dimension is a snapshot on the result row", () => {
  // Section 6: no migration should be needed later. Each dimension must be a
  // value recorded AT COMPLETION, so a later rename cannot rewrite old rows.
  const columns = /WELLBEING_ANALYTICS_COLUMNS =\s*\n?\s*"([^"]+)"/.exec(
    read("lib/wellbeing/analytics.ts"),
  )?.[1];
  assert.ok(columns, "the analytics column list must be a single string literal");
  for (const column of [
    "department_at_completion",
    "work_location_at_completion",
    "office_location_at_completion",
    "team_id",
    "wave_id",
  ]) {
    assert.ok(columns!.includes(column), `${column} must be readable by analytics`);
  }

  // Sub-unit is stored the same way and is therefore one line of work away —
  // deliberately not wired into Compare in this pass, but requiring no
  // migration when it is.
  const migration = read("supabase/migrations/00035_wellbeing_sub_units.sql");
  assert.match(migration, /add column sub_unit_at_completion text/);
  assert.match(
    migration,
    /create index wellbeing_results_sub_unit_idx[\s\S]{0,140}sub_unit_at_completion/,
    "and its lookup path is already indexed",
  );
});

test("a renamed lookup never rewrites a completed result", () => {
  const snapshot = code("lib/wellbeing/snapshot.ts");
  // Every dimension is copied as TEXT at completion, not joined at read time.
  for (const field of [
    "department_at_completion",
    "sub_unit_at_completion",
    "office_location_at_completion",
  ]) {
    assert.ok(snapshot.includes(field), `${field} must be snapshotted`);
  }
  // And the result row is immutable afterwards.
  const waves = read("supabase/migrations/00034_wellbeing_waves.sql");
  assert.match(waves, /wellbeing_results_immutable/);
});

/* ── 5 · a missing table is not an empty catalogue ───────────────────── */
//
// This module ran in production against a database without
// `wellbeing_sub_units` — the code shipped, the migration had not. The query
// errored, `data` was null, and `(subUnits?.length ?? 0) === 0` read that as
// "the catalogue exists and is empty". Every campaign reported unready, and
// the facilitator was told to add a Sub-unit value to a table that did not
// exist. There was no action they could take.

test("readiness tells a missing relation apart from an empty catalogue", () => {
  const readiness = code("lib/wellbeing/readiness.ts");
  assert.match(
    readiness,
    /MISSING_RELATION_CODES = new Set\(\["PGRST205", "42P01"\]\)/,
    "PostgREST reports a missing relation as PGRST205, Postgres as 42P01",
  );
  assert.match(readiness, /code: "infrastructure_unavailable"/, "which is its own issue code");
  // The error must actually be READ. The old code destructured `data` only,
  // which is precisely how the distinction was lost.
  assert.match(
    readiness,
    /unavailable: Boolean\(result\.error\)/,
    "ANY error means the row count is meaningless — reading a failed query as zero rows is the bug itself",
  );
  assert.match(
    readiness,
    /missingRelation: Boolean\(result\.error && MISSING_RELATION_CODES\.has/,
    "and the relation-missing case is named precisely, because it can be",
  );
  assert.ok(
    !/\(subUnits\?\.length \?\? 0\) === 0/.test(readiness),
    "the count-only test that swallowed the error must be gone",
  );
});

test("a schema gap never asks the facilitator to configure something", () => {
  const readiness = code("lib/wellbeing/readiness.ts");
  const block = readiness.slice(
    readiness.indexOf('code: "infrastructure_unavailable"'),
    readiness.indexOf('if (departments.count === 0)'),
  );
  assert.match(block, /still being activated/, "it is described as a deployment in progress");
  assert.match(block, /no action is needed from you/, "and explicitly not the facilitator's to fix");
  assert.match(block, /table(s)? (is|are) not installed yet/, "and names the schema case when that is what happened");
  for (const instruction of ["Add at least one", "Wellbeing governance must add"]) {
    assert.ok(
      !block.includes(instruction),
      `a missing table must not produce "${instruction}"`,
    );
  }
});

test("a schema gap suppresses the catalogue advice entirely", () => {
  // Otherwise the facilitator gets "infrastructure is activating" followed by
  // three instructions they cannot carry out.
  const readiness = code("lib/wellbeing/readiness.ts");
  assert.match(
    readiness,
    /if \(unavailable\.length > 0\) \{[\s\S]{0,600}return \{ ready: false, issues \};/,
    "it returns immediately rather than falling through to the catalogue checks",
  );
});

test("the participant's message is identical either way", () => {
  // Neither state is theirs to fix, and neither should expose which it is.
  const readiness = code("lib/wellbeing/readiness.ts");
  const messages = [...readiness.matchAll(/CAMPAIGN_NOT_READY_PARTICIPANT_MESSAGE\s*=\s*$/gm)];
  assert.ok(messages.length <= 1, "there is exactly one participant message");
  const page = code("app/(wellbeing-public)/wellbeing/join/[token]/page.tsx");
  assert.match(page, /CAMPAIGN_NOT_READY_PARTICIPANT_MESSAGE/);
  // The participant page must not branch on the issue codes at all.
  for (const code_ of ["infrastructure_unavailable", "no_sub_units", "no_departments"]) {
    assert.ok(!page.includes(code_), `the invitation must not surface "${code_}"`);
  }
});
