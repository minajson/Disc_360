import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { insightMap } from "@/data/insight-maps";
import { combinedInsights } from "@/lib/insights/combined";
import type { CombinedDiscData } from "@/components/combined/CombinedResultView";
import type { FocusResultData } from "@/components/focus/FocusResultView";
import type {
  ArchetypeCode,
  Dimension,
  DiscScores,
} from "@/lib/types";
import type {
  EnergyKey,
  FocusPatternCode,
  FocusResult,
  LoopKey,
  NotifKey,
  ResetKey,
} from "@/lib/scoring/focus";

/**
 * Loads and assembles a combined result from a combined_session id: the linked
 * DISC result, the linked Focus result, and the derived behaviour × attention
 * insights. Returns null when either half is missing or not owned by the user
 * (RLS also enforces ownership).
 */
export interface AssembledCombined {
  disc: CombinedDiscData;
  focus: FocusResultData;
  insights: ReturnType<typeof combinedInsights>;
}

export async function loadCombinedResult(
  supabase: SupabaseClient,
  combinedId: string,
  userId: string,
): Promise<AssembledCombined | null> {
  const { data: combined } = await supabase
    .from("combined_sessions")
    .select("id, profile_id, disc_session_id, focus_session_id")
    .eq("id", combinedId)
    .maybeSingle();
  if (!combined || combined.profile_id !== userId) return null;
  if (!combined.disc_session_id || !combined.focus_session_id) return null;

  const [{ data: discResult }, { data: focusResult }] = await Promise.all([
    supabase
      .from("assessment_results")
      .select("score_d, score_i, score_s, score_c, archetype_code, primary_dimension, secondary_dimension")
      .eq("session_id", combined.disc_session_id)
      .maybeSingle(),
    supabase
      .from("focus_results")
      .select("automaticity, distraction, mental_load, recovery, pattern_code, primary_loop, notification_pattern, energy_pattern, preferred_reset")
      .eq("session_id", combined.focus_session_id)
      .maybeSingle(),
  ]);
  if (!discResult || !focusResult) return null;

  const scores: DiscScores = {
    d: discResult.score_d,
    i: discResult.score_i,
    s: discResult.score_s,
    c: discResult.score_c,
  };
  const archetypeCode = discResult.archetype_code as ArchetypeCode;
  const disc: CombinedDiscData = {
    scores,
    primary: discResult.primary_dimension as Dimension,
    secondary: (discResult.secondary_dimension as Dimension | null) ?? null,
    archetypeCode,
    archetypeName: insightMap[archetypeCode].name,
  };

  const focusData: FocusResultData = {
    scores: {
      automaticity: focusResult.automaticity,
      distraction: focusResult.distraction,
      mentalLoad: focusResult.mental_load,
      recovery: focusResult.recovery,
    },
    patternCode: focusResult.pattern_code as FocusPatternCode,
    primaryLoop: focusResult.primary_loop as LoopKey,
    notificationPattern: focusResult.notification_pattern as NotifKey,
    energyPattern: focusResult.energy_pattern as EnergyKey,
    preferredReset: focusResult.preferred_reset as ResetKey,
  };

  // combinedInsights needs a FocusResult shape (scores + derived keys).
  const focusForInsights: FocusResult = {
    scores: focusData.scores,
    patternCode: focusData.patternCode,
    primaryLoop: focusData.primaryLoop,
    notificationPattern: focusData.notificationPattern,
    energyPattern: focusData.energyPattern,
    preferredReset: focusData.preferredReset,
  };

  return {
    disc,
    focus: focusData,
    insights: combinedInsights(disc.primary, focusForInsights),
  };
}
