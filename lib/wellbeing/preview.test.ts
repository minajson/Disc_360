import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildIllustrativeResult,
  buildStructurePreview,
  CONTENT_PENDING_PLACEHOLDER,
  ILLUSTRATIVE_BANNER,
  STRUCTURE_PREVIEW_BANNER,
} from "./preview.ts";
import { INSTRUMENTS, INSTRUMENT_KEYS } from "../../data/wellbeing-instruments.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** Source with comments stripped — a comment stating a rule is not a breach. */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const RESTRICTED = ["ghq12", "ghq28", "who5"] as const;

/* ── structure previews carry no content ────────────────────────────── */

test("a restricted instrument's preview contains no item wording at all", () => {
  for (const key of RESTRICTED) {
    const preview = buildStructurePreview(key);
    assert.equal(preview.contentAvailable, false, `${key} content must not be available`);
    assert.equal(preview.banner, STRUCTURE_PREVIEW_BANNER);
    assert.equal(preview.instruction, null, `${key} must not carry an instruction`);
    for (const item of preview.items) {
      assert.equal(item.prompt, null, `${key} item ${item.number} must have no wording`);
    }
  }
});

test("response options are generic placeholders, never plausible wording", () => {
  for (const key of RESTRICTED) {
    const preview = buildStructurePreview(key);
    assert.deepEqual(
      preview.optionLabels,
      Array.from(
        { length: INSTRUMENTS[key].responseOptionCount },
        (_, index) => `Response option ${index + 1}`,
      ),
    );
  }
});

test("the placeholder states that content is pending — it is not a fake question", () => {
  assert.match(CONTENT_PENDING_PLACEHOLDER, /available after licensing/i);
  assert.ok(!CONTENT_PENDING_PLACEHOLDER.includes("?"), "a placeholder must not read as a question");
});

test("each preview has the instrument's own item and option counts", () => {
  for (const key of INSTRUMENT_KEYS) {
    const preview = buildStructurePreview(key);
    assert.equal(preview.items.length, INSTRUMENTS[key].itemCount, `${key} item count`);
    assert.equal(
      preview.optionLabels.length,
      INSTRUMENTS[key].responseOptionCount,
      `${key} option count`,
    );
  }
});

test("GHQ-28 shows its four seven-item sections; GHQ-12 and WHO-5 invent none", () => {
  const ghq28 = buildStructurePreview("ghq28");
  assert.equal(ghq28.items.length, 28);
  const sections = [...new Set(ghq28.items.map((item) => item.sectionLabel))];
  assert.deepEqual(sections, [
    "Somatic symptoms",
    "Anxiety / insomnia",
    "Social dysfunction",
    "Severe depression",
  ]);
  assert.equal(ghq28.items.filter((item) => item.startsSection).length, 4);

  for (const key of ["ghq12", "who5"] as const) {
    const preview = buildStructurePreview(key);
    assert.ok(
      preview.items.every((item) => item.sectionLabel === null),
      `${key} has no published sections and must not be given any`,
    );
  }
});

test("DISC360 Wellbeing shows its real content — there is nothing to withhold", () => {
  const preview = buildStructurePreview("disc360_wellbeing_v1");
  assert.equal(preview.contentAvailable, true);
  assert.equal(preview.banner, null);
  assert.match(preview.instruction!, /past two weeks/i);
  assert.equal(preview.items.length, 12);
  assert.ok(preview.items.every((item) => (item.prompt?.length ?? 0) > 10));
  assert.deepEqual(preview.optionLabels, [
    "Never",
    "Rarely",
    "Sometimes",
    "Often",
    "Almost always",
  ]);
});

/* ── illustrative results ───────────────────────────────────────────── */

test("every illustrative result is labelled as demo data", () => {
  for (const key of INSTRUMENT_KEYS) {
    assert.equal(buildIllustrativeResult(key).banner, ILLUSTRATIVE_BANNER);
  }
});

test("illustrative figures match the brief's stated demo numbers", () => {
  const ghq12 = buildIllustrativeResult("ghq12");
  assert.equal(ghq12.headline, 4);
  assert.equal(ghq12.headlineMax, 12);
  assert.equal(ghq12.threshold, 4);
  assert.equal(ghq12.atOrAboveThreshold, true);
  assert.equal(ghq12.secondaryMax, 36);

  const ghq28 = buildIllustrativeResult("ghq28");
  assert.equal(ghq28.headline, 8);
  assert.equal(ghq28.headlineMax, 28);
  assert.equal(ghq28.threshold, 5);
  assert.equal(ghq28.secondaryMax, 84);
  assert.equal(ghq28.subscores.length, 4);

  const who5 = buildIllustrativeResult("who5");
  assert.equal(who5.rawScore, 16);
  assert.equal(who5.headline, 64, "WHO-5 uses its registered raw x 4");
  assert.equal(who5.headline, who5.rawScore! * 4);

  const disc = buildIllustrativeResult("disc360_wellbeing_v1");
  assert.equal(disc.headline, 74);
  assert.equal(disc.subscores.length, 6);
});

test("only instruments with a threshold show one in the preview", () => {
  for (const key of INSTRUMENT_KEYS) {
    const illustrative = buildIllustrativeResult(key);
    assert.equal(
      illustrative.threshold !== null,
      INSTRUMENTS[key].hasThreshold,
      `${key}: preview threshold must match the registry`,
    );
  }
  assert.equal(buildIllustrativeResult("who5").threshold, null);
  assert.equal(buildIllustrativeResult("disc360_wellbeing_v1").threshold, null);
});

test("no subscale carries a threshold, a band or a verdict", () => {
  for (const key of INSTRUMENT_KEYS) {
    for (const subscore of buildIllustrativeResult(key).subscores) {
      assert.deepEqual(
        Object.keys(subscore).sort(),
        ["key", "label", "max", "value"],
        `${key}: a subscore exposes a value and its scale only`,
      );
    }
  }
});

test("every illustrative subscore and history point sits inside its own scale", () => {
  for (const key of INSTRUMENT_KEYS) {
    const illustrative = buildIllustrativeResult(key);
    assert.ok(illustrative.headline <= illustrative.headlineMax);
    for (const subscore of illustrative.subscores) {
      assert.ok(subscore.value >= 0 && subscore.value <= subscore.max, `${key} subscore in range`);
    }
    for (const point of illustrative.history) {
      assert.ok(
        point.value >= 0 && point.value <= illustrative.headlineMax,
        `${key} history point in range`,
      );
    }
  }
});

/* ── the previews cannot write anything ─────────────────────────────── */

test("the preview module is pure — no database, no session, no persistence", () => {
  const source = code("lib/wellbeing/preview.ts");
  for (const forbidden of [
    "supabase",
    "createSupabaseAdminClient",
    "insert",
    "upsert",
    "server-only",
    "wellbeing_results",
    "wellbeing_sessions",
    "wellbeing_responses",
  ]) {
    assert.ok(!source.includes(forbidden), `preview.ts must not reference ${forbidden}`);
  }
});

test("no preview output carries an id that could be persisted", () => {
  for (const key of INSTRUMENT_KEYS) {
    const serialised = JSON.stringify({
      structure: buildStructurePreview(key),
      illustrative: buildIllustrativeResult(key),
    });
    for (const forbidden of ['"id"', "sessionId", "resultId", "profileId", "profile_id"]) {
      assert.ok(!serialised.includes(forbidden), `${key} preview must not carry ${forbidden}`);
    }
  }
});

test("the structure preview renders as static markup with no form or submit", () => {
  const page = code("app/(wellbeing)/wellbeing/admin/demo/[instrument]/page.tsx");
  // The options are list items, not inputs — there is no control to press and
  // no handler to fire, so "cannot submit" is a property of the markup.
  assert.ok(!page.includes("<form"), "the demo page must contain no form");
  assert.ok(!page.includes("onSubmit"), "the demo page must contain no submit handler");
  assert.ok(!page.includes('type="submit"'), "the demo page must contain no submit control");
  assert.ok(!page.includes("saveWellbeingResponse"), "the demo page must not save responses");
  assert.ok(!page.includes("completeWellbeingPulse"), "the demo page must not complete a pulse");
});

test("the demo surfaces read no participant data", () => {
  for (const path of [
    "app/(wellbeing)/wellbeing/admin/demo/page.tsx",
    "app/(wellbeing)/wellbeing/admin/demo/[instrument]/page.tsx",
    "app/(wellbeing)/wellbeing/admin/instruments/page.tsx",
  ]) {
    const source = code(path);
    for (const forbidden of [
      "wellbeing_results",
      "wellbeing_result_dimensions",
      "wellbeing_responses",
      "createSupabaseAdminClient",
    ]) {
      assert.ok(!source.includes(forbidden), `${path} must not read ${forbidden}`);
    }
  }
});


test("no management surface calls an instrument runnable while its content is pending", () => {
  for (const path of [
    "app/(wellbeing)/wellbeing/admin/demo/page.tsx",
    "app/(wellbeing)/wellbeing/admin/instruments/page.tsx",
  ]) {
    const source = code(path);
    // "Runnable" / "Available to participants" must be conditioned on loaded
    // content, not on the licensing gate alone.
    assert.match(
      source,
      /decision\.allowed && (contentLoaded|hasVersion)/,
      `${path}: readiness must require both the gate and loaded content`,
    );
  }
});
