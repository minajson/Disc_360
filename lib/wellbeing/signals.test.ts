import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildWellbeingSignals,
  FORBIDDEN_SIGNAL_TERMS,
  SIGNAL_PRIORITY_LABEL,
  type SignalInput,
} from "./signals.ts";
import { INSTRUMENTS } from "../../data/wellbeing-instruments.ts";

const wave = (label: string, median: number, participants = 40, spread = 12, thresholdShare: number | null = null) =>
  ({ label, median, participants, spread, thresholdShare });

const base = (over: Partial<SignalInput> = {}): SignalInput => ({
  instrument: INSTRUMENTS.disc360_wellbeing_v1,
  waves: [wave("Q1", 64), wave("Q2", 63), wave("Q3", 63)],
  dimensions: [],
  cohorts: [],
  cohortLabel: "Department / Function",
  ...over,
});

/* ── every signal is four parts, and the figures are ours ────────────── */

test("every signal carries observation, evidence, meaning and a next step", () => {
  const signals = buildWellbeingSignals(
    base({
      dimensions: [
        { key: "recovery_demand", label: "Recovery & Demand", medians: [61, 59, 58] },
        { key: "capacity", label: "Capacity", medians: [68, 68, 69] },
      ],
    }),
  );
  assert.ok(signals.length > 0, "the fixture must produce at least one signal");
  for (const signal of signals) {
    for (const part of ["observation", "evidence", "mayMean", "considerExploring"] as const) {
      assert.ok(signal[part].trim().length > 0, `${signal.key} is missing ${part}`);
    }
    assert.ok(SIGNAL_PRIORITY_LABEL[signal.priority], "a signal must carry a priority tier");
  }
});

test("the evidence quotes the actual series", () => {
  const [signal] = buildWellbeingSignals(
    base({
      dimensions: [
        { key: "recovery_demand", label: "Recovery & Demand", medians: [61, 59, 58] },
        { key: "capacity", label: "Capacity", medians: [68, 68, 69] },
      ],
    }),
  );
  assert.match(signal!.observation, /Recovery & Demand has remained lower/);
  assert.match(signal!.evidence, /61 → 59 → 58/);
});

/* ── language discipline ─────────────────────────────────────────────── */

test("no signal on any instrument uses clinical or causal language", () => {
  for (const key of ["disc360_wellbeing_v1", "ghq12", "ghq28", "who5"] as const) {
    const signals = buildWellbeingSignals(
      base({
        instrument: INSTRUMENTS[key],
        waves: [
          wave("Q1", 60, 60, 10, 30),
          wave("Q2", 58, 55, 14, 38),
          wave("Q3", 55, 30, 22, 52),
        ],
        dimensions: [
          { key: "a", label: "Recovery & Demand", medians: [61, 59, 58] },
          { key: "b", label: "Capacity", medians: [70, 71, 70] },
        ],
        cohorts: [
          { label: "Field Based", participants: 18, median: 54, delta: -3 },
          { label: "Office Based", participants: 30, median: 66, delta: 1 },
        ],
      }),
    );
    assert.ok(signals.length > 0, `${key} produced no signals to screen`);
    const prose = signals
      .flatMap((s) => [s.observation, s.evidence, s.mayMean, s.considerExploring])
      .join(" ")
      .toLowerCase();
    for (const term of FORBIDDEN_SIGNAL_TERMS) {
      assert.ok(!prose.includes(term), `${key} signal used forbidden term "${term}"`);
    }
  }
});

test("screening instruments get a flatter, non-clinical reading", () => {
  const input = base({
    instrument: INSTRUMENTS.ghq12,
    waves: [wave("Q1", 3, 60, 4, 30), wave("Q2", 4, 55, 10, 44)],
    cohorts: [
      { label: "Field Based", participants: 18, median: 5, delta: 1 },
      { label: "Office Based", participants: 30, median: 2, delta: 0 },
    ],
  });
  const signals = buildWellbeingSignals(input);
  assert.ok(signals.length > 0);
  for (const signal of signals) {
    assert.match(
      signal.mayMean,
      /not a clinical finding|establishes nothing about anyone's health/,
      "a screening signal must disclaim clinically",
    );
  }
});

test("no signal names a person or claims a group is worse", () => {
  const signals = buildWellbeingSignals(
    base({
      cohorts: [
        { label: "Field Based", participants: 18, median: 54, delta: -3 },
        { label: "Office Based", participants: 30, median: 66, delta: 1 },
      ],
    }),
  );
  const prose = signals.flatMap((s) => [s.observation, s.mayMean]).join(" ");
  assert.match(prose, /recorded a lower median/, "difference is stated as a measurement");
  assert.ok(!/is worse|performing badly|failing/i.test(prose));
});

/* ── ranking is about evidence, not people ───────────────────────────── */

test("signals are ordered by evidence strength, strongest first", () => {
  const signals = buildWellbeingSignals(
    base({
      waves: [wave("Q1", 60, 60, 10, null), wave("Q2", 58, 25, 24, null)],
      cohorts: [
        { label: "Field Based", participants: 18, median: 50, delta: -3 },
        { label: "Office Based", participants: 30, median: 68, delta: 1 },
      ],
    }),
  );
  const weights = signals.map((signal) => signal.weight);
  assert.deepEqual(weights, [...weights].sort((a, b) => b - a), "strongest evidence first");
});

test("a participation drop outranks a score pattern, because it qualifies it", () => {
  const signals = buildWellbeingSignals(
    base({ waves: [wave("Q1", 60, 60, 10), wave("Q2", 58, 20, 16)] }),
  );
  assert.equal(signals[0]!.key, "participation-drop");
});

/* ── nothing is invented for instruments that do not support it ──────── */

test("an instrument with no dimensions never produces a dimension signal", () => {
  const signals = buildWellbeingSignals(
    base({ instrument: INSTRUMENTS.ghq12, dimensions: [] }),
  );
  assert.ok(!signals.some((signal) => signal.key.startsWith("dimension-")));
});

test("an instrument with no threshold never produces a threshold signal", () => {
  const signals = buildWellbeingSignals(
    base({
      instrument: INSTRUMENTS.disc360_wellbeing_v1,
      waves: [wave("Q1", 60, 60, 10, 20), wave("Q2", 58, 58, 10, 60)],
    }),
  );
  assert.ok(
    !signals.some((signal) => signal.key === "threshold-prevalence"),
    "DISC360 Wellbeing has no validated cut-off and must not report prevalence",
  );
});

test("a single wave produces no movement claim at all", () => {
  const signals = buildWellbeingSignals(base({ waves: [wave("Q1", 62)] }));
  for (const signal of signals) {
    assert.ok(!/than the previous|against/i.test(signal.evidence), "nothing to compare against");
  }
});

test("steadiness is reported rather than silence", () => {
  const signals = buildWellbeingSignals(
    base({ waves: [wave("Q1", 62), wave("Q2", 62), wave("Q3", 63)] }),
  );
  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.priority, "stable");
});

test("the engine is pure — no database, no client, no model", () => {
  const source = readFileSync(new URL("./signals.ts", import.meta.url), "utf8");
  for (const forbidden of ["supabase", "createSupabaseAdminClient", "anthropic", "fetch("]) {
    assert.ok(!source.includes(forbidden), `signals must be deterministic — found ${forbidden}`);
  }
});
