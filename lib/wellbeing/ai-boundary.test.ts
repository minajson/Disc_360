import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The AI narrative boundary.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WELLBEING HAS NO GENERATED NARRATIVE, AND THAT IS THE FINDING.
 *
 * DISC360 has an AI narrative layer: `lib/ai/` rewrites the prose a team's
 * evidence layer has already written, under `checkNarrative` screening, for
 * team admins only. It is careful work and it is correct there.
 *
 * Copying it into Wellbeing Pulse would mean handing a language model figures
 * derived from people's screening data. That can be done safely only if the
 * payload is provably aggregate and provably suppressed BEFORE it leaves the
 * server — and "provably" has to mean structurally, not by inspection of the
 * call site that happens to exist today.
 *
 * The current position is stronger than any such proof: the two subsystems do
 * not reference each other at all. No wellbeing module imports `lib/ai`, no AI
 * module mentions an instrument, and there is no code path along which a
 * wellbeing row — aggregate or individual — could reach a model.
 *
 * These tests hold that. If a future author wires the two together, the
 * failure here is the prompt to design the payload boundary first: an
 * aggregate-only, already-suppressed input, screened output, and a test that
 * proves a cohort below the floor cannot appear in either.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");

/** Executable lines only — these modules DISCUSS what they must never do. */
const code = (path: string) =>
  read(path)
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
    })
    .join("\n");

function walk(dir: string, extensions: RegExp): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(new URL(dir, ROOT), { withFileTypes: true })) {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) {
      if (["node_modules", ".next", ".next-test", ".git"].includes(entry.name)) continue;
      found.push(...walk(`${path}/`, extensions));
      continue;
    }
    if (extensions.test(entry.name)) found.push(path);
  }
  return found;
}

const WELLBEING_SOURCES = [
  ...walk("lib/wellbeing/", /\.tsx?$/).filter((path) => !path.endsWith(".test.ts")),
  ...walk("components/wellbeing/", /\.tsx?$/),
  ...walk("app/(wellbeing)/", /\.tsx?$/),
  ...walk("app/(wellbeing-present)/", /\.tsx?$/),
];

test("there are wellbeing sources to check, so these tests are not vacuous", () => {
  assert.ok(WELLBEING_SOURCES.length > 20, `only found ${WELLBEING_SOURCES.length} sources`);
});

test("no wellbeing module reaches the AI layer or a model provider", () => {
  for (const path of WELLBEING_SOURCES) {
    const source = code(path);
    for (const forbidden of [
      '"@/lib/ai/',
      "'@/lib/ai/",
      "@anthropic-ai",
      "anthropic",
      "ANTHROPIC_API_KEY",
      "generateNarrative",
    ]) {
      assert.ok(
        !source.includes(forbidden),
        `${path} references ${forbidden} — wellbeing has no generated narrative`,
      );
    }
  }
});

test("no AI module knows an instrument, a wellbeing table or a wellbeing figure", () => {
  for (const path of walk("lib/ai/", /\.ts$/).filter((p) => !p.endsWith(".test.ts"))) {
    const source = code(path);
    for (const forbidden of [
      "wellbeing",
      "ghq",
      "who5",
      "instrument_key",
      "index_score",
      "at_or_above_threshold",
    ]) {
      assert.ok(
        !source.toLowerCase().includes(forbidden.toLowerCase()),
        `${path} references ${forbidden} — the AI layer must not know wellbeing exists`,
      );
    }
  }
});

test("the wellbeing narrative is rule-written, and its engine performs no I/O", () => {
  // The signal engine is what writes every management sentence in this
  // product. It is a pure function over figures that have already passed
  // suppression, so the same input always produces the same words and a
  // withheld cohort can never be described.
  const signals = code("lib/wellbeing/signals.ts");
  for (const forbidden of ["supabase", "fetch(", "anthropic", "await "]) {
    assert.ok(
      !signals.includes(forbidden),
      `the signal engine must stay pure and deterministic — found ${forbidden}`,
    );
  }
  assert.match(read("lib/wellbeing/signals.ts"), /export function buildWellbeingSignals/);
});

test("the aggregate report and the deck are assembled from suppressed reads only", () => {
  // Both are built from the same analytics functions the screen calls, and
  // neither issues a query of its own — which is what makes "if it is withheld
  // on screen it is withheld here" structural rather than a promise.
  for (const path of ["lib/wellbeing/aggregate-report.ts", "lib/wellbeing/presentation.ts"]) {
    const source = code(path);
    assert.ok(
      !source.includes("createSupabaseAdminClient") && !source.includes('.from("'),
      `${path} must issue no query of its own`,
    );
    assert.match(source, /getWellbeingWorkspace\(/, `${path} reads through the analytics layer`);
  }
});
