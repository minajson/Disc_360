import type { CampaignParticipation } from "@/lib/wellbeing/campaign-workspace";

/**
 * Participation as a funnel, not as five separate counters.
 *
 * The five numbers a facilitator is given — invited, opened, started,
 * completed, pending — are stages of one journey, and printing them as five
 * equal tiles hides the only thing that makes them actionable: where people
 * are dropping out. A campaign with 40 opened and 12 completed has a very
 * different problem from one with 12 opened and 12 completed, and five tiles
 * showing "12 completed" say the same thing about both.
 *
 * Widths are proportions of the roster, so the bar is a picture of the whole
 * workforce rather than of whoever happened to engage.
 */
export function ParticipationProgress({
  participation,
  capacity,
}: {
  participation: CampaignParticipation;
  /** A pilot place limit, where one is set. */
  capacity: number | null;
}) {
  const { invited, opened, started, completed, pending } = participation;
  const denominator = Math.max(invited, 1);
  const pct = (value: number) => (value / denominator) * 100;

  const stages = [
    {
      key: "completed",
      label: "Completed",
      value: completed,
      note: "Finished the questionnaire",
      fill: "var(--color-pulse)",
    },
    {
      key: "started",
      label: "In progress",
      value: started - completed,
      note: "Answered at least one question",
      fill: "var(--color-pulse-teal)",
    },
    {
      key: "opened",
      label: "Opened",
      value: opened - started,
      note: "Consented, not yet answering",
      fill: "var(--color-pulse-soft)",
    },
    {
      key: "pending",
      label: "Not started",
      value: pending,
      note: "No attempt recorded",
      fill: "var(--color-sand)",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div
        className="flex h-3.5 w-full overflow-hidden rounded-full bg-sand"
        role="img"
        aria-label={`${completed} of ${invited} completed, ${started - completed} in progress, ${pending} not started`}
      >
        {stages.map((stage) =>
          stage.value > 0 ? (
            <span
              key={stage.key}
              style={{ width: `${pct(stage.value)}%`, background: stage.fill }}
              className="block h-full"
            />
          ) : null,
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {stages.map((stage) => (
          <div key={stage.key} className="flex flex-col gap-1">
            <dt className="flex items-center gap-2 text-[11px] tracking-[0.12em] text-faint uppercase">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ background: stage.fill }}
              />
              {stage.label}
            </dt>
            <dd className="font-display text-[clamp(1.35rem,3vw,1.75rem)] leading-none font-semibold text-ink tabular-nums">
              {stage.value}
            </dd>
            <p className="text-xs leading-snug text-slate">{stage.note}</p>
          </div>
        ))}
      </dl>

      {capacity !== null && (
        <p className="font-mono text-xs text-faint">
          Pilot capacity {capacity} · {Math.max(0, capacity - opened)} place
          {capacity - opened === 1 ? "" : "s"} remaining
        </p>
      )}
    </div>
  );
}
