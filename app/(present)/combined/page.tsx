import type { Metadata } from "next";
import { getProduct } from "@/lib/presentations/registry";
import { startCombinedAssessment } from "@/lib/actions/combined";
import { ProductStartScreen } from "@/components/presentations/ProductStartScreen";

export const metadata: Metadata = {
  title: "Combined DISC + Focus Assessment",
  description:
    "One session, both lenses: your behavioural style and your attention pattern, and how they connect.",
};

/** Public product page for the Combined assessment. */
export default function CombinedProductPage() {
  return (
    <ProductStartScreen
      product={getProduct("combined")}
      introHrefFor={(deckType) => `/present/combined/introduction?deck=${deckType}`}
      startAction={startCombinedAssessment}
      backHref="/present"
      backLabel="All products"
    />
  );
}
