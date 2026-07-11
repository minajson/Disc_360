import { GlassPanel } from "@/components/ui/GlassPanel";
import type { TeamAction } from "@/lib/insights/team";

function ActionsColumn({
  heading,
  items,
}: {
  heading: string;
  items: TeamAction[];
}) {
  return (
    <GlassPanel className="flex flex-col gap-4 p-6 sm:p-7">
      <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-accent">
        {heading}
      </h3>
      <ol className="flex flex-col gap-3.5">
        {items.map((item, index) => (
          <li
            key={item.action}
            className="flex items-start gap-3.5 text-sm leading-relaxed text-ink-secondary"
          >
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[11px] text-ink-muted">
              {index + 1}
            </span>
            {item.action}
          </li>
        ))}
      </ol>
    </GlassPanel>
  );
}

/** Suggested next moves for the team itself and its coach. */
export function TeamActionsPanel({ actions }: { actions: TeamAction[] }) {
  const teamActions = actions.filter((action) => action.audience === "team");
  const coachActions = actions.filter((action) => action.audience === "coach");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ActionsColumn heading="Suggested team actions" items={teamActions} />
      <ActionsColumn heading="For the coach" items={coachActions} />
    </div>
  );
}
