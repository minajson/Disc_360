import "server-only";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/db/admin";

export interface JoinContext {
  teamId: string;
  teamName: string;
  organizationName: string | null;
  sessionName: string | null;
  clientOrganization: string | null;
  coverPath: string | null;
  deadlineAt: string | null;
  presenterName: string | null;
  presenterTitle: string | null;
  /** Prefilled when the token was a personal email invitation. */
  invitedEmail: string | null;
  blocked: string | null;
}

/**
 * Resolves a join token (team invite link OR personal invitation) into the
 * public-safe context for the join page. Service role justified: the token
 * is the authorization; nothing member- or result-related is returned.
 */
export async function getJoinContext(token: string): Promise<JoinContext | null> {
  if (!z.uuid().safeParse(token).success) return null;
  const admin = createSupabaseAdminClient();

  let invitedEmail: string | null = null;

  let { data: team } = await admin
    .from("teams")
    .select(
      "id, name, session_name, client_organization, cover_path, deadline_at, join_enabled, archived_at, created_by, organizations (name)",
    )
    .eq("invite_token", token)
    .maybeSingle();

  if (!team) {
    const { data: invitation } = await admin
      .from("invitations")
      .select("email, status, expires_at, teams (id, name, session_name, client_organization, cover_path, deadline_at, join_enabled, archived_at, created_by, organizations (name))")
      .eq("token", token)
      .maybeSingle();
    if (!invitation) return null;
    if (invitation.status === "revoked") {
      return blockedContext("This invitation was revoked by the team administrator.");
    }
    if (invitation.status === "pending" && new Date(invitation.expires_at) < new Date()) {
      return blockedContext("This invitation has expired — ask your administrator to resend it.");
    }
    invitedEmail = invitation.email;
    team = Array.isArray(invitation.teams) ? invitation.teams[0] : invitation.teams;
    if (!team) return null;
  }

  const organization = Array.isArray(team.organizations)
    ? team.organizations[0]
    : team.organizations;

  let blocked: string | null = null;
  if (team.archived_at) blocked = "This team is no longer active.";
  else if (!team.join_enabled) blocked = "Joining is currently disabled for this team.";

  // Presenter identity (team creator's coach profile, when present).
  const [{ data: creatorProfile }, { data: coachProfile }] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", team.created_by).maybeSingle(),
    admin
      .from("coach_profiles")
      .select("title")
      .eq("profile_id", team.created_by)
      .maybeSingle(),
  ]);

  return {
    teamId: team.id,
    teamName: team.name,
    organizationName: organization?.name ?? null,
    sessionName: team.session_name,
    clientOrganization: team.client_organization,
    coverPath: team.cover_path,
    deadlineAt: team.deadline_at,
    presenterName: creatorProfile?.full_name ?? null,
    presenterTitle: coachProfile?.title ?? null,
    invitedEmail,
    blocked,
  };
}

function blockedContext(message: string): JoinContext {
  return {
    teamId: "",
    teamName: "",
    organizationName: null,
    sessionName: null,
    clientOrganization: null,
    coverPath: null,
    deadlineAt: null,
    presenterName: null,
    presenterTitle: null,
    invitedEmail: null,
    blocked: message,
  };
}
