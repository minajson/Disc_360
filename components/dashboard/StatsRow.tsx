import { GlassPanel } from "@/components/ui/GlassPanel";

export interface DashboardStat {
  label: string;
  value: string;
  hint?: string;
}

export function StatsRow({ stats }: { stats: DashboardStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <GlassPanel key={stat.label} className="flex flex-col gap-1 px-5 py-4">
          <span className="text-xs text-ink-muted">{stat.label}</span>
          <span className="font-display text-xl font-bold tracking-tight text-ink">
            {stat.value}
          </span>
          {stat.hint ? (
            <span className="font-mono text-[11px] text-ink-muted">
              {stat.hint}
            </span>
          ) : null}
        </GlassPanel>
      ))}
    </div>
  );
}
