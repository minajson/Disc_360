import type { Metadata } from "next";
import { requireOnboarded } from "@/lib/auth/guards";
import { Eyebrow } from "@/components/ui/Eyebrow";
import {
  CoachProfileForm,
  type CoachProfileValues,
} from "@/components/coach/CoachProfileForm";

export const metadata: Metadata = { title: "Coach profile" };

export default async function CoachProfilePage() {
  const { supabase, user, profile } = await requireOnboarded();

  const { data: coach } = await supabase
    .from("coach_profiles")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle();

  const values: CoachProfileValues = {
    full_name: profile.full_name,
    email: profile.email,
    title: coach?.title ?? null,
    organization: coach?.organization ?? null,
    phone: coach?.phone ?? null,
    location: coach?.location ?? null,
    bio: coach?.bio ?? "",
    credentials: coach?.credentials ?? [],
    expertise: coach?.expertise ?? [],
    specialties: coach?.specialties ?? [],
    years_experience: coach?.years_experience ?? null,
    website: coach?.website ?? null,
    linkedin: coach?.linkedin ?? null,
    photo_path: coach?.photo_path ?? null,
    banner_path: coach?.banner_path ?? null,
    logo_path: coach?.logo_path ?? null,
    show_in_presentation: coach?.show_in_presentation ?? true,
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Coach profile</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">
          {coach ? "Edit your coach profile" : "Set up your coach profile"}
        </h1>
        <p className="max-w-xl text-sm text-slate">
          This identity appears on team join pages, presentations and reports
          when facilitator information is enabled.
        </p>
      </div>
      <CoachProfileForm profile={values} />
    </div>
  );
}
