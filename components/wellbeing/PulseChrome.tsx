import Link from "next/link";
import { WELLBEING_PRODUCT_NAME } from "@/data/wellbeing-content";

/**
 * Wellbeing Pulse chrome.
 *
 * This is a sibling product, not a section of DISC360. A participant who
 * scanned a Wellbeing Pulse code sees the Wellbeing Pulse mark, Wellbeing
 * Pulse navigation, and nothing else — no DISC, no Focus, no Combined, no
 * team comparison, no platform administration, and no route back into the
 * wider product.
 *
 * `showPlatformLink` is the one exception, and it is deliberately narrow: a
 * person who already holds facilitator, coach or platform scope gets a single
 * restrained escape hatch. It is resolved server-side in the layout from
 * memberships the person actually holds — an ordinary participant cannot be
 * given it by a prop, a query string or a client-side toggle.
 */

export interface PulseNavItem {
  href: string;
  label: string;
}

/**
 * `compact` drops the wordmark below the `sm` breakpoint.
 *
 * The header has to hold the mark, a variable number of nav links (an analyst
 * gets a third) and, for facilitators, the escape hatch. Tuning a breakpoint
 * only moves the clipping to a different phone or a different role, so the
 * nav is also the one shrinkable, scrollable element in the row — the mark and
 * the escape hatch never move. The glyph identifies the product on its own,
 * and the page title carries the name.
 */
export function PulseMark({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      {/* A steady pulse line inside a soft ring — calm, not medical. */}
      <svg
        viewBox="0 0 32 32"
        aria-hidden="true"
        className="h-7 w-7 shrink-0"
        fill="none"
      >
        <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeOpacity="0.28" />
        <path
          d="M5 16.5h5.2l2.6-6 3.4 11.4 2.6-7.2 1.9 4.3H27"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={`font-display text-[1.05rem] leading-none font-semibold tracking-tight ${
          compact ? "hidden sm:inline" : ""
        }`}
      >
        {WELLBEING_PRODUCT_NAME}
      </span>
    </span>
  );
}

export function PulseHeader({
  links = [],
  showPlatformLink = false,
  homeHref = "/wellbeing",
}: {
  links?: PulseNavItem[];
  /** Only ever true for an existing facilitator, coach or platform admin. */
  showPlatformLink?: boolean;
  homeHref?: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[rgba(31,78,95,0.14)] bg-[rgba(239,244,245,0.92)] backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-5xl min-w-0 items-center gap-2 px-4 py-3.5 sm:gap-4 sm:px-8">
        <Link href={homeHref} className="pulse-focus shrink-0 rounded text-pulse">
          <PulseMark compact />
        </Link>

        {links.length > 0 && (
          <nav
            aria-label="Wellbeing Pulse"
            className="ml-auto flex min-w-0 shrink items-center gap-0.5 overflow-x-auto [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="pulse-focus rounded-full px-2 py-1.5 text-sm whitespace-nowrap text-slate transition-colors hover:bg-[rgba(31,78,95,0.08)] hover:text-pulse sm:px-3"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {showPlatformLink && (
          <Link
            href="/app"
            className={`pulse-focus shrink-0 rounded-full border border-[rgba(31,78,95,0.2)] px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-slate transition-colors hover:border-pulse hover:text-pulse sm:px-3 ${
              links.length > 0 ? "" : "ml-auto"
            }`}
          >
            {/* Shortened on a phone so the row never clips. */}
            <span className="hidden sm:inline">Open DISC360 →</span>
            <span className="sm:hidden">DISC360 →</span>
          </Link>
        )}
      </div>
    </header>
  );
}

/**
 * The footer carries the disclaimer that must appear wherever a score can be
 * seen, and the privacy line participants ask about most.
 */
export function PulseFooter({ disclaimer }: { disclaimer?: string } = {}) {
  return (
    <footer className="mt-auto border-t border-[rgba(31,78,95,0.14)] px-5 py-8 sm:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 text-xs leading-relaxed text-slate">
        {/*
          Instrument-neutral by default. The platform runs four instruments,
          and naming one of them in shared chrome would put "GHQ-12 is a
          screening questionnaire" underneath a DISC360 Wellbeing result. A
          surface that knows its instrument passes that instrument's wording.
        */}
        <p className="font-medium text-ink">{disclaimer ?? WELLBEING_SHELL_DISCLAIMER}</p>
        <p>
          Your individual answers and score are private to you. They are not visible to your
          manager, your facilitator or platform administrators.
        </p>
      </div>
    </footer>
  );
}

/**
 * The one line true of every instrument on the platform. Anything more
 * specific belongs to the surface that knows which instrument it is showing.
 */
export const WELLBEING_SHELL_DISCLAIMER =
  "Wellbeing Pulse questionnaires are screening and reflection tools. They do not provide a diagnosis.";
