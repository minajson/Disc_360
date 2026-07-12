import { requireOnboarded } from "@/lib/auth/guards";
import { getTeamEntitlement } from "@/lib/payments/entitlements";
import { AppHeader, type AppNavLink } from "@/components/app/AppHeader";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireOnboarded();
  const { supabase, user, profile } = context;

  // Role-aware navigation: individuals see personal links; team-admin-capable
  // users add team management; super admins add the platform admin area.
  const [{ data: adminMembership }, entitlement] = await Promise.all([
    supabase
      .from("team_members")
      .select("id")
      .eq("profile_id", user.id)
      .eq("role", "team_admin")
      .limit(1)
      .maybeSingle(),
    getTeamEntitlement(context),
  ]);
  const teamCapable = Boolean(adminMembership) || entitlement.allowed;

  const links: AppNavLink[] = [
    { href: "/app", label: "Dashboard" },
    { href: "/app/assessments", label: "My assessment" },
    { href: "/app/history", label: "My results" },
    ...(teamCapable
      ? [
          { href: "/app/teams", label: "Teams" },
          { href: "/app/reports", label: "Reports" },
        ]
      : [{ href: "/app/invitations", label: "Invitations" }]),
    { href: "/app/settings", label: "Settings" },
    ...(profile.is_super_admin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <>
      <AppHeader
        preferredName={profile.preferred_name || profile.full_name}
        links={links}
      />
      <main className="flex-1 bg-mineral">{children}</main>
    </>
  );
}
