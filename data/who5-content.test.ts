import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  WHO5_EXAMPLE,
  WHO5_ITEM_COUNT,
  WHO5_ITEM_STRUCTURE,
  WHO5_POINTS_BY_POSITION,
  WHO5_RAW_MAX,
  WHO5_RECALL_WINDOW,
  WHO5_RESPONSE_OPTIONS,
  WHO5_RESPONSE_POSITIONS,
  WHO5_SOURCE_CITATION,
  WHO5_SOURCE_DOCUMENT,
  WHO5_STEM,
  WHO5_SUGGESTED_CUTOFF_PERCENTAGE,
  WHO5_TRANSFORM_MULTIPLIER,
} from "./who5-items.ts";
import { INSTRUMENTS } from "./wellbeing-instruments.ts";
import { DISC360_WELLBEING_ITEMS } from "./disc360-wellbeing-items.ts";

/**
 * WHO-5 content, checked against its official publication.
 *
 * ─────────────────────────────────────────────────────────────────────
 * SOURCE.
 *
 * World Health Organization. The World Health Organization-Five Well-Being
 * Index (WHO-5). Geneva: World Health Organization; 2024.
 * Document WHO/UCN/MSD/MHE/2024.1. Licence: CC BY-NC-SA 3.0 IGO.
 *
 * These tests exist because the instrument is somebody else's, reproduced
 * under a licence with conditions. A paraphrase would be both a measurement
 * error and a licence problem: WHO-5's psychometrics belong to WHO-5's exact
 * wording, and ShareAlike attaches to adaptations. So the wording is asserted
 * literally, and a future edit has to be deliberate enough to change a test
 * that says why it must not be.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");

/* ── 1 · the instrument, verbatim ────────────────────────────────────── */

test("the five items are the published items, in the published order", () => {
  assert.equal(WHO5_ITEM_STRUCTURE.length, 5);
  assert.deepEqual(
    WHO5_ITEM_STRUCTURE.map((item) => item.prompt),
    [
      "I have felt cheerful and in good spirits.",
      "I have felt calm and relaxed.",
      "I have felt active and vigorous.",
      "I woke up feeling fresh and rested.",
      "My daily life has been filled with things that interest me.",
    ],
  );
  // Published numbering is 1-based and administration order is 0-based; they
  // must not drift apart, or item 4 stops being item 4.
  WHO5_ITEM_STRUCTURE.forEach((item, index) => {
    assert.equal(item.position, index);
    assert.equal(item.number, index + 1);
  });
});

test("the six response anchors are the published anchors, with published points", () => {
  assert.equal(WHO5_RESPONSE_OPTIONS.length, WHO5_RESPONSE_POSITIONS);
  assert.deepEqual(
    WHO5_RESPONSE_OPTIONS.map((option) => [option.label, option.points]),
    [
      ["At no time", 0],
      ["Some of the time", 1],
      ["Less than half the time", 2],
      ["More than half the time", 3],
      ["Most of the time", 4],
      ["All the time", 5],
    ],
  );
});

test("position and points ascend together, so a stored position reads back correctly", () => {
  WHO5_RESPONSE_OPTIONS.forEach((option, index) => {
    assert.equal(option.position, index);
    assert.equal(option.points, WHO5_POINTS_BY_POSITION[index]);
  });
});

test("the instruction and example are the published wording", () => {
  assert.match(WHO5_STEM, /closest to how you have been feeling over the last two weeks/);
  // The supplied guide's instruction stops there; the "higher numbers" sentence
  // belongs to the WHO publication and is deliberately not carried.
  assert.ok(!/higher numbers/.test(WHO5_STEM));
  assert.match(WHO5_EXAMPLE, /cheerful and in good spirits more than half of the time/);
  assert.match(WHO5_EXAMPLE, /select number three/);
  assert.equal(WHO5_RECALL_WINDOW, "the last two weeks");
});

test("the published arithmetic is what is recorded", () => {
  assert.equal(WHO5_ITEM_COUNT, 5);
  assert.equal(WHO5_RAW_MAX, 25, "five items at five points");
  assert.equal(WHO5_TRANSFORM_MULTIPLIER, 4, "raw x 4 gives the 0-100 percentage scale");
  assert.equal(WHO5_RAW_MAX * WHO5_TRANSFORM_MULTIPLIER, 100);
});

/* ── 2 · it is nobody else's instrument ──────────────────────────────── */

test("no WHO-5 item shares wording with the DISC360 Wellbeing Pulse", () => {
  const who5 = new Set(WHO5_ITEM_STRUCTURE.map((item) => item.prompt.toLowerCase()));
  for (const item of DISC360_WELLBEING_ITEMS) {
    assert.ok(
      !who5.has(item.prompt.toLowerCase()),
      `DISC360 item duplicates a WHO-5 item: ${item.prompt}`,
    );
  }
});

test("WHO-5 wording is not assembled from another instrument's anchors", () => {
  // GHQ's anchors ("Not at all", "No more than usual", …) belong to a
  // differently-directed instrument. Finding one here would mean the content
  // came from the wrong place.
  const labels = WHO5_RESPONSE_OPTIONS.map((o) => o.label.toLowerCase());
  for (const foreign of ["not at all", "no more than usual", "rather more than usual", "much more than usual"]) {
    assert.ok(!labels.includes(foreign), `GHQ anchor "${foreign}" must not appear in WHO-5`);
  }
});

/* ── 3 · licence conditions ──────────────────────────────────────────── */

test("the source publication is recorded precisely", () => {
  assert.equal(WHO5_SOURCE_DOCUMENT, "WHO/UCN/MSD/MHE/2024.1");
  assert.match(WHO5_SOURCE_CITATION, /World Health Organization/);
  assert.match(WHO5_SOURCE_CITATION, /2024/);
  assert.match(WHO5_SOURCE_CITATION, /CC BY-NC-SA 3\.0 IGO/);
  assert.equal(INSTRUMENTS.who5.sourceDocument, WHO5_SOURCE_DOCUMENT);
});

test("attribution is present and explicitly disclaims endorsement", () => {
  const attribution = INSTRUMENTS.who5.attribution ?? "";
  assert.match(attribution, /World Health Organization/);
  assert.match(attribution, /CC BY-NC-SA 3\.0 IGO/);
  assert.match(attribution, /does not endorse/i, "the disclaimer half is not optional");
});

test("licence metadata is kept separate from scoring metadata", () => {
  const who5 = INSTRUMENTS.who5;
  // How a score is computed is a psychometric fact; what we may do with it is
  // a legal position. Conflating them means a licence change silently looks
  // like a scoring change.
  assert.equal(who5.scoringMethod, "who5_sum_x4");
  assert.equal(who5.scoringVersion, "1.0.0");
  assert.equal(who5.licensing, "open_licence");
  assert.equal(who5.useClassification, "internal_noncommercial");
  assert.ok(!/licence|licens|CC BY/i.test(who5.scoringMethod));
  assert.ok(!/licence|licens|CC BY/i.test(who5.scoringVersion));
});

test("no WHO logo asset exists in the product", () => {
  // The publication states plainly that use of the WHO logo is not permitted.
  //
  // Asserted as ASSET USAGE, not as the absence of the word: the files below
  // deliberately discuss the prohibition, and a test that banned the word
  // would punish documenting the rule it is enforcing.
  const assets = execSync(
    "find public app components -type f 2>/dev/null | grep -iE 'who[-_]?logo|logo[-_]?who|who[-_]?emblem' || true",
    { cwd: new URL(ROOT).pathname, encoding: "utf8" },
  ).trim();
  assert.equal(assets, "", `WHO logo assets must not exist:\n${assets}`);

  // And no markup renders one.
  const markup = execSync(
    "grep -rilE '(img|image|src|svg)[^\\n]{0,80}who[-_ ]?(logo|emblem)' app components 2>/dev/null || true",
    { cwd: new URL(ROOT).pathname, encoding: "utf8" },
  ).trim();
  assert.equal(markup, "", `no surface may render a WHO logo:\n${markup}`);
});

test("the logo prohibition is written down where the content lives", () => {
  // So the next person to touch this file learns the rule from the file.
  assert.match(read("data/who5-items.ts"), /logo is not permitted/i);
  assert.match(read("supabase/instrument-content/00038_who5_content.sql"), /No WHO logo/i);
});

/* ── 4 · the cut-off is documentation, not a verdict ─────────────────── */

test("the suggested cut-off is recorded at its published values", () => {
  assert.equal(WHO5_SUGGESTED_CUTOFF_PERCENTAGE, 50);
  // The supplied guide states "Raw Score <= 12"; WHO states "below 13". Same set.\n  assert.equal(WHO5_SUGGESTED_CUTOFF_RAW, 12);
  assert.equal(INSTRUMENTS.who5.defaultThreshold, WHO5_SUGGESTED_CUTOFF_PERCENTAGE);
});

test("the cut-off is described as suggested, traceable, and not a diagnosis", () => {
  const description = INSTRUMENTS.who5.thresholdDescription;
  assert.match(description, /suggested/i, "the publication calls it suggested");
  assert.match(description, /further assessment/i, "and an indication for further assessment");
  assert.match(description, /WHO\/UCN\/MSD\/MHE\/2024\.1/, "traceable to its source");
  assert.match(description, /not a diagnosis/i);
  // It must never be stated as a DISC360 finding.
  assert.match(description, /not a finding by DISC360/i);
});

test("WHO-5 never claims to diagnose", () => {
  const claims = INSTRUMENTS.who5.notClaims.join(" ").toLowerCase();
  assert.match(claims, /not a diagnosis/);
  assert.match(claims, /not a clinical assessment/);
  assert.match(claims, /not endorsed by the world health organization/);
});

/* ── 5 · the migration and the authored bank agree ───────────────────── */
//
// Postgres is the runtime source, so a divergence between the TS bank and the
// migration is a questionnaire that tests one way and administers another.

test("the migration seeds exactly the authored items", () => {
  const migration = read("supabase/instrument-content/00040_ghq_content_and_who5_wording.sql");
  for (const item of WHO5_ITEM_STRUCTURE) {
    assert.ok(
      migration.includes(`'${item.externalId}'`),
      `migration is missing item id ${item.externalId}`,
    );
    assert.ok(
      migration.includes(item.prompt),
      `migration wording differs from the authored bank for ${item.externalId}`,
    );
  }
});

test("the migration seeds exactly the authored anchors and points", () => {
  // 00038 established the anchors AND their points; 00040 only re-labels them
  // to the supplied guide's wording. Points are asserted where they are set.
  const migration = read("supabase/instrument-content/00038_who5_content.sql");
  for (const option of WHO5_RESPONSE_OPTIONS) {
    assert.match(
      migration,
      new RegExp(`\\(${option.position}, '[^']+',\\s*${option.points}::smallint\\)`),
      `position ${option.position} must score ${option.points}`,
    );
  }

  // The wording in force comes from 00040, transcribed from the supplied guide.
  const rewording = read("supabase/instrument-content/00040_ghq_content_and_who5_wording.sql");
  for (const option of WHO5_RESPONSE_OPTIONS) {
    assert.ok(
      rewording.includes(`'${option.label}'`),
      `the re-wording migration is missing anchor "${option.label}"`,
    );
  }
});

test("the migration records the licence and checks its own arithmetic", () => {
  const migration = read("supabase/instrument-content/00038_who5_content.sql");
  assert.match(migration, /CC BY-NC-SA 3\.0 IGO/);
  assert.match(migration, /World Health Organization/);
  assert.match(migration, /does not\s+-- endorse|does not '\s*\|\|\s*'endorse|not endorse/i);
  // It must fail, not warn, if it half-applies.
  assert.match(migration, /raise exception 'WHO-5 seed: expected 5 items/);
  assert.match(migration, /raise exception 'WHO-5 seed: expected 30 options/);
  assert.match(migration, /expected 25/, "the published raw maximum is asserted");
});

test("the WHO-5 content migration touches no other instrument", () => {
  // 00040 deliberately covers all three; 00038 is WHO-5's alone.
  const migration = read("supabase/instrument-content/00038_who5_content.sql");
  for (const foreign of ["ghq12", "ghq28", "disc360_wellbeing_v1"]) {
    const writes = new RegExp(`(insert|update|delete)[\\s\\S]{0,200}${foreign}`, "i");
    assert.ok(!writes.test(migration), `migration must not write ${foreign} content`);
  }
});
