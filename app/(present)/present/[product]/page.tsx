import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, isProductId } from "@/lib/presentations/registry";
import { ProductStartScreen } from "@/components/presentations/ProductStartScreen";

interface PageProps {
  params: Promise<{ product: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { product } = await params;
  if (!isProductId(product)) return { title: "Presentation" };
  return { title: getProduct(product).name };
}

/** Product start screen: presentation vs straight-to-assessment. */
export default async function ProductStartPage({ params }: PageProps) {
  const { product } = await params;
  if (!isProductId(product)) notFound();
  const meta = getProduct(product);

  return (
    <ProductStartScreen
      product={meta}
      // Standalone flow: presentation choices open the deck's own intro route.
      introHrefFor={(deckType) => `/present/${product}/introduction?deck=${deckType}`}
    />
  );
}
