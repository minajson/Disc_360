import { GlassPanel } from "@/components/ui/GlassPanel";
import { ResultGlyph } from "@/components/charts/ResultGlyph";
import { insightMap } from "@/data/insight-maps";
import { displayArchetypeCode } from "@/lib/utils/display";
import {
  DIMENSION_KEY,
  DIMENSIONS,
  type Dimension,
  type TeamMember,
} from "@/lib/types";

const primaryOf = (member: TeamMember): Dimension =>
  member.archetypeCode === "BAL"
    ? ([...DIMENSIONS].sort(
        (a, b) =>
          member.normalized[DIMENSION_KEY[b]] -
          member.normalized[DIMENSION_KEY[a]],
      )[0] as Dimension)
    : (member.archetypeCode[0] as Dimension);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function MemberCard({ member }: { member: TeamMember }) {
  const insight = insightMap[member.archetypeCode];
  const primary = primaryOf(member);
  const color = `var(--color-disc-${primary.toLowerCase()})`;

  return (
    <GlassPanel className="flex items-center gap-4 p-5">
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-full font-mono text-sm font-medium text-ink"
        style={{
          background: `color-mix(in oklch, ${color} 14%, transparent)`,
          border: `1.5px solid color-mix(in oklch, ${color} 45%, transparent)`,
        }}
      >
        {initials(member.displayName)}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-display text-sm font-semibold text-ink">
          {member.displayName}
        </span>
        <span className="truncate text-xs text-ink-muted">
          {member.roleTitle} · {member.department}
        </span>
        <span className="truncate font-mono text-[11px] text-accent">
          {insight.name} · {displayArchetypeCode(member.archetypeCode)}
        </span>
      </div>

      <ResultGlyph scores={member.normalized} size={40} className="shrink-0" />
    </GlassPanel>
  );
}
