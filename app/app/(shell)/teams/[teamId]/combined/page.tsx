import type { Metadata } from "next";
import Link from "next/link";
import { getCombinedTeamSummary } from "@/lib/insights/combined-team";
import { CombinedTeamSummaryView } from "@/components/combined/CombinedTeamSummaryView";

export const metadata: Metadata = { title: "Team combined summary" };

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default async function TeamCombinedSummaryPage({ params }: PageProps) {
  const { teamId } = await params;
  const summary = await getCombinedTeamSummary(teamId);

  if ("error" in summary) {
    return (
      <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        <p className="paper-card p-8 text-sm text-slate">{summary.error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <CombinedTeamSummaryView summary={summary} />
      <div className="flex flex-wrap gap-3 border-t border-hairline pt-6">
        <Link
          href={`/app/teams/${teamId}/dashboard`}
          className="inline-flex min-h-11 items-center rounded-full border border-hairline-strong px-6 text-sm font-medium text-ink transition-colors hover:border-botanical hover:text-botanical"
        >
          ← Team dashboard
        </Link>
        <Link
          href={`/app/teams/${teamId}/present/combined`}
          className="inline-flex min-h-11 items-center rounded-full bg-botanical px-6 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
        >
          Present this summary
        </Link>
      </div>
    </div>
  );
}
