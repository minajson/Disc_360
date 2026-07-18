import { cn } from "@/lib/utils/cn";
import type { Distribution, FocusTeamSummary } from "@/lib/insights/focus-team";

/**
 * Facilitator-facing Focus team summary. Aggregate patterns only — no
 * individual answers. Readable at projector scale; used by the dashboard page
 * and by presentation mode (`presentation` enlarges type and spacing).
 */
export function FocusTeamSummaryView({
  summary,
  presentation = false,
}: {
  summary: FocusTeamSummary;
  presentation?: boolean;
}) {
  return (
    <div className={cn("flex flex-col", presentation ? "gap-10" : "gap-8")}>
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal">
          Focus Pulse · team summary
        </span>
        <h1 className={cn("font-display font-semibold text-ink", presentation ? "text-[length:var(--text-display)]" : "text-h1")}>
          {summary.teamName}
        </h1>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Team focus metrics">
        <Stat value={`${summary.completedCount}/${summary.memberCount}`} label="completed" />
        <Stat value={`${summary.completionRate}%`} label="completion" />
        <Stat value={String(summary.averageMentalLoad)} label="avg mental load" />
        <Stat value={String(summary.averageRecovery)} label="avg recovery" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Automatic checking">
          <Bars items={summary.automaticChecking} total={summary.completedCount} />
        </Panel>
        <Panel title="Top distraction loop">
          <Bars items={summary.topDistractionLoop} total={summary.completedCount} />
        </Panel>
        <Panel title="Notification response">
          <Bars items={summary.notificationResponse} total={summary.completedCount} />
        </Panel>
        <Panel title="Energy crash timeline">
          <Bars items={summary.energyTimeline} total={summary.completedCount} />
        </Panel>
        <Panel title="Focus recovery preferences">
          <Bars items={summary.recoveryPreferences} total={summary.completedCount} />
        </Panel>
        <Panel title="Attention patterns">
          <Bars items={summary.patternMix} total={summary.completedCount} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Recommended team agreements">
          <ol className="flex flex-col gap-2.5">
            {summary.recommendedAgreements.map((a, i) => (
              <li key={a} className="flex items-start gap-3 text-base leading-snug text-ink">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-botanical font-display text-xs font-semibold text-mineral">
                  {i + 1}
                </span>
                {a}
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="Facilitator discussion prompts">
          <ul className="flex flex-col gap-2.5">
            {summary.discussionPrompts.map((p) => (
              <li key={p} className="flex items-start gap-3 text-base leading-snug text-slate">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" />
                {p}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <p className="text-xs leading-relaxed text-faint">
        Aggregate attention patterns for team development. Not a clinical measure
        and not a diagnosis of any individual.
      </p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-hairline bg-paper p-5">
      <span className="font-display text-3xl font-semibold text-ink">{value}</span>
      <span className="font-mono text-[11px] text-faint">{label}</span>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="paper-card flex flex-col gap-4 p-6">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">{title}</h2>
      {children}
    </section>
  );
}

function Bars({ items, total }: { items: Distribution[]; total: number }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate">No completed pulses yet.</p>;
  }
  const max = Math.max(total, ...items.map((i) => i.count), 1);
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-sm text-ink" title={item.label}>
            {item.label}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-ink/8">
            <div className="h-full rounded-full bg-botanical" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <span className="w-6 shrink-0 text-right font-mono text-sm text-slate">{item.count}</span>
        </div>
      ))}
    </div>
  );
}
