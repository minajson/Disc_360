"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";

export interface SettingsState {
  status: "idle" | "success" | "error";
  message: string;
}

const profileSchema = z.object({
  full_name: z.string().min(2).max(120),
  preferred_name: z.string().min(1).max(60),
  profession: z.string().max(120).optional().or(z.literal("")),
  country: z.string().min(2).max(80),
  timezone: z.string().min(2).max(80),
});

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    preferred_name: formData.get("preferred_name"),
    profession: formData.get("profession"),
    country: formData.get("country"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Please check the fields.",
    };
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      preferred_name: parsed.data.preferred_name,
      profession: parsed.data.profession || null,
      country: parsed.data.country,
      timezone: parsed.data.timezone,
    })
    .eq("id", user.id);

  if (error) return { status: "error", message: "Could not save your profile." };
  revalidatePath("/app", "layout");
  return { status: "success", message: "Profile saved." };
}

const prefsSchema = z.object({
  assessment_reminders: z.string().optional(),
  team_updates: z.string().optional(),
  report_notifications: z.string().optional(),
  product_updates: z.string().optional(),
});

export async function updateNotificationPreferences(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const parsed = prefsSchema.safeParse({
    assessment_reminders: formData.get("assessment_reminders") ?? undefined,
    team_updates: formData.get("team_updates") ?? undefined,
    report_notifications: formData.get("report_notifications") ?? undefined,
    product_updates: formData.get("product_updates") ?? undefined,
  });
  if (!parsed.success) return { status: "error", message: "Could not read preferences." };

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("notification_preferences")
    .update({
      assessment_reminders: parsed.data.assessment_reminders === "on",
      team_updates: parsed.data.team_updates === "on",
      report_notifications: parsed.data.report_notifications === "on",
      product_updates: parsed.data.product_updates === "on",
    })
    .eq("profile_id", user.id);
  if (error) return { status: "error", message: "Could not save preferences." };
  return { status: "success", message: "Notification preferences saved." };
}

/** Records a deletion request; fulfillment is a manual, audited process. */
export async function requestAccountDeletion(): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase
    .from("profiles")
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq("id", user.id);
  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "account.deletion_requested",
    entity_type: "profile",
    entity_id: user.id,
  });
  revalidatePath("/app/settings");
}

export async function cancelAccountDeletion(): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase
    .from("profiles")
    .update({ deletion_requested_at: null })
    .eq("id", user.id);
  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "account.deletion_cancelled",
    entity_type: "profile",
    entity_id: user.id,
  });
  revalidatePath("/app/settings");
}

/** Essential security notice after a password change. */
export async function notifyPasswordChanged(): Promise<void> {
  const { user, profile } = await requireUser();
  const { sendPasswordChanged } = await import("@/lib/email/notifications");
  await sendPasswordChanged(profile.email, user.id);
}
