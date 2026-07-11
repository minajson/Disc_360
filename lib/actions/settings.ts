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
