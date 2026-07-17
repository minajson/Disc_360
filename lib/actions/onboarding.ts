"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { sendWelcome } from "@/lib/email/notifications";

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

  // Claim a pre-created roster entry by email, otherwise create one.
  const { data: existing } = await admin
    .from("team_members")
    .select("id, profile_id")
    .eq("team_id", team.id)
    .eq("email", profile.email)
    .maybeSingle();

  if (existing?.profile_id && existing.profile_id !== user.id) {
    return { status: "error", message: "This roster entry belongs to another account." };
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
      role: "member",
    });
  }

  redirect("/app");
}
