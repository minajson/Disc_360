import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_IDS, getProduct } from "@/lib/presentations/registry";
import { getDeck } from "@/lib/presentations/registry";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = { title: "Presentations" };

/** Hub listing the three assessment products and their introduction decks. */
export default function PresentationsHubPage() {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col justify-center gap-10 px-5 py-16 sm:px-8">
      <div className="flex flex-col gap-3">
        <Eyebrow>Facilitator presentations</Eyebrow>
        <h1 className="font-display text-[length:var(--text-h1)] font-semibold leading-[1.06] tracking-[-0.015em] text-ink">
          Introduce the session before the assessment begins.
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-slate">
          Each assessment product includes an optional, responsive introduction
          deck. Open a product to present it or go straight to the assessment.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PRODUCT_IDS.map((id) => {
          const product = getProduct(id);
          const deck = getDeck(product.primaryDeck);
          return (
            <Link
              key={id}
              href={`/present/${id}`}
              className="group flex flex-col gap-3 rounded-2xl border border-hairline bg-paper p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-botanical"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
                {deck.slides.length} slides
              </span>
              <span className="font-display text-lg font-semibold leading-snug text-ink">
                {product.name}
              </span>
              <span className="text-sm leading-relaxed text-slate">{product.tagline}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
