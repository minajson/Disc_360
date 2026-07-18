import Link from "next/link";
import { startAssessment } from "@/lib/actions/assessment";
import type { AssessmentProduct } from "@/lib/presentations/registry";
import { Eyebrow } from "@/components/ui/Eyebrow";

/**
 * The clean start screen shown when a product is opened: choose to begin with
 * the facilitator presentation, or go straight to the assessment. The Combined
 * product offers the integrated intro plus each single lens — all sourced from
 * the product's `startChoices`, so this screen never hard-codes the options.
 *
 * `introHrefFor` lets a team session point the presentation choices at the
 * team's own routes instead of the standalone ones; individuals use the
 * default standalone deck routes.
 */

interface ProductStartScreenProps {
  product: AssessmentProduct;
  /** Build the href for a presentation choice's deck. */
  introHrefFor: (deckType: "disc" | "focus" | "combined") => string;
  /** Server action for "Go straight to assessment". */
  startAction?: () => Promise<void>;
  /** Shown as a small return affordance (team dashboard, or product hub). */
  backHref?: string;
  backLabel?: string;
}

export function ProductStartScreen({
  product,
  introHrefFor,
  startAction = startAssessment,
  backHref = "/present",
  backLabel = "All products",
}: ProductStartScreenProps) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col justify-center gap-10 px-5 py-16 sm:px-8">
      <div className="flex flex-col gap-3">
        <Eyebrow>{product.name}</Eyebrow>
        <h1 className="font-display text-[length:var(--text-h1)] font-semibold leading-[1.06] tracking-[-0.015em] text-balance text-ink">
          {product.tagline}
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-slate">
          Begin with a short facilitator introduction, or go straight to the
          assessment. The presentation is optional — the facilitator controls
          the session.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {product.startChoices.map((choice) => {
          const isStraight = choice.deckType === null;
          const card =
            "group flex items-center justify-between gap-4 rounded-2xl border p-6 text-left transition-all duration-200";

          if (isStraight) {
            return (
              <form key={choice.id} action={startAction}>
                <button
                  type="submit"
                  className={`${card} w-full border-hairline bg-paper hover:-translate-y-0.5 hover:border-botanical`}
                >
                  <span className="flex flex-col gap-1">
                    <span className="font-display text-lg font-semibold text-ink">{choice.label}</span>
                    <span className="text-sm text-slate">{choice.description}</span>
                  </span>
                  <Arrow />
                </button>
              </form>
            );
          }

          const primary = choice.id === "presentation" || choice.id === "combined";
          return (
            <Link
              key={choice.id}
              href={introHrefFor(choice.deckType!)}
              className={`${card} ${
                primary
                  ? "border-botanical bg-botanical text-mineral hover:-translate-y-0.5 hover:bg-botanical-deep"
                  : "border-hairline bg-paper hover:-translate-y-0.5 hover:border-botanical"
              }`}
            >
              <span className="flex flex-col gap-1">
                <span className={`font-display text-lg font-semibold ${primary ? "text-mineral" : "text-ink"}`}>
                  {choice.label}
                </span>
                <span className={`text-sm ${primary ? "text-mineral/80" : "text-slate"}`}>
                  {choice.description}
                </span>
              </span>
              <Arrow light={primary} />
            </Link>
          );
        })}
      </div>

      {backHref ? (
        <Link href={backHref} className="text-sm text-slate transition-colors hover:text-ink">
          ← {backLabel}
        </Link>
      ) : null}

      {!product.assessmentLive ? (
        <p className="text-xs leading-relaxed text-faint">
          The dedicated {product.name} scoring is in development; starting the
          assessment currently opens the available DISC assessment.
        </p>
      ) : null}
    </div>
  );
}

function Arrow({ light }: { light?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-5 shrink-0 transition-transform group-hover:translate-x-1 ${light ? "text-mineral" : "text-botanical"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
