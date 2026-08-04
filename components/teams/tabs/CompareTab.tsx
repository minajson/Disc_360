"use client";

import { useMemo } from "react";
import { ComparisonWorkspace } from "@/components/teams/comparison/ComparisonWorkspace";
import type { TabContext } from "@/components/teams/presentation-tabs";
import type { ComparisonMember } from "@/lib/insights/comparison";

/**
 * Compare, inside the facilitator presentation.
 *
 * The same workspace the team's Compare page renders, fed the deck's already
 * filtered and label-resolved profiles — so anonymize-on and a department
 * filter apply here exactly as they do to every other slide. Scope is the
 * deck's team and nothing else.
 */
export function CompareTab({ profiles, data }: TabContext) {
  const members: ComparisonMember[] = useMemo(
    () =>
      profiles.map((profile, index) => ({
        id: `member-${index}`,
        label: profile.label,
        department: profile.department,
        roleTitle: profile.roleTitle,
        scores: profile.scores,
        archetypeName: profile.archetypeName,
        primary: profile.primary,
      })),
    [profiles],
  );

  return (
    <ComparisonWorkspace
      members={members}
      teamName={data.teamName}
      named={data.named}
      embedded
    />
  );
}
