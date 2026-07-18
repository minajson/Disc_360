import type { Metadata } from "next";
import { getProduct } from "@/lib/presentations/registry";
import { startFocusAssessment } from "@/lib/actions/focus";
import { ProductStartScreen } from "@/components/presentations/ProductStartScreen";

export const metadata: Metadata = {
  title: "Focus & Digital Dopamine Pulse",
  description:
    "A short, non-clinical pulse on the digital habits, distraction loops, mental load and energy patterns that shape your attention at work.",
};

/** Public product page for the Focus Pulse. */
export default function FocusProductPage() {
  return (
    <ProductStartScreen
      product={getProduct("focus")}
      introHrefFor={(deckType) => `/present/focus/introduction?deck=${deckType}`}
      startAction={startFocusAssessment}
      backHref="/present"
      backLabel="All products"
    />
  );
}
