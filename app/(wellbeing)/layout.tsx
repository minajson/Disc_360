import type { Metadata } from "next";
import { PulseFooter, PulseHeader } from "@/components/wellbeing/PulseChrome";
import { requireUser } from "@/lib/auth/guards";
import { getTeamEntitlement } from "@/lib/payments/entitlements";
import {
  WELLBEING_PRODUCT_DESCRIPTION,
  WELLBEING_PRODUCT_NAME,
} from "@/data/wellbeing-content";

export const metadata: Metadata = {
  title: {
    default: WELLBEING_PRODUCT_NAME,
    // Overrides the DISC360 template from the root layout: a participant in
    // this shell should not see "· DISC360" in their browser tab either.
    template: `%s · ${WELLBEING_PRODUCT_NAME}`,
  },
  description: `${WELLBEING_PRODUCT_DESCRIPTION}. A short, private check-in on how you have been feeling recently.`,
  robots: { index: false, follow: false },
};

/**
 * The Wellbeing Pulse shell.
 *
 * Shares DISC360's authentication, database and identity model underneath, and
 * shares none of its navigation on top. Whether the single "Open DISC360"
 * escape hatch appears is decided HERE, from memberships resolved server-side
 * — never from a prop a page could pass or a parameter a participant could
 * set.
 *
 * The privacy boundary is not this layout. Hiding a link is presentation;
 * every wellbeing surface is separately authorised on the server, so an
 * ordinary participant typing an analytics URL is refused by the guard, not by
 * the absence of a menu item.
 */
export default async function WellbeingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireUser();
  const { supabase, user, profile } = context;

  const [{ data: adminMembership }, { data: coachProfile }, { data: wellbeingRole }, entitlement] =
    await Promise.all([
      supabase
        .from("team_members")
        .select("id")
        .eq("profile_id", user.id)
        .eq("role", "team_admin")
        .limit(1)
        .maybeSingle(),
      supabase.from("coach_profiles").select("profile_id").eq("profile_id", user.id).maybeSingle(),
      supabase
        .from("wellbeing_role_grants")
        .select("id")
        .eq("profile_id", user.id)
        .is("revoked_at", null)
        .limit(1)
        .maybeSingle(),
      getTeamEntitlement(context),
    ]);

  // An ordinary participant holds none of these, and therefore never sees a
  // way out of the Wellbeing Pulse experience.
  const showPlatformLink =
    profile.is_super_admin ||
    Boolean(adminMembership) ||
    Boolean(coachProfile) ||
    entitlement.allowed;

  const links = [
    { href: "/wellbeing", label: "Home" },
    { href: "/wellbeing/history", label: "My History" },
  ];
  if (wellbeingRole) links.push({ href: "/wellbeing/analytics", label: "Analytics" });

  return (
    <div className="pulse-canvas flex min-h-screen flex-col">
      <PulseHeader links={links} showPlatformLink={showPlatformLink} />
      <main className="flex-1">{children}</main>
      <PulseFooter />
    </div>
  );
}
