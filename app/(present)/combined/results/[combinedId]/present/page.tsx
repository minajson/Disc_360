import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { loadCombinedResult } from "@/lib/insights/combined-loader";
import { CombinedResultView } from "@/components/combined/CombinedResultView";
import { ResultPresentationShell } from "@/components/presentations/ResultPresentationShell";

export const metadata: Metadata = { title: "Present combined result" };

interface PageProps {
  params: Promise<{ combinedId: string }>;
}

export default async function CombinedResultPresentPage({ params }: PageProps) {
  const { combinedId } = await params;
  const { supabase, user } = await requireOnboarded();

  const assembled = await loadCombinedResult(supabase, combinedId, user.id);
  if (!assembled) notFound();

  return (
    <ResultPresentationShell exitHref={`/combined/results/${combinedId}`}>
      <CombinedResultView disc={assembled.disc} focus={assembled.focus} insights={assembled.insights} presentation />
    </ResultPresentationShell>
  );
}
