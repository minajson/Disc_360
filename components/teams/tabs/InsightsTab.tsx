"use client";

import { useMemo } from "react";
import { FacilitatorInsightsView } from "@/components/teams/insights/FacilitatorInsightsView";
import {
  buildFacilitatorInsights,
  departmentInsights,
} from "@/lib/insights/facilitator";
import type { TabContext } from "@/components/teams/presentation-tabs";
import type { BoardProfile } from "@/lib/insights/board";

/**
 * AI Insights, inside the facilitator presentation.
 *
 * The insight builders are pure, so the deck can derive cards from whatever
 * the presenter has filtered to — including a single department — without a
 * round trip. Scope is the deck's team; `generatedAt` comes from the server so
 * the stamped date is identical on both render passes.
 */
export function InsightsTab({ profiles, data, generatedAt }: TabContext) {
  const boardProfiles: BoardProfile[] = useMemo(
    () =>
      profiles.map((profile) => ({
        scores: profile.scores,
        primary: profile.primary,
        archetypeCode: profile.archetypeCode,
        department: profile.department,
      })),
    [profiles],
  );

  const memberCountByDepartment = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const profile of profiles) {
      const key = profile.department ?? "Unassigned";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [profiles]);

  const set = useMemo(
    () =>
      buildFacilitatorInsights(
        boardProfiles,
        { label: data.teamName, basis: "group", generatedAt },
        data.memberCount,
      ),
    [boardProfiles, data.teamName, data.memberCount, generatedAt],
  );

  const departments = useMemo(
    () => departmentInsights(boardProfiles, memberCountByDepartment, generatedAt),
    [boardProfiles, memberCountByDepartment, generatedAt],
  );

  return (
    <FacilitatorInsightsView
      set={set}
      departments={departments}
      teamName={data.teamName}
      memberCount={data.memberCount}
      completedCount={profiles.length}
      embedded
    />
  );
}
