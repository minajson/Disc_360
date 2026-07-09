import { GlassPanel } from "@/components/ui/GlassPanel";
import type { ArchetypeInsight } from "@/data/insight-maps";

export function BlindSpotsList({
  blindSpots,
}: {
  blindSpots: ArchetypeInsight["blindSpots"];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {blindSpots.map((spot) => (
        <GlassPanel
          key={spot.title}
          className="flex flex-col gap-2.5 border-disc-d/20 p-5"
        >
          <h3 className="font-display text-sm font-semibold text-disc-d-glow">
            {spot.title}
          </h3>
          <p className="text-sm leading-relaxed text-ink-secondary">
            {spot.detail}
          </p>
        </GlassPanel>
      ))}
    </div>
  );
}
