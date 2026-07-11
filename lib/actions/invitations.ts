"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";

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
 * Join via the short human team code (e.g. ATLAS-1002).
 * Service role justified as above — the code is the authorization.
 */
export async function acceptTeamCode(code: string): Promise<AcceptResult> {
  const normalized = code.trim().toUpperCase();
  if (normalized.length < 4 || normalized.length > 24) {
    return { ok: false, error: "That doesn't look like a team code." };
  }
  const admin = createSupabaseAdminClient();
  const { data: team } = await admin
    .from("teams")
    .select("invite_token")
    .eq("team_code", normalized)
    .maybeSingle();
  if (!team) {
    return { ok: false, error: "That team code doesn't match an active team." };
  }
  return acceptTeamLink(team.invite_token);
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
