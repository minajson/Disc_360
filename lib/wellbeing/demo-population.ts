import type { InstrumentKey } from "../../data/wellbeing-instruments.ts";
import { INSTRUMENTS } from "../../data/wellbeing-instruments.ts";
import { DISC360_WELLBEING_DIMENSIONS } from "../../data/disc360-wellbeing-items.ts";
import type { WorkLocation } from "../../data/wellbeing-taxonomy.ts";

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

/** The shape the analytics layer consumes. Mirrors WELLBEING_ANALYTICS_COLUMNS. */
export interface DemoAnalyticsRow {
  instrument_key: string;
  total_score: number;
  index_score: number | null;
  threshold_at_completion: number | null;
  at_or_above_threshold: boolean | null;
  completed_at: string;
  team_id: string | null;
  department_at_completion: string | null;
  work_location_at_completion: WorkLocation | null;
  office_location_at_completion: string | null;
  item_positions: number[];
  wellbeing_result_dimensions: { dimension_key: string; index_score: number }[] | null;
}

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

/** Four quarterly waves, oldest first, on fixed dates. */
const WAVES: readonly { at: string; drift: number }[] = [
  { at: "2025-09-15T10:00:00.000Z", drift: 0 },
  { at: "2025-12-15T10:00:00.000Z", drift: 1 },
  { at: "2026-03-16T10:00:00.000Z", drift: 2 },
  { at: "2026-06-15T10:00:00.000Z", drift: 3 },
];

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
 * A small deterministic spread around a centre.
 *
 * Not random: a fixed cycle, so the distribution has a believable shape and
 * the same person in the same wave always lands on the same score.
 */
const SPREAD = [-11, -6, -3, -1, 0, 2, 4, 7, 9, 13, -8, 5, -4, 11];

function scoreFor(centre: number, person: number, wave: number, max: number): number {
  const raw = centre + SPREAD[(person + wave * 3) % SPREAD.length]! + wave;
  return Math.max(0, Math.min(max, Math.round(raw)));
}

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
      const office = fieldBased ? null : OFFICES[personIndex % OFFICES.length]!;
      const team = TEAMS[personIndex % TEAMS.length]!;

      for (let wave = 0; wave < WAVES.length; wave += 1) {
        // A higher GHQ score means MORE reported distress, so the illustrative
        // drift has to run the other way for those instruments — otherwise the
        // demo would show "improvement" as a rising distress count.
        const centre = onHundred
          ? department.centre
          : Math.round((department.centre / 100) * max);
        const drifted = onHundred
          ? centre + WAVES[wave]!.drift
          : centre - WAVES[wave]!.drift;
        const score = scoreFor(drifted, person, wave, max);

        rows.push({
          instrument_key: instrumentKey,
          total_score: onHundred ? Math.round((score / 100) * (instrumentKey === "who5" ? 25 : 48)) : score,
          index_score: onHundred ? score : null,
          threshold_at_completion: threshold,
          at_or_above_threshold: threshold === null ? null : score >= threshold,
          completed_at: WAVES[wave]!.at,
          team_id: team.id,
          department_at_completion: department.name,
          work_location_at_completion: workLocation,
          office_location_at_completion: office,
          // One response position per item, sized to THIS instrument. An
          // empty array is not "no data" to the item engine — it is a row of
          // the wrong length, and it raises rather than silently reporting a
          // zero. Values stay within 0–3, which is inside every instrument's
          // response range (GHQ has four positions, WHO-5 six).
          item_positions: Array.from(
            { length: instrument.itemCount },
            (_, item) => Math.abs(SPREAD[(person + wave + item) % SPREAD.length]!) % 4,
          ),
          wellbeing_result_dimensions:
            instrumentKey === "disc360_wellbeing_v1"
              ? DISC360_WELLBEING_DIMENSIONS.map((dimension, index) => ({
                  dimension_key: dimension.key,
                  // Recovery & Demand sits persistently lower, so the Signals
                  // view has a genuine multi-wave pattern to surface.
                  index_score: Math.max(
                    0,
                    Math.min(100, score + SPREAD[(index + person) % SPREAD.length]! -
                      (dimension.key === "recovery_demand" ? 8 : 0)),
                  ),
                }))
              : null,
        });
      }
    }
  }

  return rows;
}

/**
 * Distinct-participant counts for the demo population.
 *
 * Mirrors what `wellbeing_participant_counts` does in the database: counts
 * PEOPLE, not rows. Four people across four waves are sixteen rows and still
 * four people, and the demo must demonstrate that rather than quietly counting
 * rows and publishing a cohort that should have been withheld.
 */
export function demoParticipantCounts(rows: DemoAnalyticsRow[]): {
  overall: number;
  byScope: Map<string, Map<string, number>>;
} {
  const perScope = new Map<string, Map<string, Set<string>>>();
  const overall = new Set<string>();

  // Generation emits one person's waves consecutively, so a person is exactly
  // WAVES.length consecutive rows and the first of them carries their cohort
  // membership. There is no participant id here because there is no
  // participant — which is the point.
  const people = rows.length / WAVES.length;
  for (let person = 0; person < people; person += 1) {
    const row = rows[person * WAVES.length]!;
    const id = `p${person}`;
    overall.add(id);
    const add = (scope: string, cohort: string | null) => {
      if (cohort === null) return;
      const byCohort = perScope.get(scope) ?? new Map<string, Set<string>>();
      const set = byCohort.get(cohort) ?? new Set<string>();
      set.add(id);
      byCohort.set(cohort, set);
      perScope.set(scope, byCohort);
    };
    add("department", row.department_at_completion);
    add("work_location", row.work_location_at_completion);
    add("office_location", row.office_location_at_completion);
    add("team", row.team_id);
  }

  const byScope = new Map<string, Map<string, number>>();
  for (const [scope, cohorts] of perScope) {
    const counts = new Map<string, number>();
    for (const [cohort, set] of cohorts) counts.set(cohort, set.size);
    byScope.set(scope, counts);
  }

  return { overall: overall.size, byScope };
}
