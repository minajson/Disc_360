import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { loadCombinedResult } from "@/lib/insights/combined-loader";
import { CombinedResultView } from "@/components/combined/CombinedResultView";

export const metadata: Metadata = { title: "Your combined profile" };

interface PageProps {
  params: Promise<{ combinedId: string }>;
}

export default async function CombinedResultPage({ params }: PageProps) {
  const { combinedId } = await params;
  const { supabase, user } = await requireOnboarded();

  const assembled = await loadCombinedResult(supabase, combinedId, user.id);
  if (!assembled) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <CombinedResultView disc={assembled.disc} focus={assembled.focus} insights={assembled.insights} />
      <div className="flex flex-wrap gap-3 border-t border-hairline pt-6">
        <Link
          href="/app"
          className="inline-flex min-h-11 items-center rounded-full bg-botanical px-6 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
        >
          Back to dashboard
        </Link>
        <Link
          href={`/combined/results/${combinedId}/present`}
          className="inline-flex min-h-11 items-center rounded-full border border-hairline-strong px-6 text-sm font-medium text-ink transition-colors hover:border-botanical hover:text-botanical"
        >
          Present this result
        </Link>
      </div>
    </div>
  );
}
