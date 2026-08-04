import "server-only";
import { getTeamIntelligence } from "@/lib/insights/team";
import {
  buildFacilitatorInsights,
  departmentInsights,
  type DepartmentInsight,
  type FacilitatorInsightSet,
} from "@/lib/insights/facilitator";
import type { BoardProfile } from "@/lib/insights/board";

/**
 * Team-scoped facilitator insights.
 *
 * Scope discipline: every figure on this page comes from getTeamIntelligence
 * for ONE teamId, which authorizes the viewer, filters results by that team
 * (`.eq("team_id", teamId)`) and applies the team's anonymization setting.
 * Nothing organisation-wide, and nothing from a participant's other teams,
 * can reach this surface — a member who also sits on another team contributes
 * only the profile they completed for *this* one.
 */

export interface TeamInsightsPayload {
  teamId: string;
  teamName: string;
  memberCount: number;
  completedCount: number;
  set: FacilitatorInsightSet;
  departments: DepartmentInsight[];
}

export async function getTeamInsights(
  teamId: string,
  now: Date = new Date(),
): Promise<TeamInsightsPayload | { error: string }> {
  const data = await getTeamIntelligence(teamId, { requireAdmin: true });
  if ("error" in data) return data;

  const generatedAt = now.toISOString();
  const profiles: BoardProfile[] = data.profiles.map((profile) => ({
    scores: profile.scores,
    primary: profile.primary,
    archetypeCode: profile.archetypeCode,
    department: profile.department,
  }));

  // Invited head-count per department, so a department card can report
  // coverage rather than only what has landed so far.
  const memberCountByDepartment: Record<string, number> = {};
  for (const department of data.departments) memberCountByDepartment[department] = 0;
  for (const profile of data.profiles) {
    const key = profile.department ?? "Unassigned";
    memberCountByDepartment[key] = (memberCountByDepartment[key] ?? 0) + 1;
  }

  return {
    teamId: data.teamId,
    teamName: data.teamName,
    memberCount: data.memberCount,
    completedCount: data.completedCount,
    set: buildFacilitatorInsights(
      profiles,
      { label: data.teamName, basis: "group", generatedAt },
      data.memberCount,
    ),
    departments: departmentInsights(profiles, memberCountByDepartment, generatedAt),
  };
}
