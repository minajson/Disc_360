import { GlassPanel } from "@/components/ui/GlassPanel";
import type { ArchetypeInsight } from "@/data/insight-maps";

function MotivationColumn({
  heading,
  accent,
  markColor,
  items,
}: {
  heading: string;
  accent: string;
  markColor: string;
  items: string[];
}) {
  return (
    <GlassPanel className="flex flex-col gap-4 p-6">
      <h3
        className={`font-mono text-xs uppercase tracking-[0.14em] ${accent}`}
      >
        {heading}
      </h3>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 text-sm leading-relaxed text-ink-secondary"
          >
            <span
              aria-hidden
              className="mt-[7px] size-1.5 shrink-0 rounded-full"
              style={{ background: markColor }}
            />
            {item}
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}

/** What fuels this archetype and what depletes it. */
export function MotivationPanel({
  motivators,
  drainers,
}: {
  motivators: ArchetypeInsight["motivators"];
  drainers: ArchetypeInsight["drainers"];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <MotivationColumn
        heading="What fuels you"
        accent="text-disc-s-glow"
        markColor="var(--color-disc-s)"
        items={motivators}
      />
      <MotivationColumn
        heading="What drains you"
        accent="text-disc-d-glow"
        markColor="var(--color-disc-d)"
        items={drainers}
      />
    </div>
  );
}
