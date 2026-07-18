import type { Metadata } from "next";
import { getCombinedTeamSummary } from "@/lib/insights/combined-team";
import { CombinedTeamSummaryView } from "@/components/combined/CombinedTeamSummaryView";
import { ResultPresentationShell } from "@/components/presentations/ResultPresentationShell";

export const metadata: Metadata = { title: "Present combined summary" };

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default async function TeamCombinedPresentPage({ params }: PageProps) {
  const { teamId } = await params;
  const summary = await getCombinedTeamSummary(teamId);
  if ("error" in summary) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <p className="paper-card max-w-md p-8 text-sm text-slate">{summary.error}</p>
      </div>
    );
  }

  return (
    <ResultPresentationShell exitHref={`/app/teams/${teamId}/combined`}>
      <CombinedTeamSummaryView summary={summary} presentation />
    </ResultPresentationShell>
  );
}
