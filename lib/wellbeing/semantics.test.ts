import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  aggregateMovementSentence,
  movementReading,
  MOVEMENT_GLYPH,
  readingState,
  STATE_VISUAL,
  thresholdPhrase,
  type ReadingState,
} from "./semantics.ts";
import { INSTRUMENT_KEYS, INSTRUMENTS } from "../../data/wellbeing-instruments.ts";

/**
 * Instrument-aware semantics.
 *
 * The defect: `at_or_above_threshold` was read as "noteworthy" everywhere,
 * which is true on GHQ and false on WHO-5 — so a healthy WHO-5 score was
 * coloured and captioned as the one to worry about.
 */

/* ── direction ──────────────────────────────────────────────────────── */

test("GHQ's noteworthy side is high and WHO-5's is low", () => {
  // GHQ-12, threshold 4.
  assert.equal(readingState("ghq12", 5, 4), "watch");
  assert.equal(readingState("ghq12", 4, 4), "watch", "at the threshold counts as at-or-above");
  assert.equal(readingState("ghq12", 3, 4), "steady");

  // WHO-5, cut-off 50 — the opposite way round.
  assert.equal(readingState("who5", 40, 50), "watch");
  assert.equal(readingState("who5", 50, 50), "steady", "at the cut-off is the unremarkable side");
  assert.equal(readingState("who5", 72, 50), "steady");
});

test("one naive rule would get one of the two families wrong", () => {
  // Written as an explicit demonstration: applying GHQ's rule to WHO-5 inverts
  // it. Anything that stops asking this module has reintroduced the bug.
  const naive = (value: number, threshold: number) => (value >= threshold ? "watch" : "steady");
  assert.equal(naive(72, 50), "watch");
  assert.equal(readingState("who5", 72, 50), "steady");
});

test("a questionnaire with no threshold is never given a side", () => {
  assert.equal(readingState("disc360_wellbeing_v1", 88, null), "unbanded");
  assert.equal(readingState("disc360_wellbeing_v1", 12, null), "unbanded");
  // Even if a threshold is somehow supplied, an unbanded instrument stays so.
  assert.equal(readingState("disc360_wellbeing_v1", 12, 50), "unbanded");
  assert.equal(INSTRUMENTS.disc360_wellbeing_v1.hasThreshold, false);
});

test("no figure at all is 'not enough responses', not a zero", () => {
  for (const key of INSTRUMENT_KEYS) {
    assert.equal(readingState(key, null, 4), "insufficient");
  }
});

/* ── the words ──────────────────────────────────────────────────────── */

test("the threshold phrase is written in each questionnaire's own frame", () => {
  assert.equal(thresholdPhrase("ghq12", 6, 4), "At or above the screening threshold");
  assert.equal(thresholdPhrase("ghq12", 2, 4), "Below the screening threshold");

  // WHO-5's line is one a score falls BELOW, and it is the publication's, not
  // this organisation's.
  assert.equal(thresholdPhrase("who5", 40, 50), "Below the published cut-off");
  assert.equal(thresholdPhrase("who5", 72, 50), "At or above the published cut-off");

  // The GHQ frame must never appear on WHO-5.
  assert.doesNotMatch(thresholdPhrase("who5", 72, 50)!, /screening threshold/);
  assert.equal(thresholdPhrase("disc360_wellbeing_v1", 80, null), null);
});

test("no state's label diagnoses, grades or alarms", () => {
  const forbidden =
    /risk|severe|critical|danger|urgent|clinical|depress|anxious|unhealthy|poor|bad|good|healthy/i;
  const states: ReadingState[] = [
    "steady",
    "watch",
    "unbanded",
    "withheld",
    "insufficient",
  ];
  for (const state of states) {
    assert.doesNotMatch(
      STATE_VISUAL[state].label,
      forbidden,
      `"${STATE_VISUAL[state].label}" grades a workforce`,
    );
  }
});

test("every state carries a non-colour carrier as well as a colour", () => {
  const states: ReadingState[] = [
    "steady",
    "watch",
    "unbanded",
    "withheld",
    "insufficient",
  ];
  for (const state of states) {
    const visual = STATE_VISUAL[state];
    assert.ok(visual.label.length > 0, `${state} has no label`);
    assert.ok(visual.glyph.length > 0, `${state} has no glyph`);
    // Colours are tokens from app/globals.css, never literals, so the theme
    // stays the single place a wellbeing colour is defined.
    assert.match(visual.color, /^var\(--color-/);
    assert.match(visual.background, /^var\(--color-/);
  }
});

test("no state uses a red", () => {
  // A screening figure is a prompt to look, never an alarm about a person, and
  // no red appears anywhere in a wellbeing surface.
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  const block = css.slice(
    css.indexOf("── Wellbeing · semantic reading states"),
    css.indexOf("── typography"),
  );
  const hexes = block.match(/#[0-9a-f]{6}/gi) ?? [];
  assert.ok(hexes.length > 0, "the semantic palette must actually be defined");
  for (const hex of hexes) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    assert.ok(
      !(r > 150 && r - g > 60 && r - b > 60),
      `${hex} reads as a red alarm colour`,
    );
  }
});

/* ── movement ───────────────────────────────────────────────────────── */

test("movement separates the number's direction from the questionnaire's", () => {
  // Same arithmetic, opposite meaning.
  const ghqUp = movementReading("ghq12", 6, 3);
  assert.equal(ghqUp.direction, "up");
  assert.equal(ghqUp.toward, "watch");

  const who5Up = movementReading("who5", 72, 60);
  assert.equal(who5Up.direction, "up");
  assert.equal(who5Up.toward, "steady", "a rising WHO-5 moves AWAY from the flagged side");

  const who5Down = movementReading("who5", 40, 60);
  assert.equal(who5Down.direction, "down");
  assert.equal(who5Down.toward, "watch");
});

test("an unchanged figure is level in both senses", () => {
  for (const key of INSTRUMENT_KEYS) {
    const reading = movementReading(key, 50, 50);
    assert.equal(reading.direction, "level");
    assert.equal(reading.toward, "level");
    assert.match(reading.label, /No change/);
  }
});

test("the movement label is arithmetic and says which period", () => {
  assert.equal(movementReading("ghq12", 10, 4, "Wave 1").label, "+6 since Wave 1");
  assert.equal(movementReading("ghq12", 4, 10, "Wave 1").label, "-6 since Wave 1");
});

test("the arrow is the number's direction and nothing else", () => {
  assert.equal(MOVEMENT_GLYPH.up, "↑");
  assert.equal(MOVEMENT_GLYPH.down, "↓");
  assert.equal(MOVEMENT_GLYPH.level, "→");
  // Three glyphs for three directions — no fourth "improving" arrow exists.
  assert.equal(Object.keys(MOVEMENT_GLYPH).length, 3);
});

test("an aggregate movement sentence never claims improvement or causation", () => {
  const forbidden =
    /improv|deteriorat|worse|better|because|caused|due to|leading to|driving|result of/i;
  for (const key of INSTRUMENT_KEYS) {
    for (const [current, previous] of [
      [70, 64],
      [64, 70],
      [64, 64],
    ] as const) {
      const sentence = aggregateMovementSentence(
        key,
        movementReading(key, current, previous),
        "score",
      );
      assert.doesNotMatch(sentence, forbidden, `${key}: "${sentence}"`);
      assert.match(sentence, /Median/);
    }
  }
});

test("an aggregate movement names the flagged side only where one exists", () => {
  const ghq = aggregateMovementSentence("ghq12", movementReading("ghq12", 6, 3), "score");
  assert.match(ghq, /toward the side this questionnaire flags/);

  const unbanded = aggregateMovementSentence(
    "disc360_wellbeing_v1",
    movementReading("disc360_wellbeing_v1", 70, 64),
    "index",
  );
  assert.doesNotMatch(
    unbanded,
    /flags/,
    "an unvalidated questionnaire has no flagged side to move toward",
  );
});

/* ── the rule is enforced, not merely available ─────────────────────── */

test("no participant or analytics surface reads the raw flag to decide a colour", () => {
  const suspects = [
    "app/(wellbeing)/wellbeing/history/page.tsx",
    "components/wellbeing/result/PersonalTrends.tsx",
  ];
  for (const path of suspects) {
    const source = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.ok(
      !/atOrAboveThreshold\s*===?\s*true\s*\n?\s*\?/.test(code),
      `${path} branches a visual on the raw flag; ask readingState() instead`,
    );
  }
});
