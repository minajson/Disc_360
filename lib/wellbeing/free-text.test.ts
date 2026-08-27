import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ORG_FREE_TEXT_MAX,
  normalizeOrgFreeText,
  orgFreeTextCohortKey,
} from "./free-text.ts";

/**
 * Normalisation of participant-typed organisational context.
 *
 * These are privacy tests as much as tidiness tests. Sub-unit / Team is typed
 * rather than chosen, so the same unit arrives spelled several ways; left
 * alone those fragment into cohorts of one, and a cohort of one is exactly
 * what the suppression floor exists to prevent. Grouping them is what keeps
 * the floor meaningful.
 */

/* ── 1 · what gets stored ────────────────────────────────────────────── */

test("ordinary input is returned unchanged", () => {
  assert.equal(normalizeOrgFreeText("Environmental Health"), "Environmental Health");
});

test("surrounding and internal whitespace collapses", () => {
  assert.equal(normalizeOrgFreeText("  Environmental   Health  "), "Environmental Health");
  assert.equal(normalizeOrgFreeText("Environmental\tHealth"), "Environmental Health");
  assert.equal(normalizeOrgFreeText("Environmental\n\nHealth"), "Environmental Health");
});

test("nothing-at-all becomes null, never an empty string", () => {
  // An empty string would be a third representation of "not answered" and
  // would group as its own cohort.
  for (const input of ["", " ", "   ", "\t", "\n", "\t\n  "]) {
    assert.equal(normalizeOrgFreeText(input), null, `${JSON.stringify(input)} must be null`);
  }
  assert.equal(normalizeOrgFreeText(null), null);
  assert.equal(normalizeOrgFreeText(undefined), null);
});

test("invisible characters do not survive as content", () => {
  // Pasted from a spreadsheet or a chat client. Without stripping, these
  // compare unequal to the identical-looking typed value and split a cohort.
  assert.equal(normalizeOrgFreeText("​Environmental Health​"), "Environmental Health");
  assert.equal(normalizeOrgFreeText("﻿Operations"), "Operations");
  assert.equal(normalizeOrgFreeText("Field­Ops"), "Field Ops");
  // Invisible characters ALONE carry no information.
  assert.equal(normalizeOrgFreeText("​​"), null);
  assert.equal(normalizeOrgFreeText("﻿"), null);
});

test("input is bounded to the column width", () => {
  const long = "A".repeat(ORG_FREE_TEXT_MAX + 50);
  const normalized = normalizeOrgFreeText(long);
  assert.equal(normalized?.length, ORG_FREE_TEXT_MAX);
});

test("capitalisation is left exactly as typed", () => {
  // Title-casing somebody's own words is a correction nobody asked for, and
  // "R&D" would become "R&d".
  assert.equal(normalizeOrgFreeText("R&D"), "R&D");
  assert.equal(normalizeOrgFreeText("iOS Platform"), "iOS Platform");
  assert.equal(normalizeOrgFreeText("HSE"), "HSE");
});

/* ── 2 · what gets grouped ───────────────────────────────────────────── */

test("spelling variants of one unit are one cohort", () => {
  const variants = [
    "Environmental Health",
    "environmental health",
    "ENVIRONMENTAL HEALTH",
    "  Environmental   Health  ",
    "​Environmental Health",
  ];
  const keys = new Set(variants.map((v) => orgFreeTextCohortKey(v)));
  assert.equal(keys.size, 1, `expected one cohort, got ${[...keys].join(" | ")}`);
  assert.equal([...keys][0], "environmental health");
});

test("genuinely different units stay different cohorts", () => {
  assert.notEqual(
    orgFreeTextCohortKey("Environmental Health"),
    orgFreeTextCohortKey("Occupational Health"),
  );
});

test("a blank answer forms no cohort at all", () => {
  // Not a cohort called "" — no cohort. A participant who skipped the question
  // must not be grouped with everyone else who skipped it and then reported on.
  assert.equal(orgFreeTextCohortKey(""), null);
  assert.equal(orgFreeTextCohortKey("   "), null);
  assert.equal(orgFreeTextCohortKey(null), null);
});

test("the display value and the grouping key are separate", () => {
  // The reader sees the participant's own capitalisation; the counter sees one
  // group. Both from the same input.
  const typed = "Environmental Health";
  assert.equal(normalizeOrgFreeText(typed), "Environmental Health");
  assert.equal(orgFreeTextCohortKey(typed), "environmental health");
});

test("the key is stable regardless of server locale", () => {
  // toLowerCase, not toLocaleLowerCase: a cohort computed in one request is
  // compared against a cohort computed in another, possibly elsewhere.
  assert.equal(orgFreeTextCohortKey("İstanbul Operations"), "i̇stanbul operations");
});

/* ── 3 · the fragmentation property, stated directly ─────────────────── */

test("three people spelling their unit three ways count as three, not one each", () => {
  const answers = ["Environmental Health", "environmental health", " Environmental  Health "];
  const counts = new Map<string, number>();
  for (const answer of answers) {
    const key = orgFreeTextCohortKey(answer);
    if (key === null) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  assert.equal(counts.size, 1, "one cohort");
  assert.equal([...counts.values()][0], 3, "of three people");
  // Without normalisation this would be three cohorts of one — three
  // singletons, each of which is an identifiable individual.
});
