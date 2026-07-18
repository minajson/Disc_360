import "server-only";
import { requireTeamAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import {
  ENERGY_LABELS,
  FOCUS_PATTERNS,
  LOOP_LABELS,
  NOTIFICATION_LABELS,
  RESET_LABELS,
} from "@/data/focus-insights";
import type {
  EnergyKey,
  FocusPatternCode,
  LoopKey,
  NotifKey,
  ResetKey,
} from "@/lib/scoring/focus";

/**
 * Aggregate Focus Pulse summary for a team — the facilitator-facing view.
 *
 * Service role after `requireTeamAdmin` (the admin legitimately manages these
 * participants), and only aggregate numbers leave: no individual answers, and
 * names appear only when the team's `results_named` setting allows it.
 */

export interface Distribution {
  label: string;
  count: number;
}

export interface FocusTeamSummary {
  teamId: string;
  teamName: string;
  named: boolean;
  memberCount: number;
  completedCount: number;
  completionRate: number;
  averageMentalLoad: number;
  averageAutomaticity: number;
  averageDistraction: number;
  averageRecovery: number;
  /** Automatic-checking bands (from automaticity). */
  automaticChecking: Distribution[];
  topDistractionLoop: Distribution[];
  notificationResponse: Distribution[];
  /** Energy crash timeline, in day order. */
  energyTimeline: Distribution[];
  recoveryPreferences: Distribution[];
  patternMix: Distribution[];
  recommendedAgreements: string[];
  discussionPrompts: string[];
}

const ENERGY_ORDER: EnergyKey[] = ["morning", "post_lunch", "late_afternoon", "evening", "steady"];

function tally<T extends string>(values: T[], labelOf: (v: T) => string): Distribution[] {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ label: labelOf(key), count }))
    .sort((a, b) => b.count - a.count);
}

const avg = (nums: number[]) =>
  nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : 0;

export async function getFocusTeamSummary(
  teamId: string,
): Promise<FocusTeamSummary | { error: string }> {
  await requireTeamAdmin(teamId);
  const admin = createSupabaseAdminClient();

  const { data: team } = await admin
    .from("teams")
    .select("name, results_named")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { error: "Team not found" };

  const { data: members } = await admin
    .from("team_members")
    .select("profile_id")
    .eq("team_id", teamId);
  const profileIds = (members ?? [])
    .map((m) => m.profile_id)
    .filter((id): id is string => Boolean(id));

  const { data: results } = profileIds.length
    ? await admin
        .from("focus_results")
        .select("profile_id, automaticity, distraction, mental_load, recovery, pattern_code, primary_loop, notification_pattern, energy_pattern, preferred_reset")
        .in("profile_id", profileIds)
    : { data: [] as never[] };

  // One (latest) result per profile.
  const latest = new Map<string, NonNullable<typeof results>[number]>();
  for (const row of results ?? []) {
    if (!latest.has(row.profile_id)) latest.set(row.profile_id, row);
  }
  const rows = [...latest.values()];
  const completedCount = rows.length;
  const memberCount = (members ?? []).length;

  const automaticChecking = tally(
    rows.map((r) => (r.automaticity >= 66 ? "high" : r.automaticity >= 33 ? "moderate" : "low")),
    (band) => (band === "high" ? "Often automatic" : band === "moderate" ? "Sometimes" : "Rarely"),
  );

  const energyCounts = new Map<EnergyKey, number>();
  for (const r of rows) energyCounts.set(r.energy_pattern as EnergyKey, (energyCounts.get(r.energy_pattern as EnergyKey) ?? 0) + 1);
  const energyTimeline = ENERGY_ORDER.filter((k) => energyCounts.has(k)).map((k) => ({
    label: ENERGY_LABELS[k],
    count: energyCounts.get(k) ?? 0,
  }));

  const topLoop = tally(rows.map((r) => r.primary_loop as LoopKey), (k) => LOOP_LABELS[k]);
  const highLoad = rows.filter((r) => r.mental_load >= 60).length;

  const recommendedAgreements = buildAgreements(rows.length, {
    highLoadShare: rows.length ? highLoad / rows.length : 0,
    topLoop: (topLoop[0]?.label ?? ""),
    immediateCheckers: rows.filter((r) => r.notification_pattern === "immediate").length,
  });

  return {
    teamId,
    teamName: team.name,
    named: team.results_named,
    memberCount,
    completedCount,
    completionRate: memberCount ? Math.round((completedCount / memberCount) * 100) : 0,
    averageMentalLoad: avg(rows.map((r) => r.mental_load)),
    averageAutomaticity: avg(rows.map((r) => r.automaticity)),
    averageDistraction: avg(rows.map((r) => r.distraction)),
    averageRecovery: avg(rows.map((r) => r.recovery)),
    automaticChecking,
    topDistractionLoop: topLoop,
    notificationResponse: tally(rows.map((r) => r.notification_pattern as NotifKey), (k) => NOTIFICATION_LABELS[k]),
    energyTimeline,
    recoveryPreferences: tally(rows.map((r) => r.preferred_reset as ResetKey), (k) => RESET_LABELS[k]),
    patternMix: tally(rows.map((r) => r.pattern_code as FocusPatternCode), (k) => FOCUS_PATTERNS[k].name),
    recommendedAgreements,
    discussionPrompts: [
      "Where does our team's attention get pulled most — and is that by design or by default?",
      "Which meeting or notification habit could we change together this month?",
      "When is the team's collective energy highest, and what fills that window?",
    ],
  };
}

function buildAgreements(
  count: number,
  signals: { highLoadShare: number; topLoop: string; immediateCheckers: number },
): string[] {
  if (count === 0) return ["Agreements will appear once the team has completed the pulse."];
  const agreements: string[] = [];
  if (signals.highLoadShare >= 0.4) {
    agreements.push("Protect one shared no-meeting focus block each day.");
  }
  if (/messages|social/i.test(signals.topLoop)) {
    agreements.push("Agree response-time norms so async replies feel safe, not late.");
  }
  if (signals.immediateCheckers >= Math.ceil(count / 2)) {
    agreements.push("Default non-urgent notifications off during focus windows.");
  }
  agreements.push("Name the one priority for the day in the morning check-in.");
  agreements.push("Take real recovery breaks — short movement resets attention faster than pushing on.");
  return agreements.slice(0, 5);
}
