import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SCREENING_THRESHOLD } from "@/lib/scoring/wellbeing";
import { DEFAULT_MIN_COHORT } from "@/lib/wellbeing/suppression";

/**
 * The governed numbers, resolved server-side.
 *
 * The screening threshold and the confidentiality floor are policy: changing
 * either changes how every subsequent result reads and how much of a workforce
 * can be reported at all. They are never taken from a client, never read from
 * an environment variable, and never hard-coded into a component.
 *
 * `wellbeing_active_policy` returns both numbers from a single row, so a
 * caller cannot end up with a threshold from one policy and a floor from
 * another. If the lookup fails, this falls back to the shipped defaults rather
 * than to whatever the caller hoped for — a missing policy must not silently
 * widen disclosure.
 */

export interface WellbeingPolicy {
  screeningThreshold: number;
  minCohortSize: number;
  /** True when the shipped defaults were used because no row resolved. */
  isDefault: boolean;
}

export const SHIPPED_POLICY: WellbeingPolicy = {
  screeningThreshold: DEFAULT_SCREENING_THRESHOLD,
  minCohortSize: DEFAULT_MIN_COHORT,
  isDefault: true,
};

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

  // A policy row that somehow fell outside the constrained range is treated as
  // absent. The database CHECK makes this unreachable; the guard stays because
  // "unreachable" and "safe to assume" are not the same thing for a number
  // that decides what a workforce is told about itself.
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 12) return SHIPPED_POLICY;
  if (!Number.isInteger(floor) || floor < 5) return SHIPPED_POLICY;

  return { screeningThreshold: threshold, minCohortSize: floor, isDefault: false };
}
