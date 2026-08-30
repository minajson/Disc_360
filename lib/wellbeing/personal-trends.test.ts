import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildPersonalTrend,
  describeMovement,
  directionSentence,
  headlineOf,
  sharesAxis,
  subscaleSeries,
  thresholdNote,
  type PersonalRecord,
} from "./personal-trends.ts";
import { INSTRUMENT_KEYS, INSTRUMENTS } from "../../data/wellbeing-instruments.ts";

/**
 * A participant's own analytics.
 *
 * The failure this file exists to prevent: a single "wellbeing score" that
 * puts GHQ-12, WHO-5 and Wellbeing Pulse on one axis. They run in opposite
 * directions, so a chart like that reports improvement precisely when the
 * opposite happened.
 */

const record = (over: Partial<PersonalRecord> = {}): PersonalRecord => ({
  id: "r1",
  instrumentKey: "ghq12",
  completedAt: "2026-01-15T00:00:00.000Z",
  totalScore: 3,
  indexScore: null,
  threshold: 4,
  atOrAboveThreshold: false,
  dimensions: [],
  ...over,
});

/* ── no universal score ─────────────────────────────────────────────── */

test("no two questionnaires may share an axis, including the ones that share a range", () => {
  for (const a of INSTRUMENT_KEYS) {
    for (const b of INSTRUMENT_KEYS) {
      assert.equal(sharesAxis(a, b), a === b, `${a} vs ${b}`);
    }
  }
  // The specific trap: both 0–100, both counting upward, entirely unrelated.
  assert.equal(INSTRUMENTS.who5.primaryScoreMax, INSTRUMENTS.disc360_wellbeing_v1.primaryScoreMax);
  assert.equal(
    INSTRUMENTS.who5.scoreDirection,
    INSTRUMENTS.disc360_wellbeing_v1.scoreDirection,
  );
  assert.equal(sharesAxis("who5", "disc360_wellbeing_v1"), false);
});

test("a trend drops records from any other questionnaire rather than plotting them", () => {
  const trend = buildPersonalTrend("ghq12", [
    record({ id: "a", completedAt: "2026-01-01T00:00:00.000Z", totalScore: 2 }),
    record({
      id: "b",
      instrumentKey: "who5",
      completedAt: "2026-02-01T00:00:00.000Z",
      totalScore: 18,
      indexScore: 72,
    }),
    record({ id: "c", completedAt: "2026-03-01T00:00:00.000Z", totalScore: 5 }),
  ]);
  assert.deepEqual(
    trend.points.map((point) => point.id),
    ["a", "c"],
  );
});

test("every questionnaire says which way its axis runs, in its own terms", () => {
  assert.match(directionSentence("ghq12"), /harder than usual/i);
  assert.match(directionSentence("ghq28"), /harder than usual/i);
  assert.match(directionSentence("who5"), /better wellbeing/i);
  assert.match(directionSentence("disc360_wellbeing_v1"), /better wellbeing/i);

  // The two families must not describe their direction the same way.
  assert.notEqual(directionSentence("ghq12"), directionSentence("who5"));

  for (const key of INSTRUMENT_KEYS) {
    assert.ok(directionSentence(key).length > 0, `${key} has no direction sentence`);
  }
});

/* ── the headline figure is the questionnaire's own ─────────────────── */

test("each questionnaire reports the figure it publishes", () => {
  // GHQ: the count itself.
  assert.deepEqual(headlineOf(record({ instrumentKey: "ghq12", totalScore: 3 })), {
    value: 3,
    raw: null,
  });
  // WHO-5: the published percentage, with the raw 0–25 kept beside it.
  assert.deepEqual(
    headlineOf(record({ instrumentKey: "who5", totalScore: 18, indexScore: 72 })),
    { value: 72, raw: 18 },
  );
  // Wellbeing Pulse V1: its index, with the raw 0–48 beside it.
  assert.deepEqual(
    headlineOf(
      record({ instrumentKey: "disc360_wellbeing_v1", totalScore: 36, indexScore: 75 }),
    ),
    { value: 75, raw: 36 },
  );
});

/* ── movement is arithmetic, never a clinical claim ─────────────────── */

test("movement describes the number and never the person", () => {
  const forbidden =
    /improv|deteriorat|worse|better|recover|relapse|risk|concerning|healthy|unhealthy|progress/i;

  for (const key of INSTRUMENT_KEYS) {
    for (const [current, previous] of [
      [8, 2],
      [2, 8],
      [5, 5],
    ] as const) {
      const movement = describeMovement(key, current, previous);
      assert.doesNotMatch(
        movement.sentence,
        forbidden,
        `${key}: "${movement.sentence}" interprets a change`,
      );
    }
  }
});

test("movement direction is the number's direction on every questionnaire", () => {
  // Deliberately identical across instruments: "up" is up. What "up" MEANS is
  // carried by `directionSentence`, beside the chart, in words.
  for (const key of INSTRUMENT_KEYS) {
    assert.equal(describeMovement(key, 8, 2).direction, "up");
    assert.equal(describeMovement(key, 2, 8).direction, "down");
    assert.equal(describeMovement(key, 5, 5).direction, "level");
  }
  assert.equal(describeMovement("ghq12", 8, 2).delta, 6);
  assert.equal(describeMovement("ghq12", 2, 8).delta, -6);
});

test("a one-point change is not pluralised", () => {
  assert.match(describeMovement("ghq12", 4, 3).sentence, /\b1 point\b/);
  assert.match(describeMovement("ghq12", 5, 3).sentence, /\b2 points\b/);
});

test("movement names the questionnaire's own metric", () => {
  assert.match(describeMovement("who5", 72, 64).sentence, /WHO-5/);
  assert.match(describeMovement("ghq12", 4, 3).sentence, /GHQ-12/);
});

/* ── thresholds, in each questionnaire's own direction ──────────────── */

test("a questionnaire with no threshold is given no band", () => {
  assert.equal(thresholdNote("disc360_wellbeing_v1", null), null);
  assert.equal(INSTRUMENTS.disc360_wellbeing_v1.hasThreshold, false);
});

test("the threshold is explained in the direction its questionnaire runs", () => {
  const ghq = thresholdNote("ghq12", 4)!;
  assert.match(ghq, /prompt to check in/i);
  assert.doesNotMatch(ghq, /diagnos(is|tic)\b(?!,)/i);

  const who5 = thresholdNote("who5", 50)!;
  assert.match(who5, /below it/i, "WHO-5's noteworthy side is BELOW the cut-off");
  assert.match(who5, /published with this questionnaire/i, "and the cut-off is not ours");
});

test("a changed threshold across the series is reported rather than smoothed over", () => {
  const trend = buildPersonalTrend("ghq12", [
    record({ id: "a", completedAt: "2026-01-01T00:00:00.000Z", threshold: 3 }),
    record({ id: "b", completedAt: "2026-02-01T00:00:00.000Z", threshold: 4 }),
  ]);
  assert.equal(trend.thresholdChanged, true);

  const steady = buildPersonalTrend("ghq12", [
    record({ id: "a", completedAt: "2026-01-01T00:00:00.000Z", threshold: 4 }),
    record({ id: "b", completedAt: "2026-02-01T00:00:00.000Z", threshold: 4 }),
  ]);
  assert.equal(steady.thresholdChanged, false);
});

/* ── GHQ-28's four subscales ────────────────────────────────────────── */

test("GHQ-28 reports its four published subscales, and the others report none", () => {
  const records = [
    record({
      id: "a",
      instrumentKey: "ghq28",
      completedAt: "2026-01-01T00:00:00.000Z",
      totalScore: 9,
      threshold: 5,
      dimensions: [
        { key: "ghq28_somatic", raw: 3, index: 3 },
        { key: "ghq28_anxiety_insomnia", raw: 4, index: 4 },
        { key: "ghq28_social_dysfunction", raw: 1, index: 1 },
        { key: "ghq28_severe_depression", raw: 1, index: 1 },
      ],
    }),
  ];

  const series = subscaleSeries("ghq28", records);
  assert.deepEqual(
    series.map((entry) => entry.label),
    ["Somatic symptoms", "Anxiety / insomnia", "Social dysfunction", "Severe depression"],
  );
  // Seven items each, so the axis is 0–7 and not the total's 0–28.
  assert.deepEqual(new Set(series.map((entry) => entry.max)), new Set([7]));
  assert.deepEqual(
    series.find((entry) => entry.key === "anxiety_insomnia")!.points,
    [{ at: "2026-01-01T00:00:00.000Z", value: 4 }],
  );

  for (const key of ["ghq12", "who5", "disc360_wellbeing_v1"] as const) {
    assert.deepEqual(subscaleSeries(key, records), [], `${key} must report no subscales`);
  }
});

test("no subscale is given a threshold of its own", () => {
  const source = readFileSync(new URL("./personal-trends.ts", import.meta.url), "utf8");
  const block = source.slice(source.indexOf("export function subscaleSeries"));
  assert.ok(
    !/threshold/i.test(block.slice(0, block.indexOf("\n}\n"))),
    "a subscale is a profile dimension and carries no threshold",
  );
});

/* ── assembly ───────────────────────────────────────────────────────── */

test("a trend is ordered oldest first and knows its current point", () => {
  const trend = buildPersonalTrend("ghq12", [
    record({ id: "c", completedAt: "2026-03-01T00:00:00.000Z", totalScore: 6 }),
    record({ id: "a", completedAt: "2026-01-01T00:00:00.000Z", totalScore: 2 }),
    record({ id: "b", completedAt: "2026-02-01T00:00:00.000Z", totalScore: 4 }),
  ]);
  assert.deepEqual(
    trend.points.map((point) => point.id),
    ["a", "b", "c"],
  );
  assert.equal(trend.current!.id, "c");
  assert.equal(trend.movement!.delta, 2);
  assert.equal(trend.movement!.direction, "up");
});

test("a first check-in has a current reading and no movement", () => {
  const trend = buildPersonalTrend("ghq12", [record()]);
  assert.ok(trend.current);
  assert.equal(trend.movement, null);
});

test("no history at all is an empty reading rather than a zero", () => {
  const trend = buildPersonalTrend("who5", []);
  assert.deepEqual(trend.points, []);
  assert.equal(trend.current, null);
  assert.equal(trend.movement, null);
  // The scale is still the questionnaire's, so an empty chart is still labelled.
  assert.equal(trend.max, INSTRUMENTS.who5.primaryScoreMax);
  assert.ok(trend.directionSentence.length > 0);
});

test("the trend carries its own questionnaire's scale, not a shared one", () => {
  assert.equal(buildPersonalTrend("ghq12", []).max, 12);
  assert.equal(buildPersonalTrend("ghq28", []).max, 28);
  assert.equal(buildPersonalTrend("who5", []).max, 100);
  assert.equal(buildPersonalTrend("disc360_wellbeing_v1", []).max, 100);
});

/* ── it cannot reach anybody else's data ────────────────────────────── */

test("nothing in this module can be pointed at another person or a cohort", () => {
  const source = readFileSync(new URL("./personal-trends.ts", import.meta.url), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  for (const forbidden of [
    "organizationId",
    "organization_id",
    "teamId",
    "team_id",
    "profileId",
    "profile_id",
    "cohort",
    "median",
    "supabase",
    "createSupabaseAdminClient",
  ]) {
    assert.ok(
      !code.includes(forbidden),
      `personal analytics must not be able to reach ${forbidden}`,
    );
  }
});
