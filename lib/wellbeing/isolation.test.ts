import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Business isolation, asserted at the source level.
 *
 * The requirement is not "wellbeing scores are currently not combined with
 * DISC" — it is that they CANNOT be. So these tests read the code rather than
 * exercise it: a runtime test proves today's call graph, and the risk here is
 * a future author writing the one function that adds a GHQ total to a
 * behavioural score for an apparently good reason.
 */

const ROOT = new URL("../../", import.meta.url).pathname;

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/** Actual import specifiers, so a doc comment naming a module is not a hit. */
function importsOf(path: string): string[] {
  return [...read(path).matchAll(/(?:from|import)\s+"([^"]+)"/g)].map((match) => match[1]!);
}

function walk(dir: string, predicate: (path: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    const full = join(ROOT, rel);
    if (statSync(full).isDirectory()) {
      out.push(...walk(rel, predicate));
    } else if (predicate(rel)) {
      out.push(rel);
    }
  }
  return out;
}

/* ── the wellbeing engine imports nothing from DISC or Focus ────────── */

/** Every wellbeing instrument's engine, and the item bank it may import. */
const ENGINES: { key: string; path: string; allowed: string[] }[] = [
  { key: "ghq12", path: "lib/scoring/wellbeing.ts", allowed: ["../../data/wellbeing-items.ts"] },
  { key: "ghq28", path: "lib/scoring/ghq28.ts", allowed: ["../../data/ghq28-items.ts"] },
  { key: "who5", path: "lib/scoring/who5.ts", allowed: ["../../data/who5-items.ts"] },
  {
    key: "disc360_wellbeing_v1",
    path: "lib/scoring/disc360-wellbeing.ts",
    allowed: ["../../data/disc360-wellbeing-items.ts"],
  },
];

test("each instrument engine imports ONLY its own questionnaire structure", () => {
  for (const engine of ENGINES) {
    const source = read(engine.path);
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]!);
    assert.deepEqual(
      imports,
      engine.allowed,
      `${engine.key}: an engine's only dependency is its own item bank`,
    );
  }
});

test("no instrument engine imports another instrument engine", () => {
  const engineFiles = ENGINES.map((engine) => engine.path.split("/").pop()!.replace(".ts", ""));
  for (const engine of ENGINES) {
    const source = read(engine.path);
    for (const other of engineFiles) {
      if (engine.path.endsWith(`${other}.ts`)) continue;
      assert.ok(
        !source.includes(`./${other}`),
        `${engine.key} must not import ${other} — engines are independent`,
      );
    }
  }
});

test("no instrument engine imports another instrument's item bank", () => {
  const banks = [
    "../../data/wellbeing-items.ts",
    "../../data/ghq28-items.ts",
    "../../data/who5-items.ts",
    "../../data/disc360-wellbeing-items.ts",
  ];
  for (const engine of ENGINES) {
    // Exact specifiers: "wellbeing-items" is a SUBSTRING of
    // "disc360-wellbeing-items", so substring matching would report a false
    // conflict between two engines that share nothing.
    const imports = importsOf(engine.path);
    for (const bank of banks) {
      if (engine.allowed.includes(bank)) continue;
      assert.ok(!imports.includes(bank), `${engine.key} must not read ${bank}`);
    }
  }
});

test("no instrument engine imports DISC or Focus", () => {
  for (const engine of ENGINES) {
    // Imports, not prose — the engines' own comments name these modules in
    // order to state that they do NOT depend on them.
    const imports = importsOf(engine.path);
    for (const forbidden of [
      "compute-result",
      "scoring/focus",
      "insight-maps",
      "dimension-meta",
      "scoring/pipeline",
      "scoring/archetype",
      "./focus",
    ]) {
      assert.ok(
        !imports.some((specifier) => specifier.includes(forbidden)),
        `${engine.key} must not import ${forbidden}`,
      );
    }
  }
});

test("each engine declares its own distinct scoring method and version constant", () => {
  const methods = new Set<string>();
  for (const engine of ENGINES) {
    const source = read(engine.path);
    const match = source.match(/SCORING_METHOD\s*=\s*"([^"]+)"/);
    assert.ok(match, `${engine.key} must declare a scoring method`);
    assert.ok(!methods.has(match![1]!), `${engine.key} reuses another engine's method name`);
    methods.add(match![1]!);
    assert.match(source, /SCORING_VERSION\s*=\s*"[0-9]+\.[0-9]+\.[0-9]+"/);
  }
  assert.equal(methods.size, 4);
});

test("no DISC or Focus scoring module imports any wellbeing engine", () => {
  for (const file of [
    "lib/scoring/compute-result.ts",
    "lib/scoring/pipeline.ts",
    "lib/scoring/archetype.ts",
    "lib/scoring/intensity.ts",
    "lib/scoring/focus.ts",
  ]) {
    const source = read(file).toLowerCase();
    for (const forbidden of ["wellbeing", "ghq", "who5", "who-5"]) {
      assert.ok(!source.includes(forbidden), `${file} must not reference ${forbidden}`);
    }
  }
});

test("the combined DISC + Focus insight layer is untouched by wellbeing", () => {
  for (const file of [
    "lib/insights/combined.ts",
    "lib/insights/combined-team.ts",
    "lib/insights/team.ts",
    "lib/insights/executive.ts",
    "lib/insights/analytics.ts",
    "lib/insights/facilitator.ts",
  ]) {
    const source = read(file).toLowerCase();
    assert.ok(!source.includes("wellbeing"), `${file} must not read wellbeing data`);
    assert.ok(!source.includes("ghq"), `${file} must not read GHQ data`);
  }
});

/* ── no composite exists anywhere ───────────────────────────────────── */

test("no module computes a composite across instruments", () => {
  const sources = [
    ...walk("lib/wellbeing", (path) => path.endsWith(".ts") && !path.endsWith(".test.ts")),
    "lib/scoring/wellbeing.ts",
    "lib/actions/wellbeing.ts",
    "lib/reports/model.ts",
  ];

  // Identifiers that would only exist if the instruments had been merged.
  const forbidden = [
    /overallScore/i,
    /combinedScore/i,
    // `wellbeingIndex` is DISC360 Wellbeing V1's own defined primary score and
    // is expected; what must not exist is an index that MERGES instruments.
    /combinedWellbeingIndex/i,
    /crossInstrumentScore/i,
    /totalEmployeeScore/i,
    /score_d\b/,
    /score_i\b/,
    /archetype_code/,
    /automaticity/,
    /mental_load/,
  ];

  for (const path of sources) {
    const source = read(path);
    for (const pattern of forbidden) {
      // model.ts legitimately builds DISC and Focus reports; only its
      // wellbeing builder is in scope.
      const scoped =
        path === "lib/reports/model.ts"
          ? source.slice(source.indexOf("export function buildWellbeingReport"))
          : source;
      assert.ok(
        !pattern.test(scoped),
        `${path} matches ${pattern} — instruments must stay separate`,
      );
    }
  }
});

test("the wellbeing report builders carry no DISC, Focus or organisational figure", () => {
  const source = read("lib/reports/model.ts");
  for (const entry of ["buildWellbeingReport", "buildDiscWellbeingReport"]) {
    const start = source.indexOf(`export function ${entry}`);
    assert.ok(start >= 0, `${entry} must exist`);
    // Body only — the doc comments above these builders say what they do NOT
    // include ("no cohort median"), which is the point, not a violation.
    const body = source.slice(start, source.indexOf("\n}", start));
    for (const forbidden of [
      "insightMap",
      "dimensionMeta",
      "FOCUS_PATTERNS",
      "combinedInsights",
      "cohortMedian",
      "organisationMedian",
      "percentile",
    ]) {
      assert.ok(!body.includes(forbidden), `${entry} must not reference ${forbidden}`);
    }
  }
});

/* ── the analytics layer never ranks people ─────────────────────────── */

test("no wellbeing module sorts or ranks by score", () => {
  for (const path of walk("lib/wellbeing", (p) => p.endsWith(".ts") && !p.endsWith(".test.ts"))) {
    const source = read(path);
    assert.ok(
      !/sort\([^)]*total_score/.test(source) && !/sort\([^)]*totalScore/.test(source),
      `${path} must not order anything by wellbeing score`,
    );
  }
});

/* ── individual rows are unreachable from management surfaces ───────── */

test("no wellbeing module joins a result to a profile or a name", () => {
  for (const path of walk("lib/wellbeing", (p) => p.endsWith(".ts") && !p.endsWith(".test.ts"))) {
    const source = read(path);
    if (path === "lib/wellbeing/queries.ts" || path === "lib/wellbeing/report.ts") continue;
    assert.ok(
      !/wellbeing_results[\s\S]{0,300}profiles\s*\(/.test(source),
      `${path} must not join wellbeing results to profiles`,
    );
  }
});

test("the migration grants no cross-participant read on individual tables", () => {
  const migration = read("supabase/migrations/00023_wellbeing_pulse.sql");
  // Isolate each own-row policy and assert it carries no disjunction.
  for (const table of ["wellbeing_sessions", "wellbeing_responses", "wellbeing_results"]) {
    const section = migration.slice(
      migration.indexOf(`alter table public.${table} enable row level security;`),
    );
    const policies = section.slice(0, section.indexOf("alter table public.", 10) + 1);
    assert.ok(
      !policies.includes("is_super_admin"),
      `${table} policies must not admit a platform administrator`,
    );
    assert.ok(
      !policies.includes("is_team_admin"),
      `${table} policies must not admit a team administrator`,
    );
    assert.ok(
      !policies.includes("has_wellbeing_role"),
      `${table} policies must not admit a wellbeing role`,
    );
  }
});

test("has_wellbeing_role has no platform-administrator fallback", () => {
  const migration = read("supabase/migrations/00023_wellbeing_pulse.sql");
  const start = migration.indexOf("create or replace function public.has_wellbeing_role");
  const body = migration.slice(start, migration.indexOf("$$;", start));
  assert.ok(
    !body.includes("is_super_admin"),
    "a platform administrator must not inherit wellbeing access",
  );
});

test("wellbeing_results has no UPDATE or DELETE policy — history is immutable", () => {
  const migration = read("supabase/migrations/00023_wellbeing_pulse.sql");
  assert.ok(!/create policy \w+ on public\.wellbeing_results\s+for update/.test(migration));
  assert.ok(!/create policy \w+ on public\.wellbeing_results\s+for delete/.test(migration));
});


/* ── no aggregate merges instruments ────────────────────────────────── */

test("analytics always filters by a single instrument", () => {
  const source = read("lib/wellbeing/analytics.ts");
  const reads = source.split('from("wellbeing_results")').slice(1);
  for (const read_ of reads) {
    const head = read_.slice(0, 600);
    assert.match(
      head,
      /\.eq\("instrument_key"/,
      "every analytics read must pin exactly one instrument — no query may span two",
    );
  }
});

test("no wellbeing module sums or averages across instruments", () => {
  for (const path of walk("lib/wellbeing", (p) => p.endsWith(".ts") && !p.endsWith(".test.ts"))) {
    const source = read(path);
    for (const pattern of [
      /ghq.*\+.*who5/i,
      /who5.*\+.*ghq/i,
      /totalScore\s*\+\s*transformedScore/,
      /wellbeingIndex\s*\+\s*totalScore/,
      /allInstrument(Scores|Totals)/i,
      /crossInstrument/i,
    ]) {
      assert.ok(!pattern.test(source), `${path} matches ${pattern} — instruments must stay apart`);
    }
  }
});

test("a participant's history is split by instrument, never concatenated", () => {
  const source = read("lib/wellbeing/queries.ts");
  assert.match(source, /WellbeingHistoryByInstrument/, "history is keyed by instrument");
  assert.match(
    source,
    /Split FIRST, then compare within each instrument/,
    "the split happens before any comparison is computed",
  );
});


/* ── shared chrome is instrument-neutral ────────────────────────────── */

/** Source with comments removed — a comment explaining a rule is not a breach. */
function code(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("shared Wellbeing Pulse chrome never names one instrument", () => {
  const chrome = code("components/wellbeing/PulseChrome.tsx");
  // The shell wraps all four instruments. Naming one in it puts "GHQ-12 is a
  // screening questionnaire" underneath a DISC360 Wellbeing result.
  for (const name of ["GHQ-12", "GHQ-28", "WHO-5", "GHQ_12"]) {
    assert.ok(!chrome.includes(name), `shared chrome must not name ${name}`);
  }
});

test("the analytics page labels metrics from the registry, not a literal", () => {
  const page = code("app/(wellbeing)/wellbeing/analytics/page.tsx");
  for (const literal of ["Median GHQ-12", "Median GHQ-28", "0–12 screening range"]) {
    assert.ok(!page.includes(literal), `analytics must not hard-code "${literal}"`);
  }
  assert.match(page, /instrument\.primaryScoreLabel/, "labels come from the instrument");
  assert.match(page, /instrument\.descriptor/, "the eyebrow comes from the instrument");
});


test("every analytics navigation link carries the selected instrument", () => {
  for (const path of [
    "components/wellbeing/analytics/WorkspaceNav.tsx",
    "app/(wellbeing)/wellbeing/analytics/page.tsx",
  ]) {
    const source = read(path);
    const links = [...source.matchAll(/\/wellbeing\/analytics\?[^`"']*/g)].map((m) => m[0]);
    assert.ok(links.length > 0, `${path} builds analytics links`);
    for (const link of links) {
      assert.ok(
        link.includes("instrument="),
        `${path}: "${link}" drops the instrument — navigating would switch instruments silently`,
      );
    }
  }
});
