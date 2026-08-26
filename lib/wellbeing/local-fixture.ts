import type { InstrumentKey } from "../../data/wellbeing-instruments.ts";
import { INSTRUMENTS } from "../../data/wellbeing-instruments.ts";
import type { WorkLocation } from "../../data/wellbeing-taxonomy.ts";
import {
  instrumentCentre,
  itemPositions,
  rawTotalForIndex,
  scoreFor,
  syntheticDimensions,
  syntheticParticipantCounts,
  type SyntheticAnalyticsRow,
} from "./synthetic.ts";

/**
 * ██ LOCAL DEVELOPMENT FIXTURE — NEVER PRODUCTION, NEVER SEEDED ██
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THIS IS, AND WHY IT IS SEPARATE FROM THE DEMO POPULATION.
 *
 * `demo-population.ts` is the SHIPPED illustration. It describes a deliberately
 * neutral organisation — "Head Office", "Regional Office" — because it can be
 * seen in any environment by anyone holding a wellbeing role, and a shipped
 * artefact must not carry one customer's structure.
 *
 * This file is the opposite case. It exists so the product can be developed
 * and reviewed against a workforce that looks like the one it is being built
 * for: real Nigerian office locations, field-based and office-based work, a
 * range of functions, and enough people for cohort analytics to mean anything.
 * Those values are CUSTOMER-SPECIFIC. They are legitimate here and illegitimate
 * everywhere else, so the boundary is enforced three ways:
 *
 *  1 · `buildLocalFixture` THROWS in production. Not "returns empty", not
 *      "falls back" — throws, loudly, at the point of use.
 *  2 · Nothing here is inserted anywhere. Like the demo population it is
 *      computed, used and discarded with the request. There is no code path
 *      from this module to `wellbeing_results`, and no SQL file references
 *      any value in it.
 *  3 · None of these values reaches a platform catalogue, a default, a
 *      migration or a seed. `local-fixture.test.ts` asserts that by reading
 *      the migrations and seed scripts as text.
 *
 * WHY IT FLOWS THROUGH THE REAL AGGREGATION.
 *
 * Same reason the demo does: these rows are handed to the same aggregation,
 * wave grouping and suppression engine that live data uses, so the fixture
 * demonstrates the product's ACTUAL behaviour — including a cohort of four
 * being withheld and a second withheld alongside it so the first cannot be
 * recovered by subtraction. A hand-drawn mock could show a pretty chart; only
 * this can show that confidentiality genuinely works.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Shown on every surface fed by this population. Never beside live data. */
export const LOCAL_FIXTURE_BANNER = "LOCAL DEVELOPMENT FIXTURE";

export const LOCAL_FIXTURE_NOTE =
  "Local development data. Every person, team, score and wave on this page is generated in memory for development and review. It describes no real person and nothing here is stored.";

export class LocalFixtureUnavailableError extends Error {
  constructor() {
    super(
      "The local development fixture is not available in production. It exists for development and review only.",
    );
    this.name = "LocalFixtureUnavailableError";
  }
}

export interface FixtureEnvironment {
  isProduction: boolean;
}

/** The one condition. No flag can widen it and no role can override it. */
export function localFixtureAllowed(env: FixtureEnvironment): boolean {
  return !env.isProduction;
}

/* ── the synthetic workforce ────────────────────────────────────────── */

/**
 * Office locations, present here and NOWHERE else in the codebase.
 *
 * Deliberately not a `const` exported for reuse by a form, a catalogue or a
 * seed. A surface that needs office locations reads the organisation's own
 * governed taxonomy; these four exist to make local review realistic.
 */
const ABUJA = "Abuja";
const LAGOS = "Lagos";
const PORT_HARCOURT = "Port Harcourt";
const WARRI = "Warri";

/**
 * Functions, with their headcount split by work and office location.
 *
 * The counts are chosen to make specific product behaviour visible:
 *
 *  · Legal (4) and Internal Audit (3) sit below the confidentiality floor of
 *    seven, so the department comparison shows two genuinely withheld cohorts.
 *  · Human Resources (7) sits exactly ON the floor, so the boundary case is
 *    visible rather than theoretical.
 *  · Warri (4 across all functions) is the ONLY office below the floor, which
 *    is what forces complementary suppression to engage and withhold a second,
 *    publishable office so Warri cannot be recovered by subtraction.
 *  · `centre` differs per function, so the cohort comparison has real
 *    differences to read rather than four identical bars.
 */
const FUNCTIONS: readonly {
  name: string;
  /** Reported wellbeing centre on a 0–100 scale, before instrument mapping. */
  centre: number;
  /** Wellbeing movement across the four waves, in experience terms. */
  drift: number;
  field: number;
  offices: Readonly<Record<string, number>>;
}[] = [
  { name: "Operations", centre: 54, drift: 1, field: 12, offices: { [ABUJA]: 2, [LAGOS]: 3, [PORT_HARCOURT]: 4, [WARRI]: 1 } },
  { name: "Engineering", centre: 61, drift: 2, field: 5, offices: { [ABUJA]: 3, [LAGOS]: 4, [PORT_HARCOURT]: 3, [WARRI]: 1 } },
  { name: "Commercial", centre: 66, drift: -1, field: 0, offices: { [ABUJA]: 4, [LAGOS]: 6, [PORT_HARCOURT]: 1, [WARRI]: 1 } },
  { name: "Finance", centre: 63, drift: 0, field: 0, offices: { [ABUJA]: 4, [LAGOS]: 4, [PORT_HARCOURT]: 1, [WARRI]: 0 } },
  { name: "Human Resources", centre: 70, drift: 2, field: 0, offices: { [ABUJA]: 3, [LAGOS]: 3, [PORT_HARCOURT]: 1, [WARRI]: 0 } },
  { name: "Legal", centre: 68, drift: 0, field: 0, offices: { [ABUJA]: 2, [LAGOS]: 2, [PORT_HARCOURT]: 0, [WARRI]: 0 } },
  { name: "Internal Audit", centre: 59, drift: 1, field: 0, offices: { [ABUJA]: 1, [LAGOS]: 1, [PORT_HARCOURT]: 0, [WARRI]: 1 } },
];

/**
 * Working teams, which deliberately CROSS-CUT the functions above.
 *
 * A team that mirrored a department one-for-one would make the Teams
 * comparison a copy of the department comparison and demonstrate nothing. Here
 * every field-based person belongs to Upstream Field Services and the
 * office-based population is distributed across the rest, with Innovation Lab
 * kept small so a withheld team is visible too.
 */
const FIELD_TEAM = { id: "fixture-team-upstream", name: "Upstream Field Services" };

const OFFICE_TEAMS = [
  { id: "fixture-team-terminal", name: "Terminal Operations" },
  { id: "fixture-team-corporate", name: "Corporate Services" },
  { id: "fixture-team-digital", name: "Digital & Data" },
  { id: "fixture-team-projects", name: "Project Delivery" },
  { id: "fixture-team-lab", name: "Innovation Lab" },
] as const;

/**
 * Which office team each successive office-based person joins.
 *
 * An explicit cycle rather than a modulus, because the point is the SHAPE of
 * the result: index 4 appears once in twelve, which is what leaves Innovation
 * Lab below the floor.
 */
const OFFICE_TEAM_CYCLE = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 4];

/** Team display names, so a comparison can label a fixture team. */
export const LOCAL_FIXTURE_TEAM_NAMES = new Map<string, string>([
  [FIELD_TEAM.id, FIELD_TEAM.name],
  ...OFFICE_TEAMS.map((team) => [team.id, team.name] as [string, string]),
]);

/**
 * Four waves — and two of them deliberately share a calendar quarter.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WAVES 3 AND 4 ARE THE POINT OF THIS FIXTURE.
 *
 * A baseline in August 2026 and a post-intervention pulse in September 2026
 * are two measurements of the same workforce taken either side of something
 * the organisation did. They are the entire reason a programme runs more than
 * one pulse — and under the old calendar-quarter wave rule they became one
 * number, silently, because both fall in Q3.
 *
 * So the fixture contains that exact case. Any regression that reintroduces
 * period-derived wave identity shows up here as three waves where there
 * should be four, in a fixture a developer looks at every day.
 * ─────────────────────────────────────────────────────────────────────
 */
export const LOCAL_FIXTURE_WAVES: readonly {
  id: string;
  number: number;
  label: string;
  at: string;
  participation: number;
}[] = [
  { id: "fixture-wave-1", number: 1, label: "Baseline", at: "2025-11-12T09:00:00.000Z", participation: 62 },
  { id: "fixture-wave-2", number: 2, label: "Follow-up", at: "2026-02-11T09:00:00.000Z", participation: 74 },
  // Same quarter as wave 4 — August and September 2026 are both Q3.
  { id: "fixture-wave-3", number: 3, label: "Baseline (re-measure)", at: "2026-08-12T09:00:00.000Z", participation: 81 },
  { id: "fixture-wave-4", number: 4, label: "Post-intervention", at: "2026-09-09T09:00:00.000Z", participation: 69 },
];

/** The fixture campaign's waves, in the shape the analytics layer reads. */
export function localFixtureWaves(): {
  id: string;
  campaignId: string;
  campaignName: string;
  number: number;
  label: string;
  openedAt: string;
  closedAt: string | null;
}[] {
  return LOCAL_FIXTURE_WAVES.map((wave) => ({
    id: wave.id,
    campaignId: FIELD_TEAM.id,
    campaignName: "Local development campaign",
    number: wave.number,
    label: wave.label,
    openedAt: wave.at,
    closedAt: wave.at,
  }));
}

/**
 * The roster this fixture reports a participation rate against.
 *
 * Larger than the answering population on purpose: a fixture where everyone
 * invited responds shows a participation figure of 100% and therefore shows
 * nothing about how the product handles partial participation.
 */
export const LOCAL_FIXTURE_INVITED = 92;

interface FixturePerson {
  /** Synthetic. There is no profile, and therefore no identifier to protect. */
  key: string;
  index: number;
  department: string;
  centre: number;
  drift: number;
  workLocation: WorkLocation;
  office: string | null;
  teamId: string;
}

/** The workforce, built once and identically every time. */
function buildPeople(): FixturePerson[] {
  const people: FixturePerson[] = [];
  let index = 0;
  let officeIndex = 0;

  for (const fn of FUNCTIONS) {
    const place = (workLocation: WorkLocation, office: string | null) => {
      let teamId: string;
      if (workLocation === "field_based") {
        teamId = FIELD_TEAM.id;
      } else {
        teamId = OFFICE_TEAMS[OFFICE_TEAM_CYCLE[officeIndex % OFFICE_TEAM_CYCLE.length]!]!.id;
        officeIndex += 1;
      }
      people.push({
        key: `fx-${String(index).padStart(3, "0")}`,
        index,
        department: fn.name,
        centre: fn.centre,
        drift: fn.drift,
        workLocation,
        office,
        teamId,
      });
      index += 1;
    };

    for (let i = 0; i < fn.field; i += 1) {
      // Field-based work has no office location — the participant form does
      // not ask for one, so the fixture must not invent one either.
      place("field_based", null);
    }
    for (const [office, count] of Object.entries(fn.offices)) {
      for (let i = 0; i < count; i += 1) place("office_based", office);
    }
  }

  return people;
}

/**
 * Whether this person answered this wave.
 *
 * Deterministic and uneven: each wave has its own participation rate, so the
 * Trends view shows a participation line that moves, and the same person's
 * history has genuine gaps in it.
 */
function answered(person: FixturePerson, wave: number): boolean {
  return (person.index * 7 + wave * 29) % 100 < LOCAL_FIXTURE_WAVES[wave]!.participation;
}

export type LocalFixtureRow = SyntheticAnalyticsRow & { person: string };

/**
 * Builds the local development population for ONE instrument.
 *
 * Throws in production. The throw is the mechanism — a fallback would let a
 * misconfiguration quietly publish customer-shaped synthetic figures as if
 * they described a real workforce.
 */
export function buildLocalFixture(
  instrumentKey: InstrumentKey,
  env: FixtureEnvironment,
): LocalFixtureRow[] {
  if (!localFixtureAllowed(env)) throw new LocalFixtureUnavailableError();

  const instrument = INSTRUMENTS[instrumentKey];
  const onHundred = instrument.primaryScoreMax === 100;
  const max = instrument.primaryScoreMax;
  const threshold = instrument.hasThreshold ? (instrument.defaultThreshold ?? 4) : null;

  const rows: LocalFixtureRow[] = [];

  for (const person of buildPeople()) {
    for (let wave = 0; wave < LOCAL_FIXTURE_WAVES.length; wave += 1) {
      if (!answered(person, wave)) continue;

      // Movement is expressed in EXPERIENCE terms and translated by the
      // instrument, so improving wellbeing is a rising WHO-5 score and a
      // falling GHQ count without either surface knowing the difference.
      const centre = instrumentCentre(instrument, person.centre, person.drift * wave);
      const score = scoreFor(centre, person.index, wave, max);

      rows.push({
        person: person.key,
        instrument_key: instrumentKey,
        total_score: onHundred ? rawTotalForIndex(instrumentKey, score) : score,
        index_score: onHundred ? score : null,
        threshold_at_completion: threshold,
        at_or_above_threshold: threshold === null ? null : score >= threshold,
        completed_at: LOCAL_FIXTURE_WAVES[wave]!.at,
        wave_id: LOCAL_FIXTURE_WAVES[wave]!.id,
        team_id: person.teamId,
        department_at_completion: person.department,
        work_location_at_completion: person.workLocation,
        office_location_at_completion: person.office,
        item_positions: itemPositions(instrument, person.index, wave),
        wellbeing_result_dimensions: syntheticDimensions(instrument, score, person.index),
      });
    }
  }

  return rows;
}

/** Distinct PEOPLE per cohort, exactly as the database counts them. */
export function localFixtureParticipantCounts(rows: readonly LocalFixtureRow[]) {
  return syntheticParticipantCounts(rows);
}

/** Deliberately unexported elsewhere: the fixture's own headcount, for tests. */
export function localFixtureHeadcount(): number {
  return buildPeople().length;
}
