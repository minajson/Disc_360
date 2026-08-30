"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { sendWelcome } from "@/lib/email/notifications";
import { invitedJoinDestination } from "@/lib/join/destination";

export interface OnboardingState {
  status: "idle" | "error";
  message: string;
}

const profileBaseSchema = z.object({
  full_name: z.string().min(2).max(120),
  preferred_name: z.string().min(1).max(60),
  profession: z.string().max(120).optional().or(z.literal("")),
  country: z.string().min(2).max(80),
  timezone: z.string().min(2).max(80),
  consent: z.literal("on", {
    error: "Consent to data processing is required to use DISC360.",
  }),
  product_updates: z.string().optional(),
});

async function completeProfile(
  formData: FormData,
  intent: string,
): Promise<{ error?: string; userId?: string }> {
  const parsed = profileBaseSchema.safeParse({
    full_name: formData.get("full_name"),
    preferred_name: formData.get("preferred_name"),
    profession: formData.get("profession"),
    country: formData.get("country"),
    timezone: formData.get("timezone"),
    consent: formData.get("consent"),
    product_updates: formData.get("product_updates") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please complete the required fields." };
  }

  const { supabase, user } = await requireUser();
  const now = new Date().toISOString();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      preferred_name: parsed.data.preferred_name,
      profession: parsed.data.profession || null,
      country: parsed.data.country,
      timezone: parsed.data.timezone,
      onboarding_intent: intent,
      consented_at: now,
      onboarded_at: now,
      communications_opt_in: parsed.data.product_updates === "on",
    })
    .eq("id", user.id);
  if (profileError) return { error: "Could not save your profile — please try again." };

  await supabase
    .from("notification_preferences")
    .update({ product_updates: parsed.data.product_updates === "on" })
    .eq("profile_id", user.id);

  await sendWelcome(user.email ?? "", user.id, parsed.data.preferred_name);

  return { userId: user.id };
}

/** Individual: profile + consent, straight to the app. */
export async function completeIndividualOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const result = await completeProfile(formData, "understand_myself");
  if (result.error) return { status: "error", message: result.error };
  redirect("/app");
}

/** Coach: profile + consent; client workspaces are created inside the app. */
export async function completeCoachOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const result = await completeProfile(formData, "manage_clients");
  if (result.error) return { status: "error", message: result.error };
  redirect("/app/coach/profile");
}

/**
 * Team creator / organization setup: profile and consent only.
 *
 * This action used to collect and insert the organization and first team from
 * onboarding. That produced the two defects this flow is built to avoid:
 *
 *  - It asked for organization name, team name, department, size, visibility
 *    and deadline, then discarded every value at the entitlement gate and made
 *    the user retype them into /app/teams/new.
 *  - It always inserted a new organization, so a second team created this way
 *    produced a duplicate org — unlike `createTeam`, which reuses a matching
 *    one.
 *
 * Team details now belong to exactly one place: the wizard at /app/teams/new.
 * This step only establishes who the person is, then routes them to the plan
 * (if they need it) or straight to the wizard.
 */
export async function completeTeamCreatorOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const intent =
    formData.get("intent_variant") === "organization"
      ? "setup_organization"
      : "create_team";

  const profileResult = await completeProfile(formData, intent);
  if (profileResult.error) return { status: "error", message: profileResult.error };

  const context = await requireUser();

  // Team creation is the paid ($8) action; the gate lives on the server, and
  // is repeated in `createTeam` and on the wizard page. The profile is already
  // saved, so the user arrives at pricing fully onboarded and returns to the
  // wizard afterwards.
  const { getTeamEntitlement } = await import("@/lib/payments/entitlements");
  const entitlement = await getTeamEntitlement(context);
  if (!entitlement.allowed) redirect("/pricing?intent=create-team");

  redirect("/app/teams/new");
}

/** Claim a pre-created roster entry by email, otherwise create one. */
async function attachMembership(
  teamId: string,
  userId: string,
  email: string,
  fullName: string,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("team_members")
    .select("id, profile_id")
    .eq("team_id", teamId)
    .eq("email", email)
    .maybeSingle();
  if (existing?.profile_id && existing.profile_id !== userId) {
    return "This roster entry belongs to another account.";
  }
  if (existing) {
    await admin
      .from("team_members")
      .update({ profile_id: userId, display_name: fullName })
      .eq("id", existing.id);
  } else {
    await admin.from("team_members").insert({
      team_id: teamId,
      profile_id: userId,
      display_name: fullName,
      email,
      role: "member",
    });
  }
  const now = new Date().toISOString();
  await admin
    .from("invitations")
    .update({ status: "accepted", accepted_by: userId, accepted_at: now })
    .eq("team_id", teamId)
    .eq("email", email)
    .eq("status", "pending");
  return null;
}

/**
 * The token an invited participant carries through onboarding.
 *
 * NOT `z.uuid()` any more. A wellbeing campaign's `join_token` is 43
 * base64url characters (see lib/wellbeing/campaigns.ts), so a UUID schema
 * rejected every wellbeing participant who signed up through a campaign link
 * with "this invitation is no longer valid" — a dead end at the exact moment
 * they had already given their name.
 *
 * The shape accepted here is the union of both credentials: DISC's UUID team
 * invite token and a wellbeing campaign token. WHICH of the two it is is not
 * decided by this pattern — it is decided by which resolver finds it, below.
 */
const invitedSchema = z.object({
  join_token: z.string().regex(/^[A-Za-z0-9_-]{24,64}$/),
});

/**
 * Onboarding for a participant who arrived through a validated invitation
 * token (QR / join link → sign-up or Google OAuth). The team is already
 * resolved — no team code is asked for, ever. Membership lands on exactly
 * the invited team and the participant continues to that team's session.
 */
export async function completeInvitedOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsedToken = invitedSchema.safeParse({ join_token: formData.get("join_token") });
  if (!parsedToken.success) {
    return { status: "error", message: "This invitation is no longer valid — ask for a fresh link." };
  }

  const token = parsedToken.data.join_token;

  /*
   * ─────────────────────────────────────────────────────────────────────
   * WELLBEING FIRST, AND WITHOUT FALLING BACK INTO DISC.
   *
   * A token is resolved as a CAMPAIGN token first. If that succeeds the
   * participant is a wellbeing participant and the DISC resolver is never
   * consulted — the two credential spaces are disjoint, and trying the other
   * one after a wellbeing campaign refuses (closed, expired, full) would land
   * somebody in the DISC assessment on the strength of a wellbeing link.
   *
   * Only a token that is not a campaign token at all is offered to DISC's
   * `resolve_join_token`, which is what keeps DISC invitations working exactly
   * as they did.
   * ─────────────────────────────────────────────────────────────────────
   */
  const { resolveCampaignByToken, loadAuthorisedCampaignByToken, joinCampaignRoster, campaignJoinPath, campaignStateMessage } =
    await import("@/lib/wellbeing/campaigns");
  const { campaign, blocked } = await resolveCampaignByToken(token);

  if (campaign) {
    if (blocked) {
      return {
        status: "error",
        message: campaignStateMessage(blocked)!,
      };
    }

    const profileResult = await completeProfile(formData, "join_team");
    if (profileResult.error) return { status: "error", message: profileResult.error };

    const { user, profile } = await requireUser();
    const authorised = await loadAuthorisedCampaignByToken(token);
    if (authorised) {
      const roster = await joinCampaignRoster(authorised, user, {
        email: profile.email,
        full_name: profile.full_name,
      });
      if (!roster.ok) return { status: "error", message: roster.error! };
    }

    // Back to the campaign's own invitation, never to /app. That page is
    // where the token grants membership and where readiness is checked.
    redirect(campaignJoinPath(token));
  }

  const { getJoinContext } = await import("@/lib/join/context");
  const context = await getJoinContext(token);
  if (!context || context.blocked || !context.teamId) {
    return {
      status: "error",
      message: context?.blocked ?? "This invitation is no longer valid — ask for a fresh link.",
    };
  }

  const profileResult = await completeProfile(formData, "join_team");
  if (profileResult.error) return { status: "error", message: profileResult.error };

  const { user, profile } = await requireUser();
  if (context.invitedEmail && context.invitedEmail.toLowerCase() !== profile.email.toLowerCase()) {
    return {
      status: "error",
      message: `This invitation was sent to ${context.invitedEmail} — sign in with that address.`,
    };
  }

  const attachError = await attachMembership(
    context.teamId,
    user.id,
    profile.email,
    profile.full_name,
  );
  if (attachError) return { status: "error", message: attachError };

  // The invitation decides the product, not this function and not the URL.
  redirect(invitedJoinDestination(context.assessmentType, token));
}

const joinSchema = z.object({
  team_code: z
    .string()
    .min(4, "Enter the team code you were given, e.g. ATLAS-1002")
    .max(24)
    .transform((value) => value.trim().toUpperCase()),
});

/** Join by short team code. Invitation links use /join/[token]. */
export async function completeJoinOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsedJoin = joinSchema.safeParse({ team_code: formData.get("team_code") });
  if (!parsedJoin.success) {
    return { status: "error", message: parsedJoin.error.issues[0]?.message ?? "Invalid team code." };
  }

  const profileResult = await completeProfile(formData, "join_team");
  if (profileResult.error) return { status: "error", message: profileResult.error };

  const { user, profile } = await requireUser();

  // Service role: the joining user has no RLS visibility of the team yet —
  // membership is created here after validating the code server-side.
  const admin = createSupabaseAdminClient();
  const { data: team } = await admin
    .from("teams")
    .select("id, name, archived_at")
    .eq("team_code", parsedJoin.data.team_code)
    .maybeSingle();

  if (!team || team.archived_at) {
    return {
      status: "error",
      message: "That team code doesn't match an active team — check it with your administrator.",
    };
  }

  const attachError = await attachMembership(team.id, user.id, profile.email, profile.full_name);
  if (attachError) return { status: "error", message: attachError };

  redirect("/app");
}
