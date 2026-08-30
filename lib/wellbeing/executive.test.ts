import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildExecutiveTiles,
  buildInsights,
  describeSpread,
  type ExecutiveInput,
} from "./executive.ts";
import { screenWellbeingCopy } from "./language.ts";
import { INSTRUMENT_KEYS } from "../../data/wellbeing-instruments.ts";

/**
 * The executive reading.
 *
 * These sentences look like conclusions, which is precisely why none of them
 * may be generated and every one of them is screened here.
 */

const input = (over: Partial<ExecutiveInput> = {}): ExecutiveInput => ({
  instrumentKey: "ghq12",
  invited: 71,
  participants: 59,
  participation: 83.1,
  median: 4,
  previousMedian: 3,
  threshold: 4,
  coverage: [
    { key: "department", label: "Department / Function", published: 5, withheld: 2, covered: 48 },
    { key: "work_location", label: "Work location", published: 2, withheld: 0, covered: 59 },
  ],
  cohortMovements: [],
  previousPeriodLabel: "Wave 2",
  ...over,
});

/* ── the headline ───────────────────────────────────────────────────── */

test("participation is the first tile, before any figure it qualifies", () => {
  const tiles = buildExecutiveTiles(input());
  assert.equal(tiles[0]!.key, "participation");
  assert.equal(tiles[0]!.value, "83%");
  assert.equal(tiles[0]!.note, "59 of 71 people");
});

test("the headline answers the five questions, in order", () => {
  assert.deepEqual(
    buildExecutiveTiles(input()).map((tile) => tile.key),
    ["participation", "median", "movement", "reportable", "withheld"],
  );
});

test("a suppressed median is an em dash and a reason, never a zero", () => {
  const tiles = buildExecutiveTiles(input({ median: null, previousMedian: null }));
  const median = tiles.find((tile) => tile.key === "median")!;
  assert.equal(median.value, "—");
  assert.match(median.note!, /Too few responses/);
  assert.equal(median.state, "insufficient");

  const movement = tiles.find((tile) => tile.key === "movement")!;
  assert.equal(movement.value, "—");
  assert.equal(movement.movement, null);
});

test("the median tile's state is read in the questionnaire's own direction", () => {
  const ghq = buildExecutiveTiles(input({ instrumentKey: "ghq12", median: 6, threshold: 4 }));
  assert.equal(ghq.find((tile) => tile.key === "median")!.state, "watch");

  // The same arithmetic relationship on WHO-5 is the unremarkable side.
  const who5 = buildExecutiveTiles(
    input({ instrumentKey: "who5", median: 72, threshold: 50, previousMedian: 64 }),
  );
  assert.equal(who5.find((tile) => tile.key === "median")!.state, "steady");
});

test("a questionnaire with no threshold is given no state", () => {
  const tiles = buildExecutiveTiles(
    input({ instrumentKey: "disc360_wellbeing_v1", median: 70, threshold: null, previousMedian: 66 }),
  );
  assert.equal(tiles.find((tile) => tile.key === "median")!.state, "unbanded");
});

test("the withheld tile counts groups across every dimension", () => {
  const tiles = buildExecutiveTiles(input());
  assert.equal(tiles.find((tile) => tile.key === "reportable")!.value, "7");
  assert.equal(tiles.find((tile) => tile.key === "withheld")!.value, "2");
  // The note carries the meaning; a state label would say the same thing again.
  assert.match(
    tiles.find((tile) => tile.key === "withheld")!.note!,
    /too small to report/,
  );
});

/* ── the sentences ──────────────────────────────────────────────────── */

const everyInsight = (): string[] => {
  const texts: string[] = [];
  for (const instrumentKey of INSTRUMENT_KEYS) {
    for (const [median, previous] of [
      [4, 3],
      [3, 4],
      [4, 4],
      [null, null],
    ] as const) {
      for (const participation of [22, 62, 91, null] as const) {
        texts.push(
          ...buildInsights(
            input({
              instrumentKey,
              median,
              previousMedian: previous,
              participation,
              threshold: instrumentKey === "disc360_wellbeing_v1" ? null : 4,
              cohortMovements: [
                {
                  dimensionLabel: "Department / Function",
                  cohorts: [
                    { label: "Operations", delta: -6 },
                    { label: "Finance", delta: 1 },
                    { label: "Field teams", delta: null },
                  ],
                },
              ],
              coverage: [
                {
                  key: "department",
                  label: "Department / Function",
                  published: 5,
                  withheld: 2,
                  covered: 31,
                },
              ],
            }),
          ).map((insight) => insight.text),
        );
      }
    }
  }
  return texts;
};

test("every produced sentence passes the safety-language screen", () => {
  const failures = everyInsight()
    .map((text) => ({ text, violations: screenWellbeingCopy(text) }))
    .filter((entry) => entry.violations.length > 0);
  assert.deepEqual(
    failures,
    [],
    `unsafe insight copy:\n${failures
      .map((entry) => `${entry.text} → ${entry.violations.map((v) => v.term).join(", ")}`)
      .join("\n")}`,
  );
});

test("no sentence claims a cause", () => {
  const causal =
    /\bbecause\b|\bcaused\b|\bdue to\b|\bleading to\b|\bdriving\b|\bas a result of\b|\bexplains\b|\bdriven by\b/i;
  for (const text of everyInsight()) {
    // "because they are too small to report" is a statement about the
    // suppression rule, not about the workforce — allowed by exception and
    // asserted separately below.
    if (/too small to report/.test(text)) continue;
    assert.doesNotMatch(text, causal, `"${text}" asserts a cause`);
  }
});

test("no sentence describes people rather than responses", () => {
  const aboutPeople =
    /employees are|staff are|people are (depressed|anxious|unwell|struggling|at risk)|team is (depressed|unwell)/i;
  for (const text of everyInsight()) {
    assert.doesNotMatch(text, aboutPeople, `"${text}" describes people rather than responses`);
  }
});

test("no sentence ranks groups as best or worst", () => {
  const ranking = /\b(best|worst|top|bottom|highest|lowest|poorest|healthiest)\b/i;
  for (const text of everyInsight()) {
    assert.doesNotMatch(text, ranking, `"${text}" builds a league table`);
  }
});

test("no sentence claims statistical or clinical significance", () => {
  const significance =
    /\bsignificant\b|\bsignificance\b|\bmeaningful(ly)? (change|difference)\b|\bp\s?[<=]/i;
  for (const text of everyInsight()) {
    assert.doesNotMatch(text, significance, `"${text}" claims significance`);
  }
});

test("every insight names the figures it stands on", () => {
  for (const insight of buildInsights(
    input({
      cohortMovements: [
        {
          dimensionLabel: "Department / Function",
          cohorts: [
            { label: "Operations", delta: -6 },
            { label: "Finance", delta: 1 },
          ],
        },
      ],
    }),
  )) {
    assert.ok(insight.basis.length > 0, `"${insight.text}" cites nothing`);
  }
});

/* ── each sentence appears only when it is true ─────────────────────── */

test("low participation is stated, high participation is reassuring, and the middle is silent", () => {
  const low = buildInsights(input({ participation: 31, participants: 22 }));
  assert.ok(low.some((insight) => insight.kind === "participation"));
  assert.match(low.find((i) => i.kind === "participation")!.text, /Fewer than half/);

  const middle = buildInsights(input({ participation: 62 }));
  assert.ok(!middle.some((insight) => insight.kind === "participation"));

  const high = buildInsights(input({ participation: 91 }));
  assert.match(high.find((i) => i.kind === "participation")!.text, /most of this group/);
});

test("movement is stated with its direction on this questionnaire", () => {
  const ghq = buildInsights(input({ median: 8, previousMedian: 4 }));
  const movement = ghq.find((insight) => insight.kind === "movement")!;
  assert.match(movement.text, /4 points higher/);
  assert.match(movement.text, /toward the side this questionnaire flags/);
  // The composition caveat is not optional.
  assert.match(movement.text, /partly different set of people/);

  const who5 = buildInsights(
    input({ instrumentKey: "who5", median: 72, previousMedian: 64, threshold: 50 }),
  );
  assert.match(
    who5.find((insight) => insight.kind === "movement")!.text,
    /away from the side this questionnaire flags/,
    "a rising WHO-5 moves AWAY from the flagged side",
  );
});

test("an unvalidated questionnaire is never told which side it moved toward", () => {
  const insights = buildInsights(
    input({
      instrumentKey: "disc360_wellbeing_v1",
      median: 70,
      previousMedian: 64,
      threshold: null,
    }),
  );
  assert.doesNotMatch(insights.find((i) => i.kind === "movement")!.text, /flags/);
});

test("the largest movement is named; the highest and lowest group never are", () => {
  const insights = buildInsights(
    input({
      cohortMovements: [
        {
          dimensionLabel: "Department / Function",
          cohorts: [
            { label: "Operations", delta: -6 },
            { label: "Finance", delta: 1 },
            { label: "Support", delta: null },
          ],
        },
      ],
    }),
  );
  const cohort = insights.find((insight) => insight.kind === "cohort")!;
  assert.match(cohort.text, /Operations/);
  assert.match(cohort.text, /largest movement/);
  assert.match(cohort.text, /-6 points/);
  assert.match(cohort.text, /not an explanation/);
  // A withheld group is never named, sized or hinted at.
  assert.doesNotMatch(cohort.text, /Support/);
});

test("one reportable group is not a comparison", () => {
  const insights = buildInsights(
    input({
      cohortMovements: [
        {
          dimensionLabel: "Team",
          cohorts: [{ label: "Only one", delta: -6 }],
        },
      ],
    }),
  );
  assert.ok(!insights.some((insight) => insight.kind === "cohort"));
});

test("withheld groups are explained, never enumerated", () => {
  const insights = buildInsights(input());
  const privacy = insights.find((insight) => insight.kind === "privacy")!;
  assert.match(privacy.text, /2 groups are not shown/);
  assert.match(privacy.text, /not named, sized or counted/);
});

test("no privacy sentence is produced when nothing is withheld", () => {
  const insights = buildInsights(
    input({
      coverage: [
        { key: "department", label: "Department / Function", published: 5, withheld: 0, covered: 59 },
      ],
    }),
  );
  assert.ok(!insights.some((insight) => insight.kind === "privacy"));
});

test("thin coverage is stated so a partial comparison is not read as a whole one", () => {
  const insights = buildInsights(
    input({
      participants: 59,
      coverage: [
        { key: "department", label: "Department / Function", published: 3, withheld: 4, covered: 21 },
      ],
    }),
  );
  const coverage = insights.find((insight) => insight.kind === "coverage")!;
  assert.match(coverage.text, /21 of the 59 people/);
  assert.match(coverage.text, /part of this workforce/);
});

/* ── statistics in human language ───────────────────────────────────── */

test("the spread is three labelled facts, not 'middle 58-70'", () => {
  const spread = describeSpread(63, 58, 70, 11);
  assert.equal(spread.median, "Median: 63");
  assert.equal(spread.range, "Typical middle range: 58–70");
  assert.equal(spread.responses, "Responses: 11");
  assert.match(spread.explanation, /Half of the responses/);
  assert.match(spread.explanation, /Individual answers are never shown/);
  assert.deepEqual(screenWellbeingCopy(spread.explanation), []);
});

/* ── the sentences are code, not generation ─────────────────────────── */

test("no part of the executive reading is model-generated", () => {
  // The header explains WHY no model comes near this file, so it names one.
  // The executable half must not.
  const source = readFileSync(new URL("./executive.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  for (const forbidden of ["lib/ai", "anthropic", "Anthropic", "generate", "prompt"]) {
    assert.ok(
      !source.includes(forbidden),
      `the executive reading must be derived, not generated (found ${forbidden})`,
    );
  }
});
