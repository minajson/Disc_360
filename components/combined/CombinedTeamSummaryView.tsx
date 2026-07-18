import { cn } from "@/lib/utils/cn";
import { FocusTeamSummaryView } from "@/components/focus/FocusTeamSummaryView";
import type { CombinedTeamSummary } from "@/lib/insights/combined-team";
import type { Distribution } from "@/lib/insights/focus-team";

/** Integrated DISC + Focus team summary. Aggregate only. */
export function CombinedTeamSummaryView({
  summary,
  presentation = false,
}: {
  summary: CombinedTeamSummary;
  presentation?: boolean;
}) {
  return (
    <div className={cn("flex flex-col", presentation ? "gap-12" : "gap-10")}>
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal">
          Combined · team summary
        </span>
        <h1 className={cn("font-display font-semibold text-ink", presentation ? "text-[length:var(--text-display)]" : "text-h1")}>
          {summary.teamName}
        </h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Behaviour distribution (DISC)">
          <Bars items={summary.discDistribution} />
        </Panel>
        <Panel title="Attention distribution (Focus)">
          <Bars items={summary.focus.patternMix} />
        </Panel>
      </div>

      <Panel title="Behaviour × attention patterns">
        <ul className="flex flex-col gap-2.5">
          {summary.behaviourAttention.map((line) => (
            <li key={line} className="flex items-start gap-3 text-base leading-snug text-ink">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-botanical" />
              {line}
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Team strengths">
          <List items={summary.teamStrengths} accent="disc-s" />
        </Panel>
        <Panel title="Team vulnerabilities">
          <List items={summary.teamVulnerabilities} accent="disc-d" />
        </Panel>
      </div>

      <Panel title="Recommended team agreements">
        <ol className="flex flex-col gap-2.5">
          {summary.focus.recommendedAgreements.map((a, i) => (
            <li key={a} className="flex items-start gap-3 text-base leading-snug text-ink">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-botanical font-display text-xs font-semibold text-mineral">
                {i + 1}
              </span>
              {a}
            </li>
          ))}
        </ol>
      </Panel>

      {/* The full Focus team detail below the integrated view. */}
      <details className="rounded-2xl border border-hairline bg-paper p-6">
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
          Full Focus team detail
        </summary>
        <div className="pt-6">
          <FocusTeamSummaryView summary={summary.focus} />
        </div>
      </details>

      <p className="text-xs leading-relaxed text-faint">
        Aggregate team development view. Not a clinical measure and not a
        diagnosis of any individual.
      </p>
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

function Bars({ items }: { items: Distribution[] }) {
  if (items.length === 0) return <p className="text-sm text-slate">No completed results yet.</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-sm text-ink" title={item.label}>{item.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-ink/8">
            <div className="h-full rounded-full bg-botanical" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <span className="w-6 shrink-0 text-right font-mono text-sm text-slate">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

function List({ items, accent }: { items: string[]; accent: string }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-base leading-snug text-ink">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full" style={{ background: `var(--color-${accent})` }} />
          {item}
        </li>
      ))}
    </ul>
  );
}
