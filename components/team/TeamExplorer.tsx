"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { TeamQuadrantMap } from "@/components/team/TeamQuadrantMap";
import { TeamRoster } from "@/components/team/TeamRoster";
import type { TeamMember } from "@/lib/types";

interface TeamExplorerProps {
  members: TeamMember[];
  departments: string[];
}

/** Quadrant map + roster with a working department filter. */
export function TeamExplorer({ members, departments }: TeamExplorerProps) {
  const [department, setDepartment] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      department === null
        ? members
        : members.filter((member) => member.department === department),
    [members, department],
  );

  const filters: { label: string; value: string | null }[] = [
    { label: "All departments", value: null },
    ...departments.map((dept) => ({ label: dept, value: dept })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div
        role="group"
        aria-label="Filter by department"
        className="flex flex-wrap gap-2"
      >
        {filters.map((filter) => {
          const active = department === filter.value;
          return (
            <button
              key={filter.label}
              type="button"
              onClick={() => setDepartment(filter.value)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-medium transition-all duration-200",
                active
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
              )}
            >
              {filter.label}
            </button>
          );
        })}
        <span
          aria-live="polite"
          className="ml-auto self-center font-mono text-[11px] text-ink-muted"
        >
          {filtered.length} of {members.length} members
        </span>
      </div>

      <TeamQuadrantMap members={filtered} />

      <div className="flex flex-col gap-5">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Roster
        </h2>
        <TeamRoster members={filtered} />
      </div>
    </div>
  );
}
