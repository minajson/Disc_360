import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { getTeamEntitlement } from "@/lib/payments/entitlements";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { NewTeamForm } from "@/components/teams/NewTeamForm";

export const metadata: Metadata = { title: "New team" };

export default async function NewTeamPage() {
  const context = await requireOnboarded();

  // No entitlement → clear pricing prompt instead of a dead end.
  const entitlement = await getTeamEntitlement(context);
  if (!entitlement.allowed) redirect("/pricing?intent=create-team");

  const { data: memberships } = await context.supabase
    .from("organization_members")
    .select("organizations (name)")
    .eq("profile_id", context.user.id)
    .in("role", ["organization_admin", "coach"])
    .limit(1);
  const firstOrg = memberships?.[0]
    ? Array.isArray(memberships[0].organizations)
      ? memberships[0].organizations[0]
      : memberships[0].organizations
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-12 sm:px-8">
      <div className="flex flex-col gap-2">
        <Eyebrow>New team</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">Set up your team assessment</h1>
        <p className="text-sm text-slate">
          {entitlement.isSuperAdmin
            ? "Creating as platform admin."
            : "Your Team plan covers this team — invitations and tracking are included."}
        </p>
      </div>
      <NewTeamForm defaultOrganizationName={firstOrg?.name ?? ""} />
    </div>
  );
}
