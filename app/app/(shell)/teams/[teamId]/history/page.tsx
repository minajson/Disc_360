import type { Metadata } from "next";
import { getTeamHistory } from "@/lib/history/team";
import { TeamHistoryView } from "@/components/teams/TeamHistoryView";

export const metadata: Metadata = { title: "Team history" };

/**
 * Facilitator scope. getTeamHistory authorizes against this team, then
 * resolves periods from an explicit lineage — never from a matching name.
 */
export default async function TeamHistoryPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const history = await getTeamHistory(teamId);

  if ("error" in history) {
    return (
      <div className="paper-card p-8 text-sm leading-relaxed text-slate">
        {history.error}
      </div>
    );
  }

  return <TeamHistoryView history={history} />;
}
