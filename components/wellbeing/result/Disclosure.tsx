/**
 * "Understand my result" — the longer explanation, folded away by default.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THE EXPLANATION IS NOT DELETED, AND NOT SHOWN EITHER.
 *
 * The mobile result had become a wall of prose that a participant scrolled
 * through before finding their own score. Every paragraph in it was there for
 * a reason — a screening figure that arrives with no explanation is how people
 * conclude they have been diagnosed with something — so the answer is not to
 * cut the responsible explanation but to stop putting it in front of the
 * score.
 *
 * `<details>` rather than a state hook: it opens and closes with no JavaScript,
 * it is in the accessibility tree as a disclosure with the right expanded
 * state, and it is findable by the browser's own in-page search when closed in
 * every current engine.
 * ─────────────────────────────────────────────────────────────────────
 */
export function Disclosure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-t border-[rgba(31,78,95,0.14)] pt-4">
      <summary className="pulse-focus flex cursor-pointer list-none items-center gap-2 rounded text-sm font-medium text-pulse [&::-webkit-details-marker]:hidden">
        <Chevron />
        {label}
      </summary>
      <div className="mt-4 flex flex-col gap-3.5">{children}</div>
    </details>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open:rotate-90"
      fill="none"
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
