import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTeamAdmin } from "@/lib/auth/guards";
import {
  TeamDangerZone,
  TeamSettingsForm,
} from "@/components/teams/TeamSettingsForm";
import { InviteParticipantsPanel } from "@/components/teams/InviteParticipantsPanel";
import { SessionSetupCard } from "@/components/teams/SessionSetupCard";
import type {
  AssessmentProduct,
  PresentationAccess,
  SessionMode,
  SessionState,
} from "@/lib/teams/session";
import { buildJoinUrl, getPublicBaseUrl } from "@/lib/utils/site-url";

export const metadata: Metadata = { title: "Team settings" };

export default async function TeamSettingsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { supabase } = await requireTeamAdmin(teamId);

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, description, department, timezone, logo_url, cover_path, results_named, members_can_view_summary, deadline_at, team_code, invite_token, assessment_type, session_mode, session_state, presentation_access")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) notFound();

  const base = getPublicBaseUrl();

  return (
    <>
      <SessionSetupCard
        teamId={teamId}
        current={{
          assessment_type: team.assessment_type as AssessmentProduct,
          session_mode: team.session_mode as SessionMode,
          session_state: team.session_state as SessionState,
          presentation_access: team.presentation_access as PresentationAccess,
        }}
      />
      <TeamSettingsForm team={team} />
      <InviteParticipantsPanel
        teamName={team.name}
        teamCode={team.team_code}
        joinUrl={buildJoinUrl(base, team.invite_token)}
        isLocal={base.isLocal}
        compact
      />
      <TeamDangerZone teamId={teamId} />
    </>
  );
}
