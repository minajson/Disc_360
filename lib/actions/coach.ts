"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboarded } from "@/lib/auth/guards";

export interface CoachActionState {
  status: "idle" | "success" | "error";
  message: string;
}

const listField = z
  .string()
  .max(2000)
  .optional()
  .or(z.literal(""))
  .transform((value) =>
    (value ?? "")
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20),
  );

const coachProfileSchema = z.object({
  full_name: z.string().min(2).max(120),
  title: z.string().max(120).optional().or(z.literal("")),
  organization: z.string().max(120).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  location: z.string().max(120).optional().or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
  credentials: listField,
  expertise: listField,
  specialties: listField,
  years_experience: z.coerce.number().int().min(0).max(80).optional(),
  website: z.url().optional().or(z.literal("")),
  linkedin: z.url().optional().or(z.literal("")),
  photo_path: z.string().max(300).optional().or(z.literal("")),
  banner_path: z.string().max(300).optional().or(z.literal("")),
  logo_path: z.string().max(300).optional().or(z.literal("")),
  show_in_presentation: z.string().optional(),
});

export async function saveCoachProfile(
  _prev: CoachActionState,
  formData: FormData,
): Promise<CoachActionState> {
  const parsed = coachProfileSchema.safeParse({
    full_name: formData.get("full_name"),
    title: formData.get("title"),
    organization: formData.get("organization"),
    phone: formData.get("phone"),
    location: formData.get("location"),
    bio: formData.get("bio"),
    credentials: formData.get("credentials"),
    expertise: formData.get("expertise"),
    specialties: formData.get("specialties"),
    years_experience: formData.get("years_experience") || undefined,
    website: formData.get("website"),
    linkedin: formData.get("linkedin"),
    photo_path: formData.get("photo_path"),
    banner_path: formData.get("banner_path"),
    logo_path: formData.get("logo_path"),
    show_in_presentation: formData.get("show_in_presentation") ?? undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the highlighted fields.",
    };
  }

  const { supabase, user } = await requireOnboarded();

  const { error: nameError } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name })
    .eq("id", user.id);
  if (nameError) return { status: "error", message: "Could not save your name." };

  const { error } = await supabase.from("coach_profiles").upsert(
    {
      profile_id: user.id,
      title: parsed.data.title || null,
      organization: parsed.data.organization || null,
      phone: parsed.data.phone || null,
      location: parsed.data.location || null,
      bio: parsed.data.bio || "",
      credentials: parsed.data.credentials,
      expertise: parsed.data.expertise,
      specialties: parsed.data.specialties,
      years_experience: parsed.data.years_experience ?? null,
      website: parsed.data.website || null,
      linkedin: parsed.data.linkedin || null,
      photo_path: parsed.data.photo_path || null,
      banner_path: parsed.data.banner_path || null,
      logo_path: parsed.data.logo_path || null,
      show_in_presentation: parsed.data.show_in_presentation === "on",
    },
    { onConflict: "profile_id" },
  );
  if (error) return { status: "error", message: "Could not save your coach profile." };

  revalidatePath("/app/coach", "layout");
  return { status: "success", message: "Coach profile saved." };
}
