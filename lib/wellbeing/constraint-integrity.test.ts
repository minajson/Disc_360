import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import {
  INSTRUMENTS,
  INSTRUMENT_KEYS,
  atOrAboveThresholdFor,
  reportedScoreFor,
  resolveGovernedThreshold,
  thresholdMaxFor,
  thresholdScaleFor,
  type InstrumentKey,
} from "../../data/wellbeing-instruments.ts";

/**
 * The database's score rules, checked against the instrument registry.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS TEST EXISTS.
 *
 * Every score rule in the schema is a CHECK constraint, and a CHECK constraint
 * cannot read another table. So each one ENUMERATES the instruments and their
 * bounds: `when 'ghq12' then total_score <= 12`, and so on.
 *
 * That enumeration is a copy of facts that live in
 * data/wellbeing-instruments.ts, and copies drift. Six defects have now been
 * found in this codebase with exactly one shape — a rule written when GHQ-12
 * was the only instrument, still being applied to instruments that arrived
 * later:
 *
 *   · the threshold flag compared on GHQ's raw total, making WHO-5's cut-off
 *     unsatisfiable and rejecting every WHO-5 result at or above 50
 *   · the Likert bound was GHQ-12's 0–36, rejecting valid GHQ-28 results
 *   · the policy threshold bound was GHQ-12's 1–12
 *   · lib/wellbeing/policy.ts repeated that 1–12 in TypeScript
 *   · one organisation-wide threshold was applied to every instrument, so
 *     GHQ-28 was scored against GHQ-12's 3/4 split
 *   · two CASE rules ended in a permissive `else`, so a new instrument got a
 *     meaningless bound instead of an error
 *
 * None of them failed loudly. Each produced a plausible number or a rejection
 * that read as an application error, which is precisely why they survived.
 *
 * So the enumerations are not trusted to stay right — they are READ BACK from
 * the migrations and compared against the registry. Adding an instrument, or
 * changing a bound in one place and not the other, fails here.
 *
 * WHY THE SOURCE IS THE MIGRATION FILES.
 *
 * These are node --test unit tests with no database. Reading the SQL is what
 * makes the check runnable in the same gate as everything else. The LAST
 * definition of each constraint across all migrations is the effective one, so
 * that is what is parsed — a later migration re-loosening a rule fails here
 * too, rather than quietly winning.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
const DIR = new URL("supabase/migrations/", ROOT);

/** Every migration, in application order. */
const MIGRATIONS = readdirSync(DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => ({ name, body: readFileSync(new URL(name, DIR), "utf8") }));

/** SQL with comment lines stripped — prose about a rule is not the rule. */
const stripComments = (body: string) =>
  body
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

/**
 * The text of the LAST `add constraint <name> check ( ... )` across all
 * migrations — the definition actually in force.
 */
function effectiveConstraint(name: string): string {
  let found: string | null = null;
  let source = "";
  for (const migration of MIGRATIONS) {
    const body = stripComments(migration.body);
    // Balanced-paren scan from the constraint's `check (`, because these rules
    // nest CASE expressions and a non-greedy regex stops at the first `)`.
    let index = body.indexOf(`add constraint ${name} check`);
    while (index !== -1) {
      const open = body.indexOf("(", index);
      let depth = 0;
      let end = open;
      for (; end < body.length; end += 1) {
        if (body[end] === "(") depth += 1;
        else if (body[end] === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      found = body.slice(open + 1, end);
      source = migration.name;
      index = body.indexOf(`add constraint ${name} check`, end);
    }
  }
  assert.ok(found, `no migration defines the constraint ${name}`);
  assert.ok(source.length > 0);
  return found!;
}

/** Every instrument key named inside a rule. */
function keysNamedIn(clause: string): InstrumentKey[] {
  return INSTRUMENT_KEYS.filter((key) => clause.includes(`'${key}'`));
}

/* ── 1 · every per-instrument rule covers every instrument ───────────── */

const PER_INSTRUMENT_RULES = [
  "wellbeing_results_total_score_check",
  "wellbeing_results_item_positions_check",
  "wellbeing_results_likert_score_check",
];

test("every per-instrument result rule names every instrument in the registry", () => {
  for (const rule of PER_INSTRUMENT_RULES) {
    const clause = effectiveConstraint(rule);
    const named = keysNamedIn(clause);
    for (const key of INSTRUMENT_KEYS) {
      // The Likert rule states GHQ's instruments and sends everything else to a
      // `must be null` branch, which is a complete rule without naming them.
      if (rule === "wellbeing_results_likert_score_check" && INSTRUMENTS[key].likertScoreMax === null) {
        assert.ok(
          !named.includes(key),
          `${rule} should not name ${key} — it defines no Likert measure, so it falls to the null branch`,
        );
        continue;
      }
      assert.ok(
        named.includes(key),
        `${rule} does not name ${key}. A new instrument must state its own bound, not inherit one.`,
      );
    }
  }
});

/* ── 2 · no per-instrument rule falls back to a permissive default ───── */

/**
 * The only `else` branches that close a rule.
 *
 * Stated as a whitelist, not a blacklist: "does not look permissive" is a
 * weaker claim than "is one of the forms known to reject", and the difference
 * is what this whole audit is about. `else likert_score is null` closes by
 * REQUIRING absence, which is why it belongs here and `else likert_score <= 84`
 * would not.
 */
const CLOSED_ELSE = [/else false\b/, /else -1\b/, /else likert_score is null\b/];

test("a per-instrument rule fails closed for an instrument it does not name", () => {
  for (const rule of [...PER_INSTRUMENT_RULES, "wellbeing_results_threshold_in_range"]) {
    const clause = effectiveConstraint(rule).replace(/\s+/g, " ");
    assert.ok(
      CLOSED_ELSE.some((form) => form.test(clause)),
      `${rule} does not end in a closed else. An unnamed instrument must be REJECTED, not given ` +
        `a loose bound — that fallback is how five directional defects reached shared surfaces.`,
    );
  }
});

/* ── 3 · the bounds are the registry's own numbers ───────────────────── */

test("the raw-total bound is each instrument's declared rawScoreMax", () => {
  const clause = effectiveConstraint("wellbeing_results_total_score_check").replace(/\s+/g, " ");
  for (const key of INSTRUMENT_KEYS) {
    const expected = INSTRUMENTS[key].rawScoreMax;
    assert.match(
      clause,
      new RegExp(`when '${key}' then total_score <= ${expected}\\b`),
      `${key} must be bounded by its declared rawScoreMax of ${expected}`,
    );
  }
  // The bound that started the audit: WHO-5's raw total is NOT its 0–100 scale.
  assert.notEqual(INSTRUMENTS.who5.rawScoreMax, INSTRUMENTS.who5.primaryScoreMax);
});

test("the item-count bound is each instrument's declared itemCount", () => {
  const clause = effectiveConstraint("wellbeing_results_item_positions_check").replace(/\s+/g, " ");
  for (const key of INSTRUMENT_KEYS) {
    assert.match(
      clause,
      new RegExp(`when '${key}' then array_length\\(item_positions, 1\\) = ${INSTRUMENTS[key].itemCount}\\b`),
      `${key} must require exactly its ${INSTRUMENTS[key].itemCount} declared items`,
    );
  }
});

test("the Likert bound is each GHQ's own maximum, not GHQ-12's for both", () => {
  const clause = effectiveConstraint("wellbeing_results_likert_score_check").replace(/\s+/g, " ");
  for (const key of INSTRUMENT_KEYS) {
    const max = INSTRUMENTS[key].likertScoreMax;
    if (max === null) continue;
    assert.match(
      clause,
      new RegExp(`when '${key}' then likert_score is not null and likert_score between 0 and ${max}\\b`),
      `${key}'s Likert total runs to ${max}`,
    );
  }
  assert.equal(INSTRUMENTS.ghq12.likertScoreMax, 36);
  assert.equal(INSTRUMENTS.ghq28.likertScoreMax, 84, "28 items x 3 — not GHQ-12's 36");
  assert.notEqual(INSTRUMENTS.ghq12.likertScoreMax, INSTRUMENTS.ghq28.likertScoreMax);
});

test("the threshold range is bounded on each instrument's own threshold scale", () => {
  const clause = effectiveConstraint("wellbeing_results_threshold_in_range").replace(/\s+/g, " ");
  for (const key of INSTRUMENT_KEYS) {
    const max = thresholdMaxFor(key);
    if (max === null) {
      assert.ok(
        !clause.includes(`when '${key}' then`),
        `${key} carries no threshold, so it must not be given a range`,
      );
      continue;
    }
    assert.match(
      clause,
      new RegExp(`when '${key}'\\s+then ${max}\\b`),
      `${key}'s threshold is stated on a scale topping out at ${max}`,
    );
  }
});

/* ── 4 · the flag is compared on the declared threshold scale ────────── */

test("the stored flag is compared on each instrument's declared threshold scale", () => {
  const clause = effectiveConstraint("wellbeing_results_threshold_matches_flag").replace(/\s+/g, " ");

  for (const key of INSTRUMENT_KEYS) {
    const instrument = INSTRUMENTS[key];
    if (!instrument.hasThreshold) {
      assert.ok(
        !clause.includes(`'${key}'`),
        `${key} has no threshold, so the flag rule must not mention it`,
      );
      continue;
    }
    assert.ok(clause.includes(`'${key}'`), `${key} has a threshold and must be handled explicitly`);

    const column = thresholdScaleFor(key) === "index" ? "index_score" : "total_score";
    const other = column === "index_score" ? "total_score" : "index_score";
    // The branch for this key, up to the next `when` — so one instrument's
    // column cannot satisfy the assertion for another's.
    const branch = clause.slice(clause.indexOf(`'${key}'`)).split(/\bwhen\b/)[0]!;
    assert.ok(
      branch.includes(`${column} >= threshold_at_completion`),
      `${key} states its threshold on the ${thresholdScaleFor(key)} scale, so the flag must ` +
        `compare ${column}`,
    );
    assert.ok(
      !branch.includes(`${other} >= threshold_at_completion`),
      `${key} must not be compared against ${other}`,
    );
  }

  // The specific defect: WHO-5's cut-off of 50 against a 0–25 raw is not merely
  // wrong, it is unreachable — so the row was rejected outright.
  assert.ok(INSTRUMENTS.who5.rawScoreMax < (thresholdMaxFor("who5") ?? 0));
  assert.equal(thresholdScaleFor("who5"), "index");

  // A null index would make the comparison null, and a CHECK evaluating to NULL
  // PASSES. The rule must say the column is present.
  assert.ok(
    clause.includes("index_score is not null"),
    "the index-scale branch must require an index score, or it fails open on null",
  );
  assert.ok(/else false/.test(clause), "an instrument with an unstated scale must be rejected");
});

/* ── 5 · a governed policy is bounded by the instrument it governs ───── */

test("a policy threshold is bounded on the scale of the instrument it names", () => {
  const clause = effectiveConstraint("wellbeing_policies_screening_threshold_check").replace(
    /\s+/g,
    " ",
  );
  for (const key of INSTRUMENT_KEYS) {
    const instrument = INSTRUMENTS[key];
    const max = thresholdMaxFor(key);
    if (max === null) {
      assert.ok(
        !clause.includes(`'${instrument.scoringMethod}'`),
        `${key} has no threshold, so no policy may govern one for it`,
      );
      continue;
    }
    assert.match(
      clause,
      new RegExp(`when '${instrument.scoringMethod}'\\s+then ${max}\\b`),
      `a policy naming ${instrument.scoringMethod} is bounded by ${key}'s scale of ${max}`,
    );
  }
  assert.ok(/else 0/.test(clause), "a policy naming an unknown scoring method must be rejected");
});

/* ── 6 · every scoring method is unique, so a policy names one thing ─── */

test("no two instruments share a scoring method", () => {
  const methods = INSTRUMENT_KEYS.map((key) => INSTRUMENTS[key].scoringMethod);
  assert.equal(
    new Set(methods).size,
    methods.length,
    "a policy identifies its instrument by scoring method, so the methods must be distinct",
  );
});

/* ── 7 · the TypeScript guard does not restate GHQ-12's bound ────────── */

test("the policy resolver bounds thresholds per instrument, not 1-12", () => {
  const source = readFileSync(new URL("lib/wellbeing/policy.ts", ROOT), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
  assert.ok(
    !/threshold\s*>\s*12\b/.test(source),
    "policy.ts hard-coded GHQ-12's upper bound; it must read thresholdMaxFor()",
  );
  assert.ok(
    source.includes("thresholdMaxFor"),
    "the resolver must bound a threshold on the instrument's own scale",
  );
  assert.ok(
    source.includes("scoringMethod"),
    "a policy applies only to the instrument its scoring method names",
  );
});

/* ── 8 · the resolver applies a policy only to what it governs ───────── */

/** The shipped platform policy: GHQ-12's 3/4 split, org-wide. */
const GHQ12_POLICY = { screeningThreshold: 4, scoringMethod: "ghq_bimodal_0011" };

test("a GHQ-12 policy governs GHQ-12 and nothing else", () => {
  assert.equal(resolveGovernedThreshold(GHQ12_POLICY, "ghq12"), 4);

  // THE DEFECT: this used to return 4 — GHQ-12's cut-off, one point early on a
  // different instrument's scale — because the caller read the bare number.
  assert.equal(
    resolveGovernedThreshold(GHQ12_POLICY, "ghq28"),
    5,
    "GHQ-28 keeps its own documented 4/5 split when no policy names it",
  );
  assert.equal(resolveGovernedThreshold(GHQ12_POLICY, "who5"), 50, "WHO-5's published cut-off");

  // An unvalidated instrument must never inherit a governed clinical cut-off.
  assert.equal(resolveGovernedThreshold(GHQ12_POLICY, "disc360_wellbeing_v1"), null);
});

test("a policy naming an instrument governs it, within that instrument's scale", () => {
  const ghq28Policy = { screeningThreshold: 20, scoringMethod: "ghq28_bimodal_0011" };
  assert.equal(
    resolveGovernedThreshold(ghq28Policy, "ghq28"),
    20,
    "20 is meaningless on GHQ-12's 0–12 and legitimate on GHQ-28's 0–28",
  );
  // ...and still does not touch the instrument it does not name.
  assert.equal(resolveGovernedThreshold(ghq28Policy, "ghq12"), 4);
});

test("a threshold outside its own instrument's scale falls back to the governed default", () => {
  for (const key of INSTRUMENT_KEYS) {
    const instrument = INSTRUMENTS[key];
    const max = thresholdMaxFor(key);
    if (max === null) continue;
    const overshoot = { screeningThreshold: max + 1, scoringMethod: instrument.scoringMethod };
    assert.equal(
      resolveGovernedThreshold(overshoot, key),
      instrument.defaultThreshold,
      `${key} must not accept a threshold above ${max}`,
    );
    const zero = { screeningThreshold: 0, scoringMethod: instrument.scoringMethod };
    assert.equal(resolveGovernedThreshold(zero, key), instrument.defaultThreshold);
  }
});

/* ── 9 · the flag is computed on the same scale the schema checks ────── */

test("the stored flag agrees with the database rule at and around each cut-off", () => {
  // WHO-5 scoring 80: raw 20, index 80, cut-off 50. Against the raw total the
  // comparison is not just wrong but UNSATISFIABLE, which is why the row was
  // rejected rather than mis-rendered.
  assert.equal(reportedScoreFor("who5", { totalScore: 20, indexScore: 80 }), 80);
  assert.equal(atOrAboveThresholdFor("who5", { totalScore: 20, indexScore: 80 }, 50), true);
  assert.equal(atOrAboveThresholdFor("who5", { totalScore: 10, indexScore: 40 }, 50), false);
  // The boundary itself, on the scale the cut-off is stated on.
  assert.equal(atOrAboveThresholdFor("who5", { totalScore: 12, indexScore: 48 }, 50), false);
  assert.equal(atOrAboveThresholdFor("who5", { totalScore: 13, indexScore: 52 }, 50), true);

  // GHQ reads the raw count, and must be unaffected by an index that is null.
  assert.equal(reportedScoreFor("ghq12", { totalScore: 4, indexScore: null }), 4);
  assert.equal(atOrAboveThresholdFor("ghq12", { totalScore: 4, indexScore: null }, 4), true);
  assert.equal(atOrAboveThresholdFor("ghq12", { totalScore: 3, indexScore: null }, 4), false);
  assert.equal(atOrAboveThresholdFor("ghq28", { totalScore: 5, indexScore: null }, 5), true);
  assert.equal(atOrAboveThresholdFor("ghq28", { totalScore: 4, indexScore: null }, 5), false);

  // No threshold means no flag — not a false one.
  assert.equal(
    atOrAboveThresholdFor("disc360_wellbeing_v1", { totalScore: 30, indexScore: 62 }, null),
    null,
  );
});

/* ── 10 · the reported column is declared, never inferred ───────────── */

test("each instrument is read from the column that actually holds its score", () => {
  // GHQ stores a raw count and no index at all.
  assert.equal(reportedScoreFor("ghq12", { totalScore: 7, indexScore: null }), 7);
  assert.equal(reportedScoreFor("ghq28", { totalScore: 19, indexScore: null }), 19);

  // WHO-5 and DISC360 Wellbeing BOTH report on a 0–100 index, and DISC360
  // Wellbeing does so while carrying no threshold. Keying the column off the
  // threshold would read its 0–48 raw and report a third of the real figure.
  assert.equal(reportedScoreFor("who5", { totalScore: 20, indexScore: 80 }), 80);
  assert.equal(reportedScoreFor("disc360_wellbeing_v1", { totalScore: 30, indexScore: 62 }), 62);

  assert.equal(INSTRUMENTS.disc360_wellbeing_v1.reportedOn, "index");
  assert.equal(INSTRUMENTS.disc360_wellbeing_v1.hasThreshold, false);
  assert.equal(
    thresholdScaleFor("disc360_wellbeing_v1"),
    null,
    "reported on an index, yet grading nobody — the two facts are independent",
  );
});

test("the reported column is not inferable from the score range alone", () => {
  // The inference this replaced was `primaryScoreMax === 100`. It agrees with
  // the declaration for all four instruments today, which is exactly why it
  // survived — so the test is that the DECLARATION is what is read.
  for (const key of INSTRUMENT_KEYS) {
    const instrument = INSTRUMENTS[key];
    if (instrument.reportedOn === "index") {
      assert.equal(instrument.primaryScoreMax, 100, `${key} normalises onto 0–100`);
    } else {
      assert.equal(
        instrument.primaryScoreMax,
        instrument.rawScoreMax,
        `${key} is reported on its raw total, so the two maxima are the same number`,
      );
    }
  }
});

/* ── 11 · an answer is validated against the item, not against GHQ ──── */

test("the autosave bounds encode no instrument's scale", () => {
  const source = readFileSync(new URL("lib/actions/wellbeing.ts", ROOT), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");

  // The defect: GHQ-12's four options and twelve items, applied to every
  // instrument, so WHO-5's top two answers and every GHQ-28 item past the
  // twelfth were rejected as "Invalid answer".
  assert.ok(
    !/position:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(3\)/.test(source),
    "the answer position must not be bounded by GHQ's four response options",
  );
  assert.ok(
    !/itemIndex:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(11\)/.test(source),
    "the item index must not be bounded by GHQ-12's twelve items",
  );

  // What replaced them: the item's OWN options, and its version's OWN count.
  assert.ok(
    source.includes("wellbeing_item_options(position)"),
    "an answer must be checked against the options the item actually offers",
  );
  assert.ok(
    source.includes("itemIndex >= itemCount"),
    "the resume position must be checked against the version's own item count",
  );
});

test("every instrument's response options and item count are within the structural bounds", () => {
  // The schema's remaining numbers are the DATABASE columns' limits, so they
  // must accommodate every instrument the registry declares — including any
  // added later.
  for (const key of INSTRUMENT_KEYS) {
    const instrument = INSTRUMENTS[key];
    assert.ok(
      instrument.responseOptionCount - 1 <= 9,
      `${key}'s highest option position must fit wellbeing_responses.option_position`,
    );
    assert.ok(
      instrument.itemCount - 1 <= 49,
      `${key}'s highest item index must fit wellbeing_items.position`,
    );
  }
  // The two that the old bounds excluded, named so a regression is legible.
  assert.equal(INSTRUMENTS.who5.responseOptionCount, 6, "WHO-5 offers six, not GHQ's four");
  assert.equal(
    INSTRUMENTS.disc360_wellbeing_v1.responseOptionCount,
    5,
    "the ACTIVE instrument offers five, so GHQ's bound rejected its top answer",
  );
  assert.equal(INSTRUMENTS.ghq28.itemCount, 28, "not GHQ-12's twelve");
});
