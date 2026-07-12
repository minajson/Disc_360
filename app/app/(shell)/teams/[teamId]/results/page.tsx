import type { Metadata } from "next";
import { getTeamIntelligence } from "@/lib/insights/team";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { mediaUrl } from "@/lib/utils/media";
import { TeamIntelligenceView } from "@/components/teams/TeamIntelligenceView";

export const metadata: Metadata = { title: "Team intelligence" };

export default async function TeamResultsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const data = await getTeamIntelligence(teamId);

  if ("error" in data) {
    return (
      <div className="paper-card p-8 text-sm leading-relaxed text-slate">
        {data.error}
      </div>
    );
  }

  // Optional facilitator credit: the team creator's coach profile.
  const admin = createSupabaseAdminClient();
  const { data: team } = await admin
    .from("teams")
    .select("created_by")
    .eq("id", teamId)
    .single();
  const { data: coach } = team
    ? await admin
        .from("coach_profiles")
        .select("title, organization, photo_path, show_in_presentation, profiles (full_name)")
        .eq("profile_id", team.created_by)
        .maybeSingle()
    : { data: null };
  const coachName = Array.isArray(coach?.profiles)
    ? coach?.profiles[0]?.full_name
    : coach?.profiles?.full_name;
  const facilitatorPhoto = mediaUrl(coach?.photo_path);

  return (
    <>
      <TeamIntelligenceView data={data} />
      {coach?.show_in_presentation && coachName ? (
        <footer className="flex items-center gap-3 rule-t pt-6">
          {facilitatorPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- storage-hosted
            <img src={facilitatorPhoto} alt="" className="size-10 rounded-full object-cover" />
          ) : null}
          <p className="text-sm text-slate">
            Facilitated by <span className="font-medium text-ink">{coachName}</span>
            {coach.title ? ` · ${coach.title}` : ""}
            {coach.organization ? ` · ${coach.organization}` : ""}
          </p>
        </footer>
      ) : null}
    </>
  );
}
