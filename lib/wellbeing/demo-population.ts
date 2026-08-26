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
 * The ANALYTICS DEMO population — synthetic, illustrative, and never stored.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS IS GENERATED IN MEMORY RATHER THAN SEEDED.
 *
 * A ten-person pilot cannot responsibly demonstrate cross-cohort analytics:
 * with a confidentiality floor of seven, almost every subdivision of ten
 * people is correctly withheld. Management still needs to see what the
 * workspace does at scale, so there has to be an illustrative population.
 *
 * The obvious way to provide one is to seed rows into `wellbeing_results`.
 * That is exactly what must not happen. Synthetic figures sitting in the same
 * table as real participants' screening data is one bad WHERE clause away from
 * a demonstration that quietly reports invented numbers as a real workforce —
 * or worse, a real workforce's numbers as a demonstration. So the demo
 * population never touches a participant table, in any environment: it is
 * computed here, from a fixed seed, and thrown away with the request.
 *
 * WHY IT FLOWS THROUGH THE REAL AGGREGATION.
 *
 * These rows have the same shape as rows read from the database, and they are
 * handed to the same aggregation, the same wave grouping and the same
 * suppression engine. Nothing about the demo path re-implements a figure. That
 * means the demo demonstrates the product's ACTUAL behaviour — including a
 * cohort of four being withheld, and a second withheld alongside it so the
 * first cannot be recovered by subtraction. A hand-drawn mock could show a
 * pretty chart; only this can show that confidentiality genuinely works.
 *
 * WHY IT IS DETERMINISTIC.
 *
 * No randomness anywhere. The same request produces the same population, so a
 * screenshot taken for a board pack still matches the screen a week later, and
 * a test can assert an exact figure.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Marks every surface fed by this population. Never shown beside live data. */
export const ILLUSTRATIVE_DATA_BANNER = "ILLUSTRATIVE DEMO DATA";

export const DEMO_SOURCE_NOTE =
  "Every figure on this page is synthetic and generated for demonstration. It describes no real person, no real team and no real organisation, and nothing here is stored.";

/**
 * The shape the analytics layer consumes, plus the synthetic person key that
 * distinct-participant counting needs.
 *
 * The key is NOT an identifier: there is no person, no profile and no session
 * behind it. It exists so counting people can never quietly become counting
 * rows — which is exactly what happens when the person is inferred from row
 * order and a population later gains uneven per-wave participation.
 */
export type DemoAnalyticsRow = SyntheticAnalyticsRow & { person: string };

/**
 * The illustrative organisation.
 *
 * Drawn from the NEUTRAL platform catalogue, so the demonstration describes no
 * real customer's structure — the same rule that governs what 00028 seeds.
 *
 * `Legal` is deliberately four people: below the floor of seven, so the demo
 * shows a withheld cohort rather than describing one. `Procurement` is six,
 * which is what forces complementary suppression to engage.
 */
const DEPARTMENTS: readonly { name: string; people: number; centre: number }[] = [
  { name: "Operations", people: 14, centre: 56 },
  { name: "Engineering", people: 11, centre: 59 },
  { name: "Information Technology", people: 9, centre: 62 },
  { name: "Finance", people: 8, centre: 65 },
  { name: "Human Resources", people: 7, centre: 66 },
  { name: "Procurement", people: 6, centre: 61 },
  { name: "Legal", people: 4, centre: 69 },
];

const OFFICES = ["Head Office", "Regional Office", "Other"] as const;

/**
 * Four waves, oldest first, on fixed dates and with explicit identities.
 *
 * Identities rather than dates to be rounded: a wave is a thing this
 * population HAS, exactly as a live campaign does, so the illustration
 * exercises the same wave path rather than a parallel one.
 */
const WAVES: readonly { id: string; number: number; label: string; at: string; drift: number }[] = [
  { id: "demo-wave-1", number: 1, label: "Baseline", at: "2025-09-15T10:00:00.000Z", drift: 0 },
  { id: "demo-wave-2", number: 2, label: "", at: "2025-12-15T10:00:00.000Z", drift: 1 },
  { id: "demo-wave-3", number: 3, label: "", at: "2026-03-16T10:00:00.000Z", drift: 2 },
  { id: "demo-wave-4", number: 4, label: "", at: "2026-06-15T10:00:00.000Z", drift: 3 },
];

/** The illustrative campaign's waves, in the shape the analytics layer reads. */
export function demoWaves(): {
  id: string;
  campaignId: string;
  campaignName: string;
  number: number;
  label: string;
  openedAt: string;
  closedAt: string | null;
}[] {
  return WAVES.map((wave) => ({
    id: wave.id,
    campaignId: TEAMS[0]!.id,
    campaignName: "Illustrative campaign",
    number: wave.number,
    label: wave.label,
    openedAt: wave.at,
    closedAt: wave.at,
  }));
}

const TEAMS = [
  { id: "demo-team-north", name: "Northern Operations" },
  { id: "demo-team-central", name: "Central Services" },
  { id: "demo-team-projects", name: "Project Delivery" },
] as const;

/** Team display names, so the comparison can label a demo team. */
export const DEMO_TEAM_NAMES = new Map<string, string>(
  TEAMS.map((team) => [team.id, team.name]),
);

/** The illustrative headcount, used as the participation denominator. */
export const DEMO_INVITED = DEPARTMENTS.reduce((total, entry) => total + entry.people, 0) + 12;

/**
 * Builds the illustrative population for ONE instrument.
 *
 * Each instrument gets figures on its OWN scale — a GHQ-12 count of 0–12, a
 * WHO-5 transformed 0–100, a DISC360 Wellbeing index of 0–100 — because a
 * demonstration that plotted one instrument's numbers on another's axis would
 * be teaching management the one thing this product refuses to do.
 */
export function buildDemoPopulation(instrumentKey: InstrumentKey): DemoAnalyticsRow[] {
  const instrument = INSTRUMENTS[instrumentKey];
  const onHundred = instrument.primaryScoreMax === 100;
  const max = instrument.primaryScoreMax;
  const threshold = instrument.hasThreshold ? (instrument.defaultThreshold ?? 4) : null;

  const rows: DemoAnalyticsRow[] = [];
  let personIndex = 0;

  for (const department of DEPARTMENTS) {
    for (let person = 0; person < department.people; person += 1) {
      personIndex += 1;
      // A third of every department is field-based, so Field vs Office has
      // both cohorts above the floor and the comparison is demonstrable.
      const fieldBased = personIndex % 3 === 0;
      const workLocation: WorkLocation = fieldBased ? "field_based" : "office_based";
      // Field-based work has no office location — the participant form does
      // not ask for one, so the illustration must not invent one either.
      const office = fieldBased ? null : OFFICES[personIndex % OFFICES.length]!;
      const team = TEAMS[personIndex % TEAMS.length]!;

      for (let wave = 0; wave < WAVES.length; wave += 1) {
        // Direction, cut-off anchoring and drift are all the shared engine's
        // business — see lib/wellbeing/synthetic.ts. Reproducing any of it
        // here is how the demo and the local fixture start disagreeing about
        // what a figure means.
        const centre = instrumentCentre(instrument, department.centre, WAVES[wave]!.drift);
        const score = scoreFor(centre, person, wave, max);

        rows.push({
          person: `demo-p${personIndex}`,
          instrument_key: instrumentKey,
          total_score: onHundred ? rawTotalForIndex(instrumentKey, score) : score,
          index_score: onHundred ? score : null,
          threshold_at_completion: threshold,
          at_or_above_threshold: threshold === null ? null : score >= threshold,
          completed_at: WAVES[wave]!.at,
          wave_id: WAVES[wave]!.id,
          team_id: team.id,
          department_at_completion: department.name,
          work_location_at_completion: workLocation,
          office_location_at_completion: office,
          item_positions: itemPositions(instrument, person, wave),
          wellbeing_result_dimensions: syntheticDimensions(instrument, score, person),
        });
      }
    }
  }

  return rows;
}

/**
 * Distinct-participant counts for the demo population.
 *
 * Delegates to the shared counter, which counts PEOPLE from each row's own
 * synthetic person key. Four people across four waves are sixteen rows and
 * still four people, and the demo must demonstrate that rather than quietly
 * counting rows and publishing a cohort that should have been withheld.
 */
export function demoParticipantCounts(rows: DemoAnalyticsRow[]): {
  overall: number;
  byScope: Map<string, Map<string, number>>;
} {
  return syntheticParticipantCounts(rows);
}
