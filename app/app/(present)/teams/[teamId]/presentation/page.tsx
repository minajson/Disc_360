import type { Metadata } from "next";
import { getTeamIntelligence } from "@/lib/insights/team";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import {
  buildJoinUrl,
  displayJoinUrl,
  getPublicBaseUrl,
} from "@/lib/utils/site-url";
import { PresentationDeck } from "@/components/teams/PresentationDeck";

export const metadata: Metadata = { title: "Presentation" };

export default async function TeamPresentationPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  // Presenter scope: team admins only (enforced inside with presentation: true).
  const data = await getTeamIntelligence(teamId, { presentation: true });

  if ("error" in data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <p className="paper-card max-w-md p-8 text-sm leading-relaxed text-slate">
          {data.error}
        </p>
      </div>
    );
  }

  // Join link details (admin-guarded above; token read via service role).
  const admin = createSupabaseAdminClient();
  const { data: team } = await admin
    .from("teams")
    .select("invite_token, team_code")
    .eq("id", teamId)
    .single();

  const base = getPublicBaseUrl();
  return (
    <PresentationDeck
      data={data}
      resultsUrl={`${base.url}/app/teams/${teamId}/results`}
      joinUrl={buildJoinUrl(base, team?.invite_token ?? "")}
      joinDisplayUrl={displayJoinUrl(base, team?.invite_token ?? "")}
      teamCode={team?.team_code ?? ""}
      isLocalBase={base.isLocal}
    />
  );
}
