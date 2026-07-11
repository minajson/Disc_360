import type { Metadata } from "next";
import { requireOnboarded } from "@/lib/auth/guards";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ProfileSettingsForm } from "@/components/app/ProfileSettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile } = await requireOnboarded();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 py-12 sm:px-8">
      <div className="flex flex-col gap-2">
        <Eyebrow>Settings</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">Your profile</h1>
        <p className="text-sm text-slate">
          Signed in as <span className="font-medium text-ink">{profile.email}</span>
        </p>
      </div>
      <ProfileSettingsForm profile={profile} />
    </div>
  );
}
