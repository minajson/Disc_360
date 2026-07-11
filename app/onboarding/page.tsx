import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { BrandMark } from "@/components/marketing/BrandMark";
import { AssessmentTransitionScene } from "@/components/media/AssessmentTransitionScene";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const { profile } = await requireUser();
  if (profile.onboarded_at) redirect("/app");

  const { intent } = await searchParams;
  const mappedIntent =
    intent === "team" ? "create_team" : intent === "coach" ? "manage_clients" : intent;

  return (
    <div className="relative flex min-h-screen flex-col">
      <AssessmentTransitionScene />
      <header className="relative z-10 mx-auto flex h-[72px] w-full max-w-7xl items-center px-5 sm:px-8">
        <BrandMark />
      </header>
      <main className="relative z-10 flex flex-1 justify-center px-5 py-10">
        <OnboardingFlow
          defaultFullName={profile.full_name}
          defaultEmail={profile.email}
          initialIntent={mappedIntent}
        />
      </main>
    </div>
  );
}
