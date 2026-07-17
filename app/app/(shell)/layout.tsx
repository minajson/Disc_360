import { requireOnboarded } from "@/lib/auth/guards";
import { getTeamEntitlement } from "@/lib/payments/entitlements";
import { accountMenuFor, navFor, resolveExperience } from "@/lib/navigation/app-nav";
import { AppHeader } from "@/components/app/AppHeader";

/**
 * Resolves which of the three product experiences this person is in and hands
 * the matching navigation to the header. The membership lookups happen here,
 * server-side; `resolveExperience` and `navFor` are pure and unit-tested.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireOnboarded();
  const { supabase, user, profile } = context;

  const [{ data: adminMembership }, { data: coachProfile }, entitlement] =
    await Promise.all([
      supabase
        .from("team_members")
        .select("id")
        .eq("profile_id", user.id)
        .eq("role", "team_admin")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("coach_profiles")
        .select("profile_id")
        .eq("profile_id", user.id)
        .maybeSingle(),
      getTeamEntitlement(context),
    ]);

  const experience = resolveExperience({
    isCoach:
      Boolean(coachProfile) || profile.onboarding_intent === "manage_clients",
    isTeamAdmin: Boolean(adminMembership),
    hasTeamEntitlement: entitlement.allowed,
  });

  return (
    <>
      <AppHeader
        preferredName={profile.preferred_name || profile.full_name}
        links={navFor(experience)}
        accountLinks={accountMenuFor(experience, profile.is_super_admin)}
        showPlatformAdmin={profile.is_super_admin}
      />
      <main className="flex-1 bg-mineral">{children}</main>
    </>
  );
}
