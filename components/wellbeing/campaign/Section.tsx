/**
 * A numbered editorial section.
 *
 * The campaign workspace answers one question in order — what happened, how
 * confident are we, where should attention go — and numbering makes that
 * sequence visible. It is also the antidote to a dashboard of equal-weight
 * cards, where every tile competes and none leads.
 */
export function Section({
  index,
  title,
  lead,
  aside,
  children,
}: {
  index: number;
  title: string;
  lead?: string;
  /** A short right-aligned fact — a count, a scale, a caveat. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="pulse-card flex flex-col gap-6 p-6 sm:p-9">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span
            aria-hidden="true"
            className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal tabular-nums"
          >
            {String(index).padStart(2, "0")}
          </span>
          <h2 className="font-display text-h3 font-semibold text-ink">{title}</h2>
          {aside && (
            <span className="ml-auto font-mono text-xs text-faint tabular-nums">{aside}</span>
          )}
        </div>
        {lead && <p className="max-w-3xl text-sm leading-relaxed text-slate">{lead}</p>}
      </div>
      {children}
    </section>
  );
}
