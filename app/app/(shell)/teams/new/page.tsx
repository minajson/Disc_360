import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { getTeamEntitlement } from "@/lib/payments/entitlements";
import { getOrCreateDraft } from "@/lib/actions/team-drafts";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { TeamWizard } from "@/components/teams/TeamWizard";

export const metadata: Metadata = { title: "New team" };

/**
 * The one place team details are collected.
 *
 * The draft is loaded server-side on every visit, so arriving here after
 * pricing, a sign-in or a reload restores exactly what was already typed —
 * nothing is ever asked twice.
 */
export default async function NewTeamPage() {
  const context = await requireOnboarded();

  // No entitlement → the pricing prompt, never a dead end. Reaching the wizard
  // means the plan question is already settled, which is what lets the wizard
  // be the only team form in the product.
  const entitlement = await getTeamEntitlement(context);
  if (!entitlement.allowed) redirect("/pricing?intent=create-team");

  const [{ data: memberships }, draft] = await Promise.all([
    context.supabase
      .from("organization_members")
      .select("organizations (name)")
      .eq("profile_id", context.user.id)
      .in("role", ["organization_admin", "coach"])
      .limit(1),
    getOrCreateDraft(),
  ]);

  const firstOrg = memberships?.[0]
    ? Array.isArray(memberships[0].organizations)
      ? memberships[0].organizations[0]
      : memberships[0].organizations
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-12 sm:px-8">
      <div className="flex flex-col gap-2">
        <Eyebrow>New team</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">
          Set up your team assessment
        </h1>
        <p className="text-sm leading-relaxed text-slate">
          {entitlement.isSuperAdmin
            ? "Creating as platform admin."
            : "Your Team plan covers this team — invitations, live tracking and presentation mode are included."}{" "}
          Your answers save as you go.
        </p>
      </div>

      <TeamWizard
        draft={draft}
        defaultOrganizationName={firstOrg?.name ?? ""}
        isSuperAdmin={entitlement.isSuperAdmin}
      />
    </div>
  );
}
