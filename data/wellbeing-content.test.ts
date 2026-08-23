import assert from "node:assert/strict";
import { test } from "node:test";
import {
  screenWellbeingContent,
  screenWellbeingCopy,
  BANNED_WELLBEING_TERMS,
  SANCTIONED_PHRASES,
} from "../lib/wellbeing/language.ts";
import * as content from "./wellbeing-content.ts";
import {
  DEFAULT_WELLBEING_DEPARTMENTS,
  DEFAULT_WELLBEING_OFFICE_LOCATIONS,
  requiresOfficeLocation,
  WORK_LOCATIONS,
} from "./wellbeing-taxonomy.ts";

/** Every exported string in the content module, flattened for screening. */
function allCopy(): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(content)) {
    if (typeof value === "string") {
      entries[key] = value;
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "string") entries[`${key}[${index}]`] = item;
      });
    } else if (value && typeof value === "object") {
      for (const [inner, text] of Object.entries(value)) {
        if (typeof text === "string") entries[`${key}.${inner}`] = text;
      }
    }
  }
  return entries;
}

/* ── the screen itself ──────────────────────────────────────────────── */

test("the screen catches diagnostic framing", () => {
  const violations = screenWellbeingCopy("Your score suggests clinical depression.");
  assert.ok(violations.some((entry) => entry.term.toLowerCase() === "clinical"));
  assert.ok(violations.some((entry) => entry.term.toLowerCase() === "depression"));
});

test("the screen catches employment-consequence framing", () => {
  assert.ok(
    screenWellbeingCopy("This person is unfit for work.").some(
      (entry) => entry.term.toLowerCase() === "unfit for work",
    ),
  );
  assert.ok(
    screenWellbeingCopy("Members at high risk are listed below.").some(
      (entry) => entry.term.toLowerCase() === "high risk",
    ),
  );
});

test("the screen catches caseness and severity framing", () => {
  assert.ok(screenWellbeingCopy("12 probable cases this quarter.").length > 0);
  assert.ok(
    screenWellbeingCopy("Severity increased across the site.").some(
      (entry) => entry.term.toLowerCase() === "severity",
    ),
  );
  assert.ok(
    screenWellbeingCopy("Six symptoms were reported.").length > 0,
    "plurals are caught, not just the singular form",
  );
});

test("the screen catches unsupported magnitude claims about change", () => {
  assert.ok(screenWellbeingCopy("Your mental health has improved by 40%.").length > 0);
  assert.ok(screenWellbeingCopy("Wellbeing improved by 3 points, a real gain.").length > 0);
  assert.ok(screenWellbeingCopy("A significant improvement since Q1.").length > 0);
});

test("the screen catches cross-instrument combination and ranking", () => {
  assert.ok(
    screenWellbeingCopy("DISC + Focus + GHQ gives an overall employee score.").some(
      (entry) => entry.term.toLowerCase() === "overall employee score",
    ),
  );
  assert.ok(
    screenWellbeingCopy("Employees are ranked by wellbeing.").some(
      (entry) => entry.term.toLowerCase() === "ranked",
    ),
  );
  assert.ok(
    screenWellbeingCopy("We publish a Wellbeing Index each quarter.").some(
      (entry) => entry.term.toLowerCase() === "wellbeing index",
    ),
  );
});

test("the screen catches causal attribution", () => {
  assert.ok(screenWellbeingCopy("The restructure caused by poorer scores.").length > 0);
});

test("word boundaries are respected — no false positives on substrings", () => {
  assert.deepEqual(screenWellbeingCopy("Participation increased across the casement works."), []);
  assert.deepEqual(screenWellbeingCopy("Completion rates rose steadily."), []);
});

test("the sanctioned disclaimer passes, but the banned word stays banned elsewhere", () => {
  assert.deepEqual(
    screenWellbeingCopy("GHQ-12 is a screening questionnaire and does not provide a diagnosis."),
    [],
  );
  assert.ok(
    screenWellbeingCopy("Your diagnosis is available in your report.").some(
      (entry) => entry.term.toLowerCase() === "diagnosis",
    ),
    "the exemption is a phrase allowlist, not a word allowlist",
  );
});

test("every sanctioned phrase is genuinely exempt", () => {
  for (const { phrase } of SANCTIONED_PHRASES) {
    assert.deepEqual(screenWellbeingCopy(phrase), [], `"${phrase}" must pass`);
  }
});

test("every banned term has a stated reason", () => {
  for (const entry of BANNED_WELLBEING_TERMS) {
    assert.ok(entry.reason.length > 10, `${entry.term} needs a reason`);
  }
});

/* ── the shipped copy ───────────────────────────────────────────────── */

test("ALL Wellbeing Pulse copy passes the safety-language screen", () => {
  const failures = screenWellbeingContent(allCopy());
  assert.deepEqual(
    failures,
    [],
    `unsafe wellbeing copy:\n${failures
      .map((entry) => `  ${entry.key}: ${entry.violations.map((v) => v.term).join(", ")}`)
      .join("\n")}`,
  );
});

test("the screening disclaimer is present and says what it must", () => {
  assert.match(content.SCREENING_DISCLAIMER, /screening questionnaire/i);
  assert.match(content.SCREENING_DISCLAIMER, /does not provide a diagnosis/i);
  assert.match(content.SCREENING_DISCLAIMER_LONG, /never shared with your manager/i);
});

test("both threshold outcomes use the approved wording", () => {
  assert.equal(
    content.outcomeCopy(false).body,
    "Your responses are below the current GHQ-12 screening threshold.",
  );
  assert.equal(
    content.outcomeCopy(true).body,
    "Your responses are at or above the current GHQ-12 screening threshold and indicate " +
      "more recent difficulty than usual across several wellbeing areas.",
  );
});

test("the threshold line reports the configured value, not a hard-coded 4", () => {
  assert.equal(content.thresholdLine(4), "Current screening threshold: 4");
  assert.equal(content.thresholdLine(6), "Current screening threshold: 6");
});

test("movement copy is direction and a count, in the approved phrasing", () => {
  assert.equal(content.MOVEMENT_LABEL.lower, "Lower than your previous pulse");
  assert.equal(content.MOVEMENT_LABEL.higher, "Higher than your previous pulse");
  assert.equal(content.MOVEMENT_LABEL.similar, "Similar to your previous pulse");
  assert.equal(content.movementDetail("lower", -3), "Your score is 3 points lower than your previous pulse.");
  assert.equal(content.movementDetail("higher", 1), "Your score is 1 point higher than your previous pulse.");
  assert.equal(content.movementDetail("similar", 0), "Your score is the same as it was last time.");
});

test("the product is named Wellbeing Pulse, with GHQ-12 as the secondary description", () => {
  assert.equal(content.WELLBEING_PRODUCT_NAME, "Wellbeing Pulse");
  assert.equal(content.WELLBEING_PRODUCT_DESCRIPTION, "GHQ-12 wellbeing screening");
});

test("the management surfaces state the aggregate-only and no-combination rules", () => {
  assert.match(content.AGGREGATE_ONLY_NOTICE, /group-level only/i);
  assert.match(content.NO_COMBINATION_NOTICE, /never added to/i);
  assert.match(content.THRESHOLD_POLICY_NOTE, /vary between populations/i);
  assert.match(content.TREND_CAVEAT, /not why it changed/i);
});

/* ── taxonomy ───────────────────────────────────────────────────────── */

test("Department / Function keeps its own name and its own list", () => {
  assert.equal(DEFAULT_WELLBEING_DEPARTMENTS.length, 26);
  assert.ok(DEFAULT_WELLBEING_DEPARTMENTS.includes("Ogoni Restoration Team"));
  assert.ok(DEFAULT_WELLBEING_DEPARTMENTS.includes("Wells"));
  assert.equal(
    new Set(DEFAULT_WELLBEING_DEPARTMENTS).size,
    DEFAULT_WELLBEING_DEPARTMENTS.length,
    "no duplicates",
  );
});

test("no wellbeing surface calls Department / Function a Sub Team", () => {
  const copy = Object.values(allCopy()).join(" ").toLowerCase();
  assert.ok(!copy.includes("sub team"), "Wellbeing Pulse never renames Department / Function");
});

test("work location is a fixed pair, and office location follows from it", () => {
  assert.deepEqual(WORK_LOCATIONS.map((entry) => entry.label), ["Field Based", "Office Based"]);
  assert.equal(requiresOfficeLocation("office_based"), true);
  assert.equal(requiresOfficeLocation("field_based"), false);
  assert.equal(requiresOfficeLocation(null), false);
  assert.deepEqual([...DEFAULT_WELLBEING_OFFICE_LOCATIONS], [
    "Abuja",
    "Lagos",
    "Port Harcourt",
    "Warri",
  ]);
});
