import Link from "next/link";
import { PRODUCT_IDS, getDeck, getProduct } from "@/lib/presentations/registry";

/**
 * The three assessment products, shown on the public homepage and the
 * authenticated dashboard. None is hidden behind login, pricing or a feature
 * flag — each card links to its public product page with both entry points.
 */

const DURATIONS: Record<string, string> = {
  disc: "~7 minutes · 24 scenarios",
  focus: "Under 90 seconds · 6 questions",
  combined: "~9 minutes · DISC + Focus",
};

const DESCRIPTIONS: Record<string, string> = {
  disc: "Understand how you lead, communicate and respond — four behavioural preferences, no rigid boxes.",
  focus: "A short, non-clinical pulse on the digital habits, distraction loops, mental load and energy that shape your attention.",
  combined: "Both lenses in one session: your behavioural style and your attention pattern, and how they connect.",
};

export function ProductCards({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="grid gap-4 lg:grid-cols-3">
        {PRODUCT_IDS.map((id) => {
          const product = getProduct(id);
          const deck = getDeck(product.primaryDeck);
          return (
            <article
              key={id}
              className="flex flex-col gap-4 rounded-3xl border border-hairline bg-paper p-7"
            >
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
                  {DURATIONS[id]}
                </span>
                <h3 className="font-display text-xl font-semibold leading-snug text-ink">
                  {product.name}
                </h3>
                <p className="text-sm leading-relaxed text-slate">{DESCRIPTIONS[id]}</p>
              </div>

              <div className="mt-auto flex flex-col gap-2 pt-2">
                <Link
                  href={`/present/${id}/introduction`}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-botanical px-5 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
                >
                  Start with presentation
                </Link>
                <Link
                  href={`/${id}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-hairline-strong px-5 text-sm font-medium text-ink transition-colors hover:border-botanical hover:text-botanical"
                >
                  Go straight to assessment
                </Link>
                <span className="sr-only">{deck.slides.length} intro slides</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
