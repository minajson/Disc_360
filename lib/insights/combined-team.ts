import "server-only";
import { requireTeamAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { dimensionMeta } from "@/data/dimension-meta";
import { getFocusTeamSummary, type FocusTeamSummary, type Distribution } from "@/lib/insights/focus-team";
import type { Dimension } from "@/lib/types";

/**
 * Integrated (DISC + Focus) team summary. Reuses the Focus aggregation and adds
 * the DISC behavioural distribution plus a few behaviour × attention team
 * observations. Aggregate only; service role after `requireTeamAdmin`.
 */

export interface CombinedTeamSummary {
  teamId: string;
  teamName: string;
  discDistribution: Distribution[];
  behaviourAttention: string[];
  teamStrengths: string[];
  teamVulnerabilities: string[];
  focus: FocusTeamSummary;
}

const DISC_KEY: Record<Dimension, string> = { D: "score_d", I: "score_i", S: "score_s", C: "score_c" };

export async function getCombinedTeamSummary(
  teamId: string,
): Promise<CombinedTeamSummary | { error: string }> {
  await requireTeamAdmin(teamId);
  const focus = await getFocusTeamSummary(teamId);
  if ("error" in focus) return focus;

  const admin = createSupabaseAdminClient();
  const { data: members } = await admin
    .from("team_members")
    .select("profile_id")
    .eq("team_id", teamId);
  const profileIds = (members ?? [])
    .map((m) => m.profile_id)
    .filter((id): id is string => Boolean(id));

  const { data: discResults } = profileIds.length
    ? await admin
        .from("assessment_results")
        // Team isolation: only results taken for this team.
        .select("profile_id, primary_dimension, score_d, score_i, score_s, score_c")
        .eq("team_id", teamId)
        .in("profile_id", profileIds)
        .order("created_at", { ascending: false })
    : { data: [] as never[] };

  // Latest DISC result per profile.
  const latest = new Map<string, NonNullable<typeof discResults>[number]>();
  for (const row of discResults ?? []) if (!latest.has(row.profile_id)) latest.set(row.profile_id, row);
  const discRows = [...latest.values()];

  const primaryCounts = new Map<Dimension, number>();
  for (const row of discRows) {
    const dim = row.primary_dimension as Dimension;
    primaryCounts.set(dim, (primaryCounts.get(dim) ?? 0) + 1);
  }
  const discDistribution: Distribution[] = (["D", "I", "S", "C"] as Dimension[])
    .filter((d) => primaryCounts.has(d))
    .map((d) => ({ label: dimensionMeta[d].label, count: primaryCounts.get(d) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  const leadDim = discDistribution[0];
  const avgDisc = (dim: Dimension) =>
    discRows.length
      ? Math.round(discRows.reduce((s, r) => s + Number(r[DISC_KEY[dim] as keyof typeof r] ?? 0), 0) / discRows.length)
      : 0;

  const behaviourAttention: string[] = [];
  if (avgDisc("D") >= 55 && focus.averageDistraction >= 55) {
    behaviourAttention.push("A results-first team with a high interruption load may keep responding to urgency and lose protected focus time.");
  }
  if (avgDisc("I") >= 55 && /messages|social/i.test(focus.topDistractionLoop[0]?.label ?? "")) {
    behaviourAttention.push("An expressive, connected team may gain energy from interaction but experience fragmented deep work.");
  }
  if (avgDisc("S") >= 55) {
    behaviourAttention.push("A steady team may need transition time after unexpected switches — signal changes early.");
  }
  if (avgDisc("C") >= 55 && focus.averageMentalLoad >= 55) {
    behaviourAttention.push("A precise team carrying high mental load may loop into checking and refinement past the point of value.");
  }
  if (behaviourAttention.length === 0) {
    behaviourAttention.push("The team's behavioural mix and attention patterns are currently well balanced.");
  }

  return {
    teamId,
    teamName: focus.teamName,
    discDistribution,
    behaviourAttention,
    teamStrengths: [
      leadDim ? `${leadDim.label} energy leads the team's behaviour.` : "A balanced behavioural mix.",
      focus.averageRecovery >= 60 ? "The team recovers focus well after interruptions." : "Clear preferences exist for how the team resets focus.",
    ],
    teamVulnerabilities: [
      focus.averageMentalLoad >= 60 ? "Mental load is high across the team right now." : "Watch for uneven interruption loads between roles.",
      focus.averageDistraction >= 60 ? "Attention is easily pulled off task collectively." : "Sudden context switches are the main risk to protect against.",
    ],
    focus,
  };
}
