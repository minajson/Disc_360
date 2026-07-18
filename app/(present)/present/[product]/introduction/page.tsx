import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { startAssessment } from "@/lib/actions/assessment";
import {
  getDeck,
  getProduct,
  isDeckType,
  isProductId,
} from "@/lib/presentations/registry";
import { PresentationPlayer } from "@/components/presentations/PresentationPlayer";

export const metadata: Metadata = { title: "Introduction" };

interface PageProps {
  params: Promise<{ product: string }>;
  searchParams: Promise<{ deck?: string }>;
}

const START_LABEL: Record<string, string> = {
  disc: "Start DISC assessment",
  focus: "Start Focus Pulse",
  combined: "Start combined assessment",
};

/**
 * Plays a product's introduction deck. `?deck=` overrides which deck is shown
 * (the Combined start screen uses it to present a single lens) while the
 * assessment CTA still starts the product's assessment.
 */
export default async function IntroductionPage({ params, searchParams }: PageProps) {
  const { product } = await params;
  const { deck: deckParam } = await searchParams;
  if (!isProductId(product)) notFound();

  const meta = getProduct(product);
  const deckType = deckParam && isDeckType(deckParam) ? deckParam : meta.primaryDeck;
  const deck = getDeck(deckType);

  return (
    <PresentationPlayer
      deck={deck}
      startLabel={START_LABEL[product] ?? "Start assessment"}
      startAction={startAssessment}
      exitHref={`/present/${product}`}
      assessmentLive={meta.assessmentLive}
    />
  );
}
