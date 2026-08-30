import Link from "next/link";

/**
 * The way out of Wellbeing Pulse, for people who hold more than one product.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT IT REPLACED.
 *
 * A pill in the header reading "Open DISC360 →". Wellbeing Pulse is sold,
 * scanned and completed as its own product — an employee answering a
 * confidential health questionnaire is not "in DISC360" and should not be told
 * they are. The other product's brand had no business in this chrome.
 *
 * It is still a real need: a coach or facilitator who runs both should not
 * have to retype a URL. So it is a switcher rather than an advertisement —
 * closed by default, the other workspace named only once opened, and rendered
 * only for somebody who actually holds scope in it. `showSwitcher` is resolved
 * server-side in the layout from memberships the person holds; an ordinary
 * participant cannot be given it by a prop or a query string.
 *
 * `<details>` rather than a JS popover: it opens, closes and is keyboard- and
 * screen-reader-operable with no client component and no hydration.
 * ─────────────────────────────────────────────────────────────────────
 */
export function ProductSwitcher() {
  return (
    <details className="relative shrink-0">
      <summary
        className="pulse-focus flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-[rgba(31,78,95,0.2)] px-2.5 py-1.5 text-xs font-medium text-slate transition-colors hover:border-pulse hover:text-pulse sm:px-3 [&::-webkit-details-marker]:hidden"
        aria-label="Switch workspace"
      >
        <GridGlyph />
        <span className="hidden sm:inline">Switch</span>
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-hairline bg-paper p-2 shadow-[0_18px_40px_-24px_rgba(23,32,29,0.4)]">
        <p className="px-3 pt-2 pb-1 font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
          Your workspaces
        </p>
        <span className="flex items-center gap-2 rounded-lg bg-pulse-mist px-3 py-2 text-sm font-medium text-pulse-deep">
          Wellbeing Pulse
          <span className="ml-auto font-mono text-[10px] tracking-wide text-pulse-teal uppercase">
            Here
          </span>
        </span>
        <Link
          href="/app"
          className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate transition-colors hover:bg-canvas hover:text-ink"
        >
          DISC360
          <span aria-hidden="true" className="ml-auto text-faint">
            →
          </span>
        </Link>
      </div>
    </details>
  );
}

function GridGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor">
      <rect x="2" y="2" width="4.6" height="4.6" rx="1.1" />
      <rect x="9.4" y="2" width="4.6" height="4.6" rx="1.1" />
      <rect x="2" y="9.4" width="4.6" height="4.6" rx="1.1" />
      <rect x="9.4" y="9.4" width="4.6" height="4.6" rx="1.1" />
    </svg>
  );
}
