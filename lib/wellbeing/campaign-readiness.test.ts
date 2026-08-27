import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * Which organisational dimensions a campaign must be configured for before a
 * participant may answer — and which it must NOT.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE RULE THESE TESTS EXIST TO HOLD.
 *
 * Department / Function and Office Location are governed catalogues. A
 * participant cannot invent either, so an empty catalogue is a campaign nobody
 * can finish, and readiness refuses it. The configuration problem belongs to
 * the person who can fix it, not to somebody standing in a corridor with a
 * phone.
 *
 * Sub-unit / Team was governed the same way, and required at least one
 * catalogue value before a campaign could open. That was withdrawn after it
 * failed twice in practice:
 *
 *   · Working-unit names change faster than a governed catalogue is
 *     maintained, so the dropdown routinely lacked the answer the participant
 *     needed — and a participant who cannot find their unit either abandons
 *     the pulse or picks something untrue.
 *   · `wellbeing_sub_units` has no product write path at all, which made the
 *     requirement unsatisfiable: a live pilot could not be opened because
 *     nothing in the product could create the row readiness demanded.
 *
 * It is now typed by the participant and optional. A campaign is READY with
 * zero sub-unit rows.
 *
 * The original objection — that an optional dimension yields cohorts with
 * holes in them — is answered rather than dismissed, and these tests hold that
 * answer: a blank stores null and forms no cohort, and typed values are
 * case-folded into one cohort per unit before they meet the suppression floor.
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

/* ── 1 · what the form requires, and what it does not ────────────────── */

test("the context form requires department and work location, never sub-unit", () => {
  const form = code("components/wellbeing/PulseFlow.tsx");
  assert.match(
    form,
    /if \(!departmentName \|\| !workLocation\)/,
    "department and work location are required",
  );
  assert.ok(
    !/!subUnitName \|\|/.test(form) && !/\|\| !subUnitName/.test(form),
    "sub-unit must not be part of the required check",
  );
  // Office Location stays conditional on WORK LOCATION, which is correct:
  // field-based work has no office, and the database refuses one.
  assert.match(form, /officeRequired = workLocation === "office_based"/);
  assert.match(form, /if \(officeRequired && !officeLocationName\)/);
});

test("sub-unit is a free-text input, not a dropdown, and is not required", () => {
  const form = code("components/wellbeing/PulseFlow.tsx");
  const start = form.indexOf('htmlFor="wb-sub-unit"');
  assert.ok(start > 0, "the sub-unit field must exist");
  const field = form.slice(start, form.indexOf("<fieldset", start));
  assert.match(field, /<input/, "it is typed, not chosen");
  assert.ok(!/<select/.test(field), "the governed dropdown must be gone");
  assert.ok(
    !/\brequired\b/.test(field),
    "an optional dimension must not carry the required attribute",
  );
  // The catalogue, where one exists, may still SUGGEST — without constraining.
  assert.match(field, /list=\{subUnitOptions\.length > 0 \? "wb-sub-unit-options" : undefined\}/);
  assert.match(field, /maxLength=\{ORG_FREE_TEXT_MAX\}/, "and is bounded to the column width");
});

test("Department offers Other, which reveals a required free-text box", () => {
  const form = code("components/wellbeing/PulseFlow.tsx");
  assert.match(form, /isOtherDepartment\(departmentName\) && \(/, "the box is conditional on Other");
  const box = form.slice(form.indexOf('htmlFor="wb-department-other"'));
  assert.match(box.slice(0, 400), /required/, "and required once shown");
  // Blank custom text is refused before anything is sent.
  assert.match(
    form,
    /isOtherDepartment\(departmentName\) && !normalizeOrgFreeText\(departmentOther\)/,
    "Other with an empty box must be blocked",
  );
  // The sentinel is never what gets stored.
  assert.match(
    form,
    /departmentName: otherDepartment \? departmentOther : departmentName/,
    "the typed value is what is submitted, not the word Other",
  );
  assert.match(
    form,
    /departmentId: otherDepartment \? null : departmentId/,
    "and free text carries no catalogue id",
  );
});

/* ── 2 · the server is the control, not the form ─────────────────────── */

test("the action accepts a null sub-unit and normalises what it is given", () => {
  const action = code("lib/actions/wellbeing.ts");
  const schema = action.slice(
    action.indexOf("const contextSchema"),
    action.indexOf("export interface ContextResult"),
  );
  assert.match(
    schema,
    /subUnitName: z\.string\(\)\.max\(ORG_FREE_TEXT_MAX\)\.nullable\(\)\.optional\(\)/,
    "sub-unit is optional and nullable",
  );
  const save = action.slice(action.indexOf("export async function saveWellbeingContext"));
  assert.match(
    save,
    /const subUnitName = normalizeOrgFreeText\(value\.subUnitName\)/,
    "whitespace-only input must collapse to null, not to an empty-string cohort",
  );
  assert.ok(
    !/configuredSubUnits/.test(save),
    "the action must not decide requiredness from catalogue contents",
  );
});

test("the server refuses Other left blank, independently of the form", () => {
  const action = code("lib/actions/wellbeing.ts");
  const save = action.slice(action.indexOf("export async function saveWellbeingContext"));
  assert.match(save, /if \(isOtherDepartment\(departmentName\)\) \{/, "the sentinel is refused");
  assert.match(save, /if \(departmentName === null\)/, "and so is an empty department");
  // The id must not survive a free-text answer.
  assert.match(save, /department_id: departmentIsCatalogued \? value\.departmentId : null/);
});

test("a blank sub-unit stores null rather than an empty string", () => {
  // An empty string is a third representation of "not answered", and would
  // group as its own cohort. Null forms no cohort at all.
  const freeText = code("lib/wellbeing/free-text.ts");
  assert.match(freeText, /if \(collapsed\.length === 0\) return null/);
});

test("a resumed session with no sub-unit is complete, not a loop", () => {
  const page = code("app/(wellbeing)/wellbeing/assessment/[sessionId]/page.tsx");
  const gate = page.slice(page.indexOf("const contextComplete"), page.indexOf("return ("));
  assert.match(gate, /session\.department_name &&/);
  assert.ok(
    !/session\.sub_unit_name/.test(gate),
    "requiring sub-unit here returns the participant to the context step forever",
  );
  // It must mirror the database's own completed-session predicate.
  assert.match(gate, /workLocation === "field_based" \|\| session\.office_location_name/);
});

/* ── 3 · readiness ───────────────────────────────────────────────────── */

test("readiness checks the catalogues a participant cannot supply", () => {
  const readiness = code("lib/wellbeing/readiness.ts");
  for (const code_ of [
    "no_instrument",
    "instrument_not_servable",
    "no_questionnaire_content",
    "no_departments",
    "no_office_locations",
  ]) {
    assert.ok(readiness.includes(code_), `readiness must check ${code_}`);
  }
  assert.match(read("lib/wellbeing/readiness.ts"), /WORK_LOCATION_NEEDS_NO_CONFIGURATION/);
  assert.match(readiness, /canServeToParticipants\(/, "licensing is respected");
});

test("a campaign is ready with zero configured sub-units", () => {
  const readiness = code("lib/wellbeing/readiness.ts");
  assert.ok(
    !readiness.includes("no_sub_units"),
    "the sub-unit blocker must be gone from the issue codes",
  );
  assert.ok(
    !/from\("wellbeing_sub_units"\)/.test(readiness),
    "readiness must not consult the sub-unit catalogue at all",
  );
  assert.ok(
    !/Not Applicable/.test(readiness),
    "the workaround value is no longer how an organisation without sub-units proceeds",
  );
});

test("every readiness issue is actionable, not a status", () => {
  const readiness = read("lib/wellbeing/readiness.ts");
  const pushes = [...readiness.matchAll(/issues\.push\(\{[\s\S]*?\}\);/g)].map((m) => m[0]);
  assert.ok(pushes.length >= 4, `only found ${pushes.length} issues`);
  for (const push of pushes) {
    assert.match(push, /code: "/, `an issue without a code: ${push.slice(0, 60)}`);
    assert.match(push, /message:/, `an issue without a message: ${push.slice(0, 60)}`);
    assert.match(push, /fix:/, `an issue without a fix is not actionable: ${push.slice(0, 60)}`);
  }
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
  assert.ok(
    invitation.indexOf("await checkCampaignReadiness(") <
      invitation.indexOf("acceptTeamLink(token)"),
    "an unready campaign must be refused before membership is granted",
  );
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
  assert.match(
    panel,
    /if \(readiness\.ready\) return null;/,
    "it disappears when there is nothing to do",
  );
});

/* ── 4 · history is still immutable ──────────────────────────────────── */

test("every Compare dimension is a snapshot on the result row", () => {
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
});

test("a renamed lookup never rewrites a completed result", () => {
  const snapshot = code("lib/wellbeing/snapshot.ts");
  for (const field of [
    "department_at_completion",
    "sub_unit_at_completion",
    "office_location_at_completion",
  ]) {
    assert.ok(snapshot.includes(field), `${field} must be snapshotted`);
  }
  const waves = read("supabase/migrations/00034_wellbeing_waves.sql");
  assert.match(waves, /wellbeing_results_immutable/);
});

test("free-text sub-unit needed no schema change", () => {
  // The column was already nullable text, and the database's own
  // completed-session predicate never required it — so the change is
  // application-level only.
  const sessions = read("supabase/migrations/00035_wellbeing_sub_units.sql");
  assert.match(sessions, /add column sub_unit_id uuid[\s\S]{0,200}sub_unit_name text/);
  assert.match(sessions, /add column sub_unit_at_completion text/);
  const pulse = read("supabase/migrations/00023_wellbeing_pulse.sql");
  const predicate = /wellbeing_sessions_completed_is_complete[\s\S]{0,600}?\)\s*\)/.exec(pulse)?.[0];
  assert.ok(predicate, "the completed-session predicate must exist");
  assert.ok(
    !/sub_unit/.test(predicate!),
    "the database never required a sub-unit on a completed session",
  );
});

/* ── 5 · a missing table is not an empty catalogue ───────────────────── */

test("readiness tells a missing relation apart from an empty catalogue", () => {
  const readiness = code("lib/wellbeing/readiness.ts");
  assert.match(
    readiness,
    /MISSING_RELATION_CODES = new Set\(\["PGRST205", "42P01"\]\)/,
    "PostgREST reports a missing relation as PGRST205, Postgres as 42P01",
  );
  assert.match(readiness, /code: "infrastructure_unavailable"/, "which is its own issue code");
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
});

test("a schema gap never asks the facilitator to configure something", () => {
  const readiness = code("lib/wellbeing/readiness.ts");
  const block = readiness.slice(
    readiness.indexOf('code: "infrastructure_unavailable"'),
    readiness.indexOf("if (departments.count === 0)"),
  );
  assert.match(block, /still being activated/, "it is described as a deployment in progress");
  assert.match(block, /no action is needed from you/, "and explicitly not the facilitator's to fix");
  assert.match(
    block,
    /tables? (is|are) not installed yet/,
    "and names the schema case when that is what happened",
  );
  for (const instruction of ["Add at least one", "Wellbeing governance must add"]) {
    assert.ok(!block.includes(instruction), `a missing table must not produce "${instruction}"`);
  }
});

test("a schema gap suppresses the catalogue advice entirely", () => {
  const readiness = code("lib/wellbeing/readiness.ts");
  assert.match(
    readiness,
    /if \(unavailable\.length > 0\) \{[\s\S]{0,600}return \{ ready: false, issues \};/,
    "it returns immediately rather than falling through to the catalogue checks",
  );
});

test("the participant's message is identical either way", () => {
  const readiness = code("lib/wellbeing/readiness.ts");
  const messages = [...readiness.matchAll(/CAMPAIGN_NOT_READY_PARTICIPANT_MESSAGE\s*=\s*$/gm)];
  assert.ok(messages.length <= 1, "there is exactly one participant message");
  const page = code("app/(wellbeing-public)/wellbeing/join/[token]/page.tsx");
  assert.match(page, /CAMPAIGN_NOT_READY_PARTICIPANT_MESSAGE/);
  for (const code_ of ["infrastructure_unavailable", "no_departments"]) {
    assert.ok(!page.includes(code_), `the invitation must not surface "${code_}"`);
  }
});
