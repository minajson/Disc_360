import { GlassPanel } from "@/components/ui/GlassPanel";
import type { ArchetypeInsight } from "@/data/insight-maps";

export function LeadershipStylePanel({
  leadershipStyle,
}: {
  leadershipStyle: ArchetypeInsight["leadershipStyle"];
}) {
  return (
    <GlassPanel className="flex flex-col gap-5 p-7 sm:p-9">
      <div className="flex flex-col gap-2">
        <h3 className="font-display text-xl font-semibold tracking-tight">
          {leadershipStyle.headline}
        </h3>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-secondary">
          {leadershipStyle.description}
        </p>
      </div>
      <ul className="flex flex-col gap-2.5">
        {leadershipStyle.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-3 text-sm text-ink-secondary">
            <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full accent-gradient" />
            {bullet}
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
