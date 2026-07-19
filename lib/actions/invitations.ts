"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { createSupabaseAnonClient } from "@/lib/db/anon";
import { logRouteDiagnostic } from "@/lib/observability/diagnostics";

export interface AcceptResult {
  ok: boolean;
  teamId?: string;
  teamName?: string;
  error?: string;
}

/**
 * Accept a personal email invitation by token.
 * Service role justified: the invitee has no RLS visibility of the
 * invitation or team before membership exists; the token IS the authorization.
 */
export async function acceptInvitationToken(token: string): Promise<AcceptResult> {
  if (!z.uuid().safeParse(token).success) {
    return { ok: false, error: "This invitation link is not valid." };
  }
  const { user, profile } = await requireUser();
  const admin = createSupabaseAdminClient();

  const { data: invitation } = await admin
    .from("invitations")
    .select("id, team_id, email, status, expires_at, team_member_id, teams (id, name, archived_at)")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) return { ok: false, error: "This invitation link is not valid." };
  const team = Array.isArray(invitation.teams) ? invitation.teams[0] : invitation.teams;
  if (!team || team.archived_at) {
    return { ok: false, error: "This team is no longer active." };
  }
  if (invitation.status === "revoked") {
    return { ok: false, error: "This invitation was revoked by the team administrator." };
  }
  if (invitation.status === "accepted") {
    // Idempotent for the same person.
    return { ok: true, teamId: team.id, teamName: team.name };
  }
  if (new Date(invitation.expires_at) < new Date()) {
    await admin.from("invitations").update({ status: "expired" }).eq("id", invitation.id);
    return { ok: false, error: "This invitation has expired — ask your administrator to resend it." };
  }

  // Claim the roster entry (or create one). Invitations are personal:
  // the signed-in account keeps its own email; the roster entry updates.
  if (invitation.team_member_id) {
    const { data: entry } = await admin
      .from("team_members")
      .select("id, profile_id")
      .eq("id", invitation.team_member_id)
      .maybeSingle();
    if (entry?.profile_id && entry.profile_id !== user.id) {
      return { ok: false, error: "This invitation was already used by another account." };
    }
    await admin
      .from("team_members")
      .update({ profile_id: user.id, display_name: profile.full_name, email: profile.email })
      .eq("id", invitation.team_member_id);
  } else {
    const { data: existing } = await admin
      .from("team_members")
      .select("id")
      .eq("team_id", team.id)
      .eq("email", profile.email)
      .maybeSingle();
    if (existing) {
      await admin
        .from("team_members")
        .update({ profile_id: user.id, display_name: profile.full_name })
        .eq("id", existing.id);
    } else {
      await admin.from("team_members").insert({
        team_id: team.id,
        profile_id: user.id,
        display_name: profile.full_name,
        email: profile.email,
      });
    }
  }

  await admin
    .from("invitations")
    .update({
      status: "accepted",
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invitation.id);

  return { ok: true, teamId: team.id, teamName: team.name };
}

/**
 * Join via the short human team code (e.g. ATLAS-1002). Resolution runs
 * through the resolve_team_code SECURITY DEFINER RPC on the anon client —
 * the code is the authorization, normalization (trim + case) happens in the
 * database, and every failure mode reads differently to the participant.
 */
export async function acceptTeamCode(code: string): Promise<AcceptResult> {
  const normalized = code.trim().toUpperCase();
  if (normalized.length < 4 || normalized.length > 24) {
    return { ok: false, error: "That doesn't look like a team code." };
  }
  const anon = createSupabaseAnonClient();
  const { data, error } = await anon.rpc("resolve_team_code", { p_code: code });
  if (error) {
    logRouteDiagnostic({
      route: "action:acceptTeamCode",
      step: "resolve_team_code-rpc",
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      error: "We couldn't check that code just now. Please try again in a moment.",
    };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.state === "not_found") {
    return { ok: false, error: "That team code doesn't match an active team." };
  }
  if (row.state === "team_inactive") {
    return { ok: false, error: "That team is no longer active." };
  }
  if (row.state === "join_disabled") {
    return { ok: false, error: "Joining is currently disabled for that team." };
  }
  return acceptTeamLink(row.invite_token!);
}

/**
 * Form-facing wrapper: joins by code and NAVIGATES server-side on success.
 * A server-action redirect is the reliable way to land on the team page —
 * client-side router.push after an action's returned value proved droppable.
 * Failures return normally so the form can show the distinguished message.
 */
export async function joinTeamByCode(code: string): Promise<AcceptResult> {
  const result = await acceptTeamCode(code);
  if (result.ok && result.teamId) {
    redirect(`/app/teams/${result.teamId}`);
  }
  return result;
}

/**
 * Join via the team's reusable invite link token.
 * Service role justified as above — the link token is the authorization.
 */
export async function acceptTeamLink(linkToken: string): Promise<AcceptResult> {
  if (!z.uuid().safeParse(linkToken).success) {
    return { ok: false, error: "This link is not valid." };
  }
  const { user, profile } = await requireUser();
  const admin = createSupabaseAdminClient();

  const { data: team } = await admin
    .from("teams")
    .select("id, name, archived_at")
    .eq("invite_token", linkToken)
    .maybeSingle();
  if (!team || team.archived_at) {
    return { ok: false, error: "This link doesn't match an active team." };
  }

  const { data: existing } = await admin
    .from("team_members")
    .select("id, profile_id")
    .eq("team_id", team.id)
    .eq("email", profile.email)
    .maybeSingle();

  if (existing?.profile_id && existing.profile_id !== user.id) {
    return { ok: false, error: "This roster entry belongs to another account." };
  }
  if (existing) {
    await admin
      .from("team_members")
      .update({ profile_id: user.id, display_name: profile.full_name })
      .eq("id", existing.id);
  } else {
    await admin.from("team_members").insert({
      team_id: team.id,
      profile_id: user.id,
      display_name: profile.full_name,
      email: profile.email,
    });
  }

  return { ok: true, teamId: team.id, teamName: team.name };
}
