import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The wellbeing workspace speaks its own language.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS IS A TEST AND NOT A STYLE GUIDE.
 *
 * A Wellbeing Pulse campaign is stored as a team and lives in the same
 * repository as DISC360, so every DISC component, label and phrase is one
 * import away. That is how a wellbeing campaign came to be presented as a
 * "DISC Behaviour Assessment" with a "Compare Members" tab in the first
 * place — nobody decided it; nothing prevented it.
 *
 * The words below are not merely off-brand here. "Compare Members" describes a
 * named-person comparison, which a wellbeing campaign must never offer.
 * "DISC profile" and "DISC score" describe a result a facilitator may read,
 * which a wellbeing result never is. A participant who sees either has been
 * told something false about who can see their answers.
 *
 * Comments are excluded. These modules EXPLAIN the boundary in prose — the
 * compare page's own header says why it is not Compare Members — and screening
 * raw text would flag the documentation of the rule as a breach of it.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");

const code = (path: string) =>
  read(path)
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
    })
    .join("\n");

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(new URL(dir, ROOT), { withFileTypes: true })) {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...walk(`${path}/`));
      continue;
    }
    if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts")) found.push(path);
  }
  return found;
}

/** Every surface a wellbeing participant or facilitator can reach. */
const SURFACES = [
  ...walk("lib/wellbeing/"),
  ...walk("components/wellbeing/"),
  ...walk("app/(wellbeing)/"),
  ...walk("app/(wellbeing-present)/"),
  "components/app/WellbeingWorkspaceEntry.tsx",
  "data/wellbeing-content.ts",
  "data/wellbeing-instruments.ts",
  "data/disc360-wellbeing-content.ts",
];

/**
 * DISC vocabulary. Legitimate elsewhere in DISC360, never here.
 *
 * "DISC360" on its own is deliberately absent: the platform escape route says
 * "Open DISC360", and the product is genuinely built on DISC360's identity
 * model. It is the words below that carry the wrong meaning.
 */
const DISC_LANGUAGE = [
  "DISC Behaviour Assessment",
  "DISC Behavior Assessment",
  "DISC profile",
  "DISC score",
  "DISC style",
  "DISC assessment",
  "The Anchor",
  "Compare Members",
  "Dominance",
  "Steadiness",
  "Conscientiousness",
  "archetype",
  "Executive Brief",
];

test("there are wellbeing surfaces to check, so this test is not vacuous", () => {
  assert.ok(SURFACES.length > 25, `only found ${SURFACES.length} surfaces`);
});

test("no wellbeing surface speaks DISC", () => {
  const offences: string[] = [];
  for (const path of SURFACES) {
    const source = code(path);
    for (const phrase of DISC_LANGUAGE) {
      if (source.toLowerCase().includes(phrase.toLowerCase())) {
        offences.push(`${path}: "${phrase}"`);
      }
    }
  }
  assert.deepEqual(offences, [], "DISC vocabulary leaked into the wellbeing workspace");
});

/**
 * The DISC dimension labels, which are a special case.
 *
 * "Influence" and "Analytical" are ordinary English words as well as DISC
 * dimension names, so a blanket ban would be unworkable — but they must never
 * appear as a LABEL. Checked as capitalised standalone words, which is how a
 * dimension name renders and is not how the ordinary words are used in a
 * sentence.
 */
test("no wellbeing surface renders a DISC dimension label", () => {
  const offences: string[] = [];
  for (const path of SURFACES) {
    const source = code(path);
    for (const label of ["Influence", "Analytical", "Dominant", "Stable"]) {
      // As a JSX text node or a quoted string on its own — a label, not prose.
      const asLabel = new RegExp(`(>\\s*${label}\\s*<|["'\`]${label}["'\`])`);
      if (asLabel.test(source)) offences.push(`${path}: "${label}"`);
    }
  }
  assert.deepEqual(offences, [], "a DISC dimension label appeared in the wellbeing workspace");
});

test("the participant shell offers no DISC assessment and no team comparison", () => {
  for (const path of [
    "app/(wellbeing)/layout.tsx",
    "app/(wellbeing)/wellbeing/page.tsx",
    "app/(wellbeing)/wellbeing/history/page.tsx",
    "app/(wellbeing)/wellbeing/result/[resultId]/page.tsx",
    "app/(wellbeing)/wellbeing/assessment/[sessionId]/page.tsx",
  ]) {
    const source = code(path);
    for (const forbidden of ["/app/teams", "/app/assessments", "/app/results", "/app/history"]) {
      assert.ok(!source.includes(forbidden), `${path} links a participant into DISC360`);
    }
  }
});

test("the DISC360 escape route is the ONE crossing, and it is authorised", () => {
  const chrome = code("components/wellbeing/PulseChrome.tsx");
  assert.match(chrome, /showPlatformLink/, "the link is conditional");
  assert.match(chrome, /Open DISC360/, "and it is named plainly rather than disguised");

  const layout = code("app/(wellbeing)/layout.tsx");
  assert.match(
    layout,
    /showPlatformLink =\s*\n?\s*profile\.is_super_admin/,
    "and the condition is resolved on the server from memberships, not from a prop",
  );

  // The projected surfaces carry no crossing at all: a control on a screen a
  // room is watching is a control somebody clicks by accident.
  for (const path of walk("app/(wellbeing-present)/")) {
    assert.ok(
      !code(path).includes("/app"),
      `${path} must offer no route into DISC360 from a projected surface`,
    );
  }
});

test("the workspace entry on the DISC dashboard is a product, not an assessment", () => {
  const entry = code("components/app/WellbeingWorkspaceEntry.tsx");
  assert.match(entry, /Open Wellbeing/, "the action opens a workspace");
  assert.match(entry, /Separate workspace/, "and it says so");
  assert.ok(
    !/ProductCards|assessment card/i.test(entry),
    "it must not be rendered as a fourth assessment",
  );
  const dashboard = read("app/app/(shell)/page.tsx");
  assert.ok(
    dashboard.indexOf("<ProductCards />") < dashboard.indexOf("<WellbeingWorkspaceEntry"),
    "and it must sit apart from the assessments rather than among them",
  );
});
