/**
 * "How to read this" — a restrained explanation layer.
 *
 * Management users are not obliged to know what a median hides, why a cohort
 * is withheld, or what a threshold proportion does and does not claim. The
 * cost of not saying so is worse than a slightly longer page: a reader who
 * mistakes a distribution for a diagnosis will act on it.
 *
 * Collapsed by default and built from <details>, so it costs nothing to
 * ignore, needs no JavaScript, and is reachable by keyboard and screen reader
 * without any extra work.
 *
 * The third section is the one that matters. Any chart can say what it shows;
 * naming what it does NOT tell you is what stops a figure being over-read.
 */
export function HowToRead({
  seeing,
  matters,
  notTelling,
}: {
  seeing: string;
  matters: string;
  notTelling: string;
}) {
  return (
    <details className="group rounded-2xl border border-[rgba(31,78,95,0.16)] bg-pulse-mist/40 open:bg-pulse-mist/60">
      <summary className="pulse-focus flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium text-pulse-deep [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="text-xs transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        How to read this
      </summary>
      <div className="flex flex-col gap-4 px-5 pb-5 text-sm leading-relaxed text-slate">
        {[
          { label: "What you're seeing", body: seeing },
          { label: "Why it matters", body: matters },
          { label: "What it does not tell you", body: notTelling },
        ].map((section) => (
          <div key={section.label} className="flex flex-col gap-1">
            <p className="font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
              {section.label}
            </p>
            <p>{section.body}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
