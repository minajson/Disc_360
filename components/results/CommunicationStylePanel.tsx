import { GlassPanel } from "@/components/ui/GlassPanel";
import type { ArchetypeInsight } from "@/data/insight-maps";

/** How this archetype communicates — their own voice, not the guide for others. */
export function CommunicationStylePanel({
  communicationStyle,
}: {
  communicationStyle: ArchetypeInsight["communicationStyle"];
}) {
  return (
    <GlassPanel className="p-6 sm:p-7">
      <ul className="grid gap-x-10 gap-y-3.5 lg:grid-cols-2">
        {communicationStyle.map((point) => (
          <li
            key={point}
            className="flex items-start gap-3 text-sm leading-relaxed text-ink-secondary"
          >
            <span
              aria-hidden
              className="mt-[7px] size-1.5 shrink-0 rounded-full accent-gradient"
            />
            {point}
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
