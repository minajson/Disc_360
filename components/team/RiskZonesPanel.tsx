import { GlassPanel } from "@/components/ui/GlassPanel";
import { cn } from "@/lib/utils/cn";
import type { RiskZone } from "@/lib/insights/team";

const severityStyles: Record<RiskZone["severity"], { label: string; chip: string; border: string }> = {
  high: {
    label: "High attention",
    chip: "border-disc-d/40 bg-disc-d/10 text-disc-d-glow",
    border: "border-disc-d/25",
  },
  watch: {
    label: "Watch",
    chip: "border-disc-i/40 bg-disc-i/10 text-disc-i-glow",
    border: "border-line",
  },
};

export function RiskZonesPanel({ riskZones }: { riskZones: RiskZone[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {riskZones.map((zone) => {
        const style = severityStyles[zone.severity];
        return (
          <GlassPanel
            key={zone.title}
            className={cn("flex flex-col gap-3 p-6", style.border)}
          >
            <span
              className={cn(
                "self-start rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em]",
                style.chip,
              )}
            >
              {style.label}
            </span>
            <h3 className="font-display text-base font-semibold text-ink">
              {zone.title}
            </h3>
            <p className="text-sm leading-relaxed text-ink-secondary">
              {zone.detail}
            </p>
          </GlassPanel>
        );
      })}
    </div>
  );
}
