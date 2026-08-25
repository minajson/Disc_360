import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  screenWellbeingContent,
  screenWellbeingCopy,
  BANNED_WELLBEING_TERMS,
  SANCTIONED_PHRASES,
} from "../lib/wellbeing/language.ts";
import * as content from "./wellbeing-content.ts";
import * as discContent from "./disc360-wellbeing-content.ts";
import {
  DISC360_WELLBEING_DIMENSIONS,
  DISC360_WELLBEING_INSTRUCTION,
  DISC360_WELLBEING_ITEMS,
  DISC360_WELLBEING_OPTIONS,
} from "./disc360-wellbeing-items.ts";
import { INSTRUMENTS, INSTRUMENT_KEYS } from "./wellbeing-instruments.ts";
import {
  DEFAULT_WELLBEING_DEPARTMENTS,
  DEFAULT_WELLBEING_OFFICE_LOCATIONS,
  requiresOfficeLocation,
  WORK_LOCATIONS,
} from "./wellbeing-taxonomy.ts";

/** Every exported string in a content module, flattened for screening. */
function flatten(module: Record<string, unknown>): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(module)) {
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

const allCopy = () => flatten(content as unknown as Record<string, unknown>);
const allDiscCopy = () => flatten(discContent as unknown as Record<string, unknown>);

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
  // "Wellbeing Index" alone is DISC360 V1's defined primary score and is
  // permitted; a composite that merges instruments is not.
  assert.ok(
    screenWellbeingCopy("We publish a combined wellbeing index each quarter.").some(
      (entry) => entry.term.toLowerCase() === "combined wellbeing index",
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
  // Instrument-NEUTRAL. This string is shown before any instrument is
  // resolved — on the join page and in shell metadata — so naming one there
  // told every participant they were answering GHQ-12 whatever their campaign
  // actually ran, and GHQ-12 cannot currently be served at all.
  assert.equal(content.WELLBEING_PRODUCT_DESCRIPTION, "Workplace wellbeing check-in");
  for (const key of ["GHQ", "WHO-5", "DISC360"]) {
    assert.ok(
      !content.WELLBEING_PRODUCT_DESCRIPTION.includes(key),
      `the shared descriptor must name no instrument — found ${key}`,
    );
  }
});

test("the management surfaces state the aggregate-only and no-combination rules", () => {
  assert.match(content.AGGREGATE_ONLY_NOTICE, /group-level only/i);
  assert.match(content.NO_COMBINATION_NOTICE, /never added to/i);
  assert.match(content.THRESHOLD_POLICY_NOTE, /vary between populations/i);
  assert.match(content.TREND_CAVEAT, /not why it changed/i);
});

/* ── taxonomy ───────────────────────────────────────────────────────── */

test("Department / Function keeps its own name and its own list", () => {
  assert.ok(DEFAULT_WELLBEING_DEPARTMENTS.length >= 8, "the floor is usable on its own");
  assert.ok(DEFAULT_WELLBEING_DEPARTMENTS.includes("Other"), "no forced mis-selection");
  assert.equal(
    new Set(DEFAULT_WELLBEING_DEPARTMENTS).size,
    DEFAULT_WELLBEING_DEPARTMENTS.length,
    "no duplicates",
  );
});

/* ── the shipped catalogue belongs to nobody ────────────────────────── */

/**
 * DISC360 is multi-organisation, and anything shipped in this repository is
 * offered to EVERY organisation — as the platform-level rows seeded by 00028
 * and behind the per-organisation "Install defaults" button alike. So the
 * shipped catalogue must describe no actual customer.
 *
 * These names were genuinely present once, as platform defaults, and every
 * tenant on the platform would have seen them. The list is kept concrete
 * rather than abstract because that is what makes the test able to fail.
 */
const CUSTOMER_SPECIFIC = [
  "Shell", "Ogoni", "Nigeria", "Nigerian", "Renaissance", "Deepwater",
  "Country Chair", "Integrated Gas", "Geo Solutions", "PT Development",
  "Business and Government Relations", "Transformation Team",
  "Abuja", "Lagos", "Port Harcourt", "Warri",
];

test("no shipped catalogue value names a real customer or its geography", () => {
  const shipped = [...DEFAULT_WELLBEING_DEPARTMENTS, ...DEFAULT_WELLBEING_OFFICE_LOCATIONS];
  for (const entry of shipped) {
    for (const term of CUSTOMER_SPECIFIC) {
      assert.ok(
        !entry.toLowerCase().includes(term.toLowerCase()),
        `"${entry}" carries customer-specific term "${term}" — a new organisation must never inherit another organisation's structure`,
      );
    }
  }
});

test("the platform-level migration seeds the same neutral floor, and nothing else", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/00028_wellbeing_default_taxonomy.sql", import.meta.url),
    "utf8",
  );
  // Only the comment header may discuss what must NOT be seeded; the SQL is
  // what actually reaches every tenant, so screen that alone.
  const values = migration
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
  for (const term of CUSTOMER_SPECIFIC) {
    assert.ok(
      !values.toLowerCase().includes(term.toLowerCase()),
      `00028 seeds "${term}" at platform level, where every organisation would read it`,
    );
  }
  // And what it does seed is exactly the shipped floor.
  for (const entry of DEFAULT_WELLBEING_DEPARTMENTS) {
    assert.ok(values.includes(`('${entry}'`), `00028 is missing the neutral entry "${entry}"`);
  }
  for (const entry of DEFAULT_WELLBEING_OFFICE_LOCATIONS) {
    assert.ok(values.includes(`('${entry}'`), `00028 is missing the neutral office "${entry}"`);
  }
});

test("only an organisation-scoped row may be written — never a new platform default", () => {
  const installer = readFileSync(new URL("../lib/actions/wellbeing.ts", import.meta.url), "utf8");
  const fn = installer.slice(installer.indexOf("export async function installWellbeingTaxonomy"));
  // Every insert carries the caller's own organisation id.
  assert.match(fn, /organization_id: organizationId/, "departments are written to the caller's org");
  assert.ok(
    !/organization_id: null/.test(fn),
    "the installer must never create a platform-level row",
  );
  assert.match(fn, /requireWellbeingGovernance\(organizationId\)/, "authorised for that org first");
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
  // Facility roles, not places: an office list is geography, and geography is
  // the most organisation-specific part of a taxonomy.
  assert.ok(DEFAULT_WELLBEING_OFFICE_LOCATIONS.length >= 2);
  assert.ok(DEFAULT_WELLBEING_OFFICE_LOCATIONS.includes("Other"));
});


/* ── DISC360 Wellbeing Pulse V1 ─────────────────────────────────────── */

test("ALL DISC360 Wellbeing copy passes the safety-language screen", () => {
  const failures = screenWellbeingContent(allDiscCopy());
  assert.deepEqual(
    failures,
    [],
    `unsafe DISC360 Wellbeing copy:\n${failures
      .map((entry) => `  ${entry.key}: ${entry.violations.map((v) => v.term).join(", ")}`)
      .join("\n")}`,
  );
});

test("the twelve V1 items themselves pass the safety-language screen", () => {
  const items = Object.fromEntries(
    DISC360_WELLBEING_ITEMS.map((item) => [item.externalId, item.prompt]),
  );
  assert.deepEqual(screenWellbeingContent(items), []);
});

test("the instruction and response options are exactly as specified", () => {
  assert.equal(
    DISC360_WELLBEING_INSTRUCTION,
    "Thinking about the past two weeks, choose the response that best reflects your experience.",
  );
  assert.deepEqual(DISC360_WELLBEING_OPTIONS.map((option) => option.label), [
    "Never",
    "Rarely",
    "Sometimes",
    "Often",
    "Almost always",
  ]);
});

test("V1 copy never APPLIES a threshold, band or category", () => {
  // The words "threshold" and "cut-off" are permitted only in denial — V1 has
  // to be able to say it does not have one. What must never appear is copy
  // that applies one to a person.
  const copy = Object.values(allDiscCopy()).join(" ").toLowerCase();
  for (const forbidden of [
    "your threshold",
    "the threshold is",
    "above the threshold",
    "below the threshold",
    "at or above",
    "your band",
    "band you",
    "above average",
    "below average",
    "percentile",
    "benchmark",
    "target score",
    "pass mark of",
    "you scored in the",
  ]) {
    assert.ok(!copy.includes(forbidden), `V1 copy must not apply a threshold: "${forbidden}"`);
  }

  // Any mention at all must sit inside an explicit denial.
  for (const [key, text] of Object.entries(allDiscCopy())) {
    if (/threshold|cut-?off/i.test(text)) {
      assert.match(
        text,
        /\b(no|not|never|without)\b/i,
        `${key} mentions a threshold outside a denial`,
      );
    }
  }

  assert.match(discContent.DISC_NO_BANDS_NOTE, /does not place you in a category/i);
  assert.match(discContent.DISC_WELLBEING_DISCLAIMER_LONG, /not been psychometrically validated/i);
  assert.match(discContent.DISC_NO_BANDS_ANALYTICS_NOTE, /no bands, cut-offs or categories/i);
});

test("V1 never compares a participant to teammates or a population", () => {
  const copy = Object.values(allDiscCopy()).join(" ").toLowerCase();
  for (const forbidden of ["your team's", "compared with colleagues", "your peers", "the average person"]) {
    assert.ok(!copy.includes(forbidden), `V1 copy must not compare people: "${forbidden}"`);
  }
  assert.match(discContent.DISC_INDEX_MEANING, /not with anybody else/i);
});

test("movement copy is direction and a point count", () => {
  assert.equal(discContent.DISC_MOVEMENT_LABEL.higher, "Higher than your previous pulse");
  assert.equal(discContent.DISC_MOVEMENT_LABEL.lower, "Lower than your previous pulse");
  assert.equal(discContent.DISC_MOVEMENT_LABEL.similar, "Similar to your previous pulse");
  assert.equal(
    discContent.indexMovementDetail("higher", 5),
    "Your index is 5 points higher than your previous pulse.",
  );
  assert.equal(
    discContent.indexMovementDetail("lower", 1),
    "Your index is 1 point lower than your previous pulse.",
  );
  assert.equal(discContent.sinceFirstDetail(13), "Your index is 13 points higher than your first recorded pulse.");
});

test("the lower-dimension framing is an area for attention, never a risk", () => {
  assert.match(discContent.DISC_LOWEST_DIMENSION_LABEL, /lower-scoring dimension/i);
  assert.match(discContent.DISC_LOWER_DIMENSION_NOTE, /area for attention/i);
  assert.ok(!/risk/i.test(discContent.DISC_LOWER_DIMENSION_NOTE));
});

/* ── instrument registry ────────────────────────────────────────────── */

test("both instruments are registered with their own scales and directions", () => {
  assert.deepEqual([...INSTRUMENT_KEYS], ["ghq12", "ghq28", "who5", "disc360_wellbeing_v1"]);

  const ghq = INSTRUMENTS.ghq12;
  assert.equal(ghq.primaryScoreMax, 12);
  assert.equal(ghq.scoreDirection, "higher_is_more_distress");
  assert.equal(ghq.subscales.length, 0, "GHQ-12 has no subscales, by design");
  assert.equal(ghq.hasThreshold, true);
  assert.equal(ghq.licensing, "external_rights_required");

  const ghq28 = INSTRUMENTS.ghq28;
  assert.equal(ghq28.primaryScoreMax, 28);
  assert.equal(ghq28.subscales.length, 4, "GHQ-28 has four profile subscales");
  assert.equal(ghq28.hasThreshold, true);

  const who5 = INSTRUMENTS.who5;
  assert.equal(who5.primaryScoreMax, 100);
  assert.equal(who5.scoreDirection, "higher_is_stronger_wellbeing");
  assert.equal(who5.hasThreshold, false, "no threshold is configured for WHO-5 here");
  assert.equal(who5.licensing, "open_licence");

  const disc = INSTRUMENTS.disc360_wellbeing_v1;
  assert.equal(disc.primaryScoreMax, 100);
  assert.equal(disc.scoreDirection, "higher_is_stronger_wellbeing");
  assert.equal(disc.hasThreshold, false, "V1 has no clinical threshold");
  assert.equal(disc.licensing, "original_content");
});

test("the GHQ instruments and the wellbeing instruments run in opposite directions", () => {
  assert.notEqual(
    INSTRUMENTS.ghq12.scoreDirection,
    INSTRUMENTS.disc360_wellbeing_v1.scoreDirection,
    "a rising GHQ score and a rising Wellbeing Index mean different things",
  );
});

test("neither instrument is described as superior, and neither overclaims", () => {
  const text = Object.values(INSTRUMENTS)
    .flatMap((instrument) => [
      instrument.purpose,
      instrument.descriptor,
      instrument.thresholdDescription,
      instrument.subscaleDescription,
      instrument.licensingDescription,
    ])
    .join(" ")
    .toLowerCase();
  for (const forbidden of ["better than", "superior", "more accurate", "gold standard", "best-in-class"]) {
    assert.ok(!text.includes(forbidden), `instrument metadata must not claim "${forbidden}"`);
  }
  assert.ok(
    INSTRUMENTS.disc360_wellbeing_v1.notClaims.includes("not psychometrically validated"),
    "V1 states plainly that it is not validated",
  );
});

test("every dimension is defined with a label and a neutral description", () => {
  assert.equal(DISC360_WELLBEING_DIMENSIONS.length, 6);
  const descriptions = Object.fromEntries(
    DISC360_WELLBEING_DIMENSIONS.map((d) => [d.key, d.description]),
  );
  assert.deepEqual(screenWellbeingContent(descriptions), []);
  assert.deepEqual(
    DISC360_WELLBEING_DIMENSIONS.map((d) => d.position),
    [0, 1, 2, 3, 4, 5],
  );
});


test("the GHQ instrument still never names an index — the exemption is V1's alone", () => {
  const ghqCopy = Object.values(allCopy()).join(" ").toLowerCase();
  for (const forbidden of ["wellbeing index", "index score", "composite"]) {
    assert.ok(
      !ghqCopy.includes(forbidden),
      `GHQ copy must not name an index: "${forbidden}" — GHQ reports a 0–12 count`,
    );
  }
});

test("a composite that merges instruments is still refused", () => {
  for (const phrase of [
    "We publish a combined wellbeing index each quarter.",
    "The composite index blends both instruments.",
    "Their overall wellbeing score is 74.",
    "A health index for every employee.",
  ]) {
    assert.ok(screenWellbeingCopy(phrase).length > 0, `must reject: ${phrase}`);
  }
});

test("but V1's own defined primary score name is permitted", () => {
  assert.deepEqual(
    screenWellbeingCopy("Your Wellbeing Index summarises your twelve answers on a 0–100 scale."),
    [],
  );
});
