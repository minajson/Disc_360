import { GlassPanel } from "@/components/ui/GlassPanel";
import { ArchetypeBadge } from "@/components/results/ArchetypeBadge";
import { insightMap, type ArchetypeInsight } from "@/data/insight-maps";

export function ComplementaryTypes({
  complementaryTypes,
}: {
  complementaryTypes: ArchetypeInsight["complementaryTypes"];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {complementaryTypes.map((complement) => {
        const insight = insightMap[complement.code];
        return (
          <GlassPanel key={complement.code} className="flex items-start gap-5 p-6">
            <ArchetypeBadge code={complement.code} className="size-12 shrink-0 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <h3 className="font-display text-base font-semibold text-ink">
                {insight.name}
              </h3>
              <p className="text-sm leading-relaxed text-ink-secondary">
                {complement.reason}
              </p>
            </div>
          </GlassPanel>
        );
      })}
    </div>
  );
}
