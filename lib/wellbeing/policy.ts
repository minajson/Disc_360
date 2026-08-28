import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  instrumentForScoringMethod,
  resolveGovernedThreshold,
  thresholdMaxFor,
  type InstrumentKey,
} from "@/data/wellbeing-instruments";
import { DEFAULT_SCREENING_THRESHOLD, WELLBEING_SCORING_METHOD } from "@/lib/scoring/wellbeing";
import { DEFAULT_MIN_COHORT } from "@/lib/wellbeing/suppression";

/**
 * The governed numbers, resolved server-side.
 *
 * The screening threshold and the confidentiality floor are policy: changing
 * either changes how every subsequent result reads and how much of a workforce
 * can be reported at all. They are never taken from a client, never read from
 * an environment variable, and never hard-coded into a component.
 *
 * `wellbeing_active_policy` returns them from a single row, so a caller cannot
 * end up with a threshold from one policy and a floor from another. If the
 * lookup fails, this falls back to the shipped defaults rather than to whatever
 * the caller hoped for — a missing policy must not silently widen disclosure.
 *
 * ─────────────────────────────────────────────────────────────────────
 * A THRESHOLD BELONGS TO AN INSTRUMENT, NOT TO AN ORGANISATION.
 *
 * This module used to expose `screeningThreshold` as a bare number, and every
 * caller applied it to whatever instrument it happened to be scoring. That was
 * correct while GHQ-12 was the only instrument with a cut-off and became wrong
 * the moment a second one existed:
 *
 *   · GHQ-28 was scored against 4 — GHQ-12's 3/4 split — rather than its own
 *     documented 4/5 split, so its results were classified against another
 *     instrument's cut-off.
 *   · The analytics surface had already been patched, in one place, to display
 *     GHQ-28's 5. So the number shown to a facilitator as the cut-off was not
 *     the number the stored results were classified by. A read and a write
 *     disagreeing about the same governed figure is worse than either being
 *     wrong on its own, because each looks right beside itself.
 *
 * The policy row itself says which instrument it governs — `scoring_method`
 * has been on the table since it was created. It was simply never read. So the
 * fix is to read it: a policy applies to the instrument whose scoring method it
 * names, and every other instrument uses its own governed default.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface WellbeingPolicy {
  /**
   * The governed threshold AS RECORDED, on the scale of the instrument named
   * by `scoringMethod`. Never apply it to another instrument — call
   * `resolveInstrumentThreshold`, which is the only safe reader.
   */
  screeningThreshold: number;
  /** Which instrument's scoring this policy governs. */
  scoringMethod: string;
  minCohortSize: number;
  /** True when the shipped defaults were used because no row resolved. */
  isDefault: boolean;
}

export const SHIPPED_POLICY: WellbeingPolicy = {
  screeningThreshold: DEFAULT_SCREENING_THRESHOLD,
  scoringMethod: WELLBEING_SCORING_METHOD,
  minCohortSize: DEFAULT_MIN_COHORT,
  isDefault: true,
};

/**
 * The threshold to score and classify a given instrument against.
 *
 * Returns null for an instrument that declares no threshold — DISC360
 * Wellbeing V1 — which must then carry no flag either. A governed GHQ cut-off
 * must never reach an unvalidated scale.
 */
export function resolveInstrumentThreshold(
  policy: WellbeingPolicy,
  instrumentKey: InstrumentKey,
): number | null {
  // The rule itself lives with the metadata it derives from, so it can be
  // tested by the unit runner — this module is `server-only`.
  return resolveGovernedThreshold(policy, instrumentKey);
}

export async function getWellbeingPolicy(
  supabase: SupabaseClient,
  organizationId: string | null,
): Promise<WellbeingPolicy> {
  const { data, error } = await supabase.rpc("wellbeing_active_policy", {
    org: organizationId,
  });
  if (error) return SHIPPED_POLICY;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return SHIPPED_POLICY;

  const threshold = Number(row.screening_threshold);
  const floor = Number(row.min_cohort_size);
  const scoringMethod = typeof row.scoring_method === "string" ? row.scoring_method : "";

  // A policy naming a scoring method no instrument implements is treated as
  // absent rather than applied to something. This is the row that would
  // otherwise survive an instrument being retired.
  const governed = instrumentForScoringMethod(scoringMethod);
  if (governed === null) return SHIPPED_POLICY;

  const max = thresholdMaxFor(governed);
  if (max === null) return SHIPPED_POLICY;
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > max) return SHIPPED_POLICY;
  if (!Number.isInteger(floor) || floor < 5) return SHIPPED_POLICY;

  return {
    screeningThreshold: threshold,
    scoringMethod,
    minCohortSize: floor,
    isDefault: false,
  };
}
