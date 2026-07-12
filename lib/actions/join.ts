"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { createSupabaseServerClient } from "@/lib/db/server";
import { getJoinContext } from "@/lib/join/context";

export interface JoinState {
  status: "idle" | "error" | "account_exists";
  message: string;
}

const joinSchema = z.object({
  token: z.uuid(),
  full_name: z.string().min(2, "Please enter your full name").max(120),
  email: z.email("Please use a valid email address").transform((v) => v.toLowerCase()),
  job_title: z.string().max(120).optional().or(z.literal("")),
  department: z.string().max(120).optional().or(z.literal("")),
  reference_id: z.string().max(60).optional().or(z.literal("")),
  consent: z.literal("on", {
    error: "Consent to data processing is required to take the assessment.",
  }),
});

/**
 * QR/link participant registration: validates the join token, creates a
 * confirmed account for a NEW email, signs it in via a server-verified
 * magic-link token, attaches the participant to exactly this team, and
 * drops them straight into the assessment runner.
 *
 * Existing emails are never auto-logged-in (account-takeover guard) —
 * those users are sent to sign-in with the join link preserved.
 */
export async function joinAndStart(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const parsed = joinSchema.safeParse({
    token: formData.get("token"),
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    job_title: formData.get("job_title"),
    department: formData.get("department"),
    reference_id: formData.get("reference_id"),
    consent: formData.get("consent"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Please complete the required fields.",
    };
  }
  const input = parsed.data;

  const context = await getJoinContext(input.token);
  if (!context || context.blocked || !context.teamId) {
    return {
      status: "error",
      message: context?.blocked ?? "This join link is not valid.",
    };
  }
  if (context.invitedEmail && context.invitedEmail.toLowerCase() !== input.email) {
    return {
      status: "error",
      message: `This invitation was sent to ${context.invitedEmail} — use that address, or ask for a fresh invitation.`,
    };
  }

  // Service role: account provisioning and roster attachment are
  // server-controlled; the validated token is the authorization.
  const admin = createSupabaseAdminClient();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", input.email)
    .maybeSingle();
  if (existingProfile) {
    return {
      status: "account_exists",
      message: "An account already exists for this email — sign in to join the team.",
    };
  }

  const password = crypto.randomUUID() + crypto.randomUUID();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  });
  if (createError || !created.user) {
    return { status: "error", message: "Could not create your account — please try again." };
  }
  const userId = created.user.id;

  // Establish the browser session by verifying a server-generated
  // magic-link token — no password ever leaves the server.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: input.email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return { status: "error", message: "Could not start your session — please try again." };
  }
  const supabase = await createSupabaseServerClient();
  const { error: otpError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  if (otpError) {
    return { status: "error", message: "Could not start your session — please try again." };
  }

  const now = new Date().toISOString();
  await admin
    .from("profiles")
    .update({
      full_name: input.full_name,
      preferred_name: input.full_name.split(" ")[0] ?? input.full_name,
      profession: input.job_title || null,
      onboarding_intent: "join_team",
      consented_at: now,
      onboarded_at: now,
    })
    .eq("id", userId);

  // Attach to exactly this team: claim a pre-created roster entry by email
  // or insert a new one. unique(team_id, email) prevents duplicates.
  const { data: existingMember } = await admin
    .from("team_members")
    .select("id")
    .eq("team_id", context.teamId)
    .eq("email", input.email)
    .maybeSingle();
  if (existingMember) {
    await admin
      .from("team_members")
      .update({
        profile_id: userId,
        display_name: input.full_name,
        department: input.department || null,
        reference_id: input.reference_id || null,
      })
      .eq("id", existingMember.id);
  } else {
    await admin.from("team_members").insert({
      team_id: context.teamId,
      profile_id: userId,
      display_name: input.full_name,
      email: input.email,
      department: input.department || null,
      reference_id: input.reference_id || null,
    });
  }

  // Mark a matching personal invitation accepted.
  await admin
    .from("invitations")
    .update({ status: "accepted", accepted_by: userId, accepted_at: now })
    .eq("team_id", context.teamId)
    .eq("email", input.email)
    .eq("status", "pending");

  // Straight into the assessment.
  const { data: version } = await admin
    .from("assessment_versions")
    .select("id")
    .eq("is_active", true)
    .single();
  if (!version) return { status: "error", message: "No active assessment is configured." };

  const { data: session, error: sessionError } = await admin
    .from("assessment_sessions")
    .insert({ profile_id: userId, version_id: version.id })
    .select("id")
    .single();
  if (sessionError || !session) {
    return { status: "error", message: "Could not start the assessment — open your dashboard and try again." };
  }

  redirect(`/app/assessments/${session.id}`);
}
