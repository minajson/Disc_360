import type { Metadata } from "next";
import { getFocusTeamSummary } from "@/lib/insights/focus-team";
import { FocusTeamSummaryView } from "@/components/focus/FocusTeamSummaryView";
import { ResultPresentationShell } from "@/components/presentations/ResultPresentationShell";

export const metadata: Metadata = { title: "Present Focus summary" };

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default async function TeamFocusPresentPage({ params }: PageProps) {
  const { teamId } = await params;
  const summary = await getFocusTeamSummary(teamId);
  if ("error" in summary) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <p className="paper-card max-w-md p-8 text-sm text-slate">{summary.error}</p>
      </div>
    );
  }

  return (
    <ResultPresentationShell exitHref={`/app/teams/${teamId}/focus`}>
      <FocusTeamSummaryView summary={summary} presentation />
    </ResultPresentationShell>
  );
}
