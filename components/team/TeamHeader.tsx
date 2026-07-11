import { Badge } from "@/components/ui/Badge";
import { DimensionPill } from "@/components/ui/DimensionPill";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSIONS, type Dimension } from "@/lib/types";
import type { TeamOverview } from "@/lib/insights/team";

export function TeamHeader({ overview }: { overview: TeamOverview }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="accent">Team intelligence</Badge>
        <span className="font-mono text-xs text-ink-muted">
          {overview.members.length} members
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {overview.team.name}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-secondary">
          Every member mapped across Dominant, Influence, Stable, and
          Analytical — where the team concentrates, where it thins out, and
          what that means for how it decides.
        </p>
      </div>

      <div className="max-w-3xl rounded-2xl border border-line bg-white/[0.03] p-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
          Culture summary
        </span>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          {overview.cultureSummary}
        </p>
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        {DIMENSIONS.map((dim: Dimension) => (
          <div key={dim} className="flex items-center gap-2.5">
            <DimensionPill dimension={dim} compact />
            <dt className="sr-only">{dimensionMeta[dim].label} primaries</dt>
            <dd className="font-mono text-xs text-ink-secondary">
              {overview.composition[dim]}{" "}
              {overview.composition[dim] === 1 ? "primary" : "primaries"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
