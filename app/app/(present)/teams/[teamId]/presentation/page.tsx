import type { Metadata } from "next";
import { getTeamIntelligence } from "@/lib/insights/team";
import { requireOnboarded } from "@/lib/auth/guards";
import { mediaUrl } from "@/lib/utils/media";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import {
  buildJoinUrl,
  buildTeamResultsUrl,
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

  // Facilitator identity: the presenting admin's coach profile (optional).
  const { user, profile } = await requireOnboarded();
  const { data: coach } = await admin
    .from("coach_profiles")
    .select("title, organization, photo_path, logo_path, show_in_presentation")
    .eq("profile_id", user.id)
    .maybeSingle();
  const facilitator =
    coach && coach.show_in_presentation
      ? {
          name: profile.full_name,
          title: coach.title,
          organization: coach.organization,
          photoUrl: mediaUrl(coach.photo_path),
          logoUrl: mediaUrl(coach.logo_path),
        }
      : null;

  const base = getPublicBaseUrl();
  return (
    <PresentationDeck
      data={data}
      resultsUrl={buildTeamResultsUrl(base, teamId)}
      joinUrl={buildJoinUrl(base, team?.invite_token ?? "")}
      joinDisplayUrl={displayJoinUrl(base, team?.invite_token ?? "")}
      teamCode={team?.team_code ?? ""}
      isLocalBase={base.isLocal}
      facilitator={facilitator}
    />
  );
}
