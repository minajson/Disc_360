"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";

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
  redirect("/app/teams");
}

const teamCreatorSchema = z.object({
  organization_name: z.string().min(2).max(120),
  industry: z.string().max(120).optional().or(z.literal("")),
  team_name: z.string().min(2).max(120),
  team_description: z.string().max(500).optional().or(z.literal("")),
  department: z.string().max(120).optional().or(z.literal("")),
  approx_size: z.coerce.number().int().min(2).max(500).optional(),
  results_named: z.enum(["named", "anonymized"]),
  deadline_at: z.string().optional().or(z.literal("")),
});

function generateTeamCode(name: string): string {
  const stem = name.replace(/[^a-zA-Z]/g, "").slice(0, 5).toUpperCase() || "TEAM";
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${stem}-${digits}`;
}

/** Team creator / organization setup: profile + organization + first team. */
export async function completeTeamCreatorOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsedTeam = teamCreatorSchema.safeParse({
    organization_name: formData.get("organization_name"),
    industry: formData.get("industry"),
    team_name: formData.get("team_name"),
    team_description: formData.get("team_description"),
    department: formData.get("department"),
    approx_size: formData.get("approx_size") || undefined,
    results_named: formData.get("results_named"),
    deadline_at: formData.get("deadline_at"),
  });
  if (!parsedTeam.success) {
    return {
      status: "error",
      message: parsedTeam.error.issues[0]?.message ?? "Please complete the team details.",
    };
  }

  const intent =
    formData.get("intent_variant") === "organization"
      ? "setup_organization"
      : "create_team";
  const profileResult = await completeProfile(formData, intent);
  if (profileResult.error) return { status: "error", message: profileResult.error };

  const { supabase, user, profile } = await requireUser();

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: parsedTeam.data.organization_name,
      industry: parsedTeam.data.industry || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (orgError || !org) {
    return { status: "error", message: "Could not create the organization — please try again." };
  }

  const { error: memberError } = await supabase.from("organization_members").insert({
    organization_id: org.id,
    profile_id: user.id,
    role: "organization_admin",
  });
  if (memberError) {
    return { status: "error", message: "Could not attach you to the organization." };
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      organization_id: org.id,
      name: parsedTeam.data.team_name,
      description: parsedTeam.data.team_description || "",
      department: parsedTeam.data.department || null,
      approx_size: parsedTeam.data.approx_size ?? null,
      results_named: parsedTeam.data.results_named === "named",
      deadline_at: parsedTeam.data.deadline_at
        ? new Date(parsedTeam.data.deadline_at).toISOString()
        : null,
      team_code: generateTeamCode(parsedTeam.data.team_name),
      created_by: user.id,
      timezone: formData.get("timezone") ? String(formData.get("timezone")) : null,
    })
    .select("id")
    .single();
  if (teamError || !team) {
    return { status: "error", message: "Could not create the team — please try again." };
  }

  await supabase.from("team_members").insert({
    team_id: team.id,
    profile_id: user.id,
    display_name: profile.full_name || parsedTeam.data.organization_name,
    email: profile.email,
    department: parsedTeam.data.department || null,
    role: "team_admin",
  });

  redirect(`/app/teams/${team.id}`);
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
