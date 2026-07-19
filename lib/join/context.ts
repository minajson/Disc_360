import "server-only";
import { z } from "zod";
import { createSupabaseAnonClient } from "@/lib/db/anon";
import { logRouteDiagnostic } from "@/lib/observability/diagnostics";

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

/** State → participant-facing message. Each failure mode reads differently. */
export const JOIN_STATE_MESSAGES: Record<string, string> = {
  revoked: "This invitation was revoked by the team administrator.",
  expired: "This invitation has expired — ask your administrator to resend it.",
  team_inactive: "This team is no longer active.",
  join_disabled: "Joining is currently disabled for this team.",
  service_failure:
    "We couldn't check this invitation just now. Please try again in a moment.",
};

/**
 * Resolves a join token (team invite link OR personal invitation) into the
 * public-safe context for the join page — via the resolve_join_token
 * SECURITY DEFINER RPC on the ANON client. The token is the authorization;
 * the RPC validates existence, expiry, revocation and team status inside the
 * database and exposes nothing member- or result-related. No service-role
 * dependency: a misconfigured admin key can no longer break public joining.
 */
export async function getJoinContext(token: string): Promise<JoinContext | null> {
  if (!z.uuid().safeParse(token).success) return null;
  const anon = createSupabaseAnonClient();

  const { data, error } = await anon.rpc("resolve_join_token", { p_token: token });
  if (error) {
    // Temporary data-service failure — distinguish it from a bad link.
    logRouteDiagnostic({
      route: "/join/[token]",
      step: "resolve_join_token-rpc",
      code: error.code,
      message: error.message,
    });
    return blockedContext(JOIN_STATE_MESSAGES.service_failure!);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.state === "not_found") return null;
  if (row.state !== "ok") {
    return blockedContext(
      JOIN_STATE_MESSAGES[row.state] ?? JOIN_STATE_MESSAGES.service_failure!,
    );
  }

  return {
    teamId: row.team_id!,
    teamName: row.team_name!,
    organizationName: row.organization_name,
    sessionName: row.session_name,
    clientOrganization: row.client_organization,
    coverPath: row.cover_path,
    deadlineAt: row.deadline_at,
    presenterName: row.presenter_name,
    presenterTitle: row.presenter_title,
    invitedEmail: row.invited_email,
    blocked: null,
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
