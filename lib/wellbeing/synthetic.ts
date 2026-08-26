import type { InstrumentMetadata } from "../../data/wellbeing-instruments.ts";
import { DISC360_WELLBEING_DIMENSIONS } from "../../data/disc360-wellbeing-items.ts";
import type { WorkLocation } from "../../data/wellbeing-taxonomy.ts";

/**
 * The shared shape of every synthetic wellbeing population.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS MODULE EXISTS SEPARATELY FROM THE POPULATIONS THAT USE IT.
 *
 * There are two synthetic populations in this product — the shipped
 * illustrative demo (neutral catalogue values, any environment) and the local
 * development fixture (customer-shaped values, never production). They must
 * differ in WHO they describe and agree completely on HOW a figure is
 * produced, because the moment one of them shapes scores differently from the
 * other, a screenshot taken from one stops predicting what the other shows.
 *
 * The two rules below are the ones that were expensive to get right, and are
 * the reason this is one module rather than two copies:
 *
 *  1 · A WELLBEING CENTRE IS NOT A DISTRESS COUNT. A department reporting 69%
 *      wellbeing must land LOW on a GHQ scale, not at 69 of 12. Mapping
 *      straight across described a healthy workforce as a crisis.
 *
 *  2 · A SCREENING CENTRE IS ANCHORED TO THE INSTRUMENT'S OWN CUT-OFF, not to
 *      a proportion of its maximum. GHQ-12 cuts off at 4 of 12 and GHQ-28 at
 *      5 of 28; anchoring to the maximum put most of a demo workforce above
 *      both, which teaches a management audience to read either instrument as
 *      an alarm.
 *
 * Nothing here is random. The same inputs always produce the same figures, so
 * a screenshot in a board pack still matches the screen a week later and a
 * test can assert an exact number.
 * ─────────────────────────────────────────────────────────────────────
 */

/** The shape the analytics layer consumes. Mirrors WELLBEING_ANALYTICS_COLUMNS. */
export interface SyntheticAnalyticsRow {
  instrument_key: string;
  total_score: number;
  index_score: number | null;
  threshold_at_completion: number | null;
  at_or_above_threshold: boolean | null;
  completed_at: string;
  team_id: string | null;
  /**
   * The synthetic wave this row belongs to.
   *
   * Present so the synthetic populations travel the SAME wave path as live
   * data. Deriving a wave from `completed_at` for synthetic rows and reading
   * `wave_id` for real ones would mean the demonstration could not show the
   * behaviour that matters most here — two waves inside one quarter staying
   * two waves.
   */
  wave_id: string | null;
  department_at_completion: string | null;
  work_location_at_completion: WorkLocation | null;
  office_location_at_completion: string | null;
  item_positions: number[];
  wellbeing_result_dimensions: { dimension_key: string; index_score: number }[] | null;
}

/**
 * A small deterministic spread around a centre.
 *
 * Not random: a fixed cycle, so the distribution has a believable shape and
 * the same person in the same wave always lands on the same score.
 */
export const SPREAD = [-11, -6, -3, -1, 0, 2, 4, 7, 9, 13, -8, 5, -4, 11];

/** A stable value from SPREAD for any pair of integers. */
export function spreadAt(a: number, b = 0): number {
  return SPREAD[Math.abs(a + b) % SPREAD.length]!;
}

/**
 * Spread scaled to the instrument's own range.
 *
 * The offsets are written for a 0–100 scale. Applying them unscaled to a
 * twelve-point instrument overshoots both ends and clamps, which piles most of
 * the responses onto the maximum.
 */
export function scoreFor(centre: number, person: number, wave: number, max: number): number {
  const scale = max / 100;
  const raw = centre + SPREAD[(person + wave * 3) % SPREAD.length]! * scale + wave * scale;
  return Math.max(0, Math.min(max, Math.round(raw)));
}

/**
 * Translates a 0–100 WELLBEING centre into a centre on this instrument's scale.
 *
 * `drift` is expressed in EXPERIENCE terms — a positive drift always means
 * improving wellbeing, which on a distress scale means a falling count.
 */
export function instrumentCentre(
  instrument: InstrumentMetadata,
  wellbeingCentre: number,
  drift = 0,
): number {
  const distress = instrument.scoreDirection === "higher_is_more_distress";
  if (!distress) return wellbeingCentre + drift;
  const cutOff = instrument.defaultThreshold ?? 4;
  const centre = cutOff * (0.4 + (100 - wellbeingCentre) / 100);
  return centre - drift * (instrument.primaryScoreMax / 100);
}

/**
 * One response position per item, sized to THIS instrument.
 *
 * An empty array is not "no data" to the item engine — it is a row of the
 * wrong length, and it raises rather than silently reporting a zero. Values
 * stay within 0–3, inside every instrument's response range.
 */
export function itemPositions(instrument: InstrumentMetadata, person: number, wave: number): number[] {
  return Array.from(
    { length: instrument.itemCount },
    (_, item) => Math.abs(SPREAD[(person + wave + item) % SPREAD.length]!) % 4,
  );
}

/**
 * Dimensions ONLY where the instrument legitimately has them.
 *
 * DISC360 Wellbeing's six and GHQ-28's four published subscales. GHQ-12 and
 * WHO-5 get none, because inventing one would assert a factor structure
 * neither instrument has.
 */
export function syntheticDimensions(
  instrument: InstrumentMetadata,
  score: number,
  person: number,
): { dimension_key: string; index_score: number }[] | null {
  if (instrument.key === "disc360_wellbeing_v1") {
    return DISC360_WELLBEING_DIMENSIONS.map((dimension, index) => ({
      dimension_key: dimension.key,
      // Recovery & Demand sits persistently lower, so the Signals view has a
      // genuine multi-wave pattern to surface rather than noise.
      index_score: Math.max(
        0,
        Math.min(
          100,
          score + spreadAt(index, person) - (dimension.key === "recovery_demand" ? 8 : 0),
        ),
      ),
    }));
  }

  if (instrument.key === "ghq28") {
    return instrument.subscales.map((subscale, index) => ({
      // The registry stores subscale keys namespaced by instrument
      // (`ghq28_somatic`), so an unprefixed key joins to nothing and the
      // profile comes back silently empty rather than failing loudly.
      dimension_key: `ghq28_${subscale.key}`,
      // Each subscale is scored 0–7 on its own seven items and carries NO
      // threshold of its own — a subscale is a profile dimension here and
      // never a finding.
      index_score: Math.max(
        0,
        Math.min(
          subscale.itemCount,
          Math.round(score / 4) +
            (Math.abs(spreadAt(index, person)) % 3) -
            1 +
            [1, 2, 0, -1][index % 4]!,
        ),
      ),
    }));
  }

  return null;
}

/**
 * The raw total that accompanies a 0–100 index.
 *
 * WHO-5 transforms a 0–25 raw into a 0–100 score; DISC360 Wellbeing indexes a
 * 0–48 raw. Both are stored, so a synthetic row carries both too.
 */
export function rawTotalForIndex(instrumentKey: string, index: number): number {
  return Math.round((index / 100) * (instrumentKey === "who5" ? 25 : 48));
}

/**
 * Distinct-participant counts for a synthetic population.
 *
 * Mirrors what `wellbeing_participant_counts` does in the database: counts
 * PEOPLE, not rows. Four people across four waves are sixteen rows and still
 * four people, and a synthetic population must demonstrate that rather than
 * quietly counting rows and publishing a cohort that should have been
 * withheld.
 *
 * Takes the person key explicitly rather than inferring it from row order.
 * Inferring worked only while every person answered every wave; a population
 * with realistic per-wave participation breaks that assumption silently, and
 * silently is the worst way for a suppression input to be wrong.
 */
export function syntheticParticipantCounts(
  rows: readonly (SyntheticAnalyticsRow & { person: string })[],
): { overall: number; byScope: Map<string, Map<string, number>> } {
  const perScope = new Map<string, Map<string, Set<string>>>();
  const overall = new Set<string>();

  for (const row of rows) {
    overall.add(row.person);
    const add = (scope: string, cohort: string | null) => {
      if (cohort === null) return;
      const byCohort = perScope.get(scope) ?? new Map<string, Set<string>>();
      const set = byCohort.get(cohort) ?? new Set<string>();
      set.add(row.person);
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
