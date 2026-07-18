import type { Metadata } from "next";
import { getProduct } from "@/lib/presentations/registry";
import { startAssessment } from "@/lib/actions/assessment";
import { ProductStartScreen } from "@/components/presentations/ProductStartScreen";

export const metadata: Metadata = {
  title: "DISC Behaviour Assessment",
  description:
    "Understand how you lead, communicate and respond — four behavioural preferences, no rigid boxes.",
};

/** Public product page for the DISC assessment. */
export default function DiscProductPage() {
  return (
    <ProductStartScreen
      product={getProduct("disc")}
      introHrefFor={(deckType) => `/present/disc/introduction?deck=${deckType}`}
      startAction={startAssessment}
      backHref="/present"
      backLabel="All products"
    />
  );
}
