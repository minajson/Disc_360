import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { getWellbeingPolicy } from "@/lib/wellbeing/policy";
import { hasWellbeingRole } from "@/lib/wellbeing/access";
import { Eyebrow } from "@/components/ui/Eyebrow";
import {
  WellbeingGovernance,
  type GovernanceGrant,
  type GovernanceOrganization,
  type GovernancePerson,
} from "@/components/admin/WellbeingGovernance";

export const metadata: Metadata = { title: "Wellbeing · Admin" };

/**
 * Wellbeing Pulse governance, from the platform side.
 *
 * The page renders for a platform administrator, but it does not make them a
 * wellbeing reader: nothing here can display an individual result, and the
 * threshold form refuses to submit unless the administrator also holds the
 * governance role for that organisation.
 */
export default async function AdminWellbeingPage() {
  const context = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data: organizations }, { data: grantRows }, { data: profiles }] = await Promise.all([
    admin.from("organizations").select("id, name").is("archived_at", null).order("name"),
    admin
      .from("wellbeing_role_grants")
      .select("id, role, granted_at, organization_id, profiles (id, full_name, email), organizations (name)")
      .is("revoked_at", null)
      .order("granted_at", { ascending: false }),
    admin
      .from("profiles")
      .select("id, full_name, email")
      .is("deactivated_at", null)
      .order("email")
      .limit(300),
  ]);

  const organizationRows = organizations ?? [];

  const summaries: GovernanceOrganization[] = await Promise.all(
    organizationRows.map(async (organization) => {
      const [policy, { count: departmentCount }, { count: officeCount }] = await Promise.all([
        getWellbeingPolicy(admin, organization.id as string),
        admin
          .from("wellbeing_departments")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organization.id)
          .is("archived_at", null),
        admin
          .from("wellbeing_office_locations")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organization.id)
          .is("archived_at", null),
      ]);
      return {
        id: organization.id as string,
        name: organization.name as string,
        threshold: policy.screeningThreshold,
        minCohort: policy.minCohortSize,
        policyIsDefault: policy.isDefault,
        departmentCount: departmentCount ?? 0,
        officeCount: officeCount ?? 0,
      };
    }),
  );

  // Which organisations this administrator may actually govern — resolved
  // through their own client, so it reflects real grants and not their
  // platform role.
  const governed = await Promise.all(
    summaries.map(async (organization) =>
      (await hasWellbeingRole(context, organization.id, "wellbeing_governance"))
        ? organization.id
        : null,
    ),
  );

  const grants: GovernanceGrant[] = (grantRows ?? []).map((row) => {
    const person = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    return {
      id: row.id as string,
      personName:
        (person as { full_name: string } | null)?.full_name ||
        (person as { email: string } | null)?.email ||
        "Unknown",
      personEmail: (person as { email: string } | null)?.email ?? "",
      organizationName: (organization as { name: string } | null)?.name ?? "Organisation",
      role: row.role as string,
      grantedAt: row.granted_at as string,
    };
  });

  const people: GovernancePerson[] = (profiles ?? []).map((profile) => ({
    id: profile.id as string,
    name: (profile.full_name as string) || "",
    email: profile.email as string,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Wellbeing Pulse</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">Governance</h1>
        <p className="max-w-3xl text-sm text-slate">
          Wellbeing Pulse is governed separately from the rest of DISC360. Individual responses and
          scores are readable only by the person who gave them — no role on this page, and no role
          in the platform, can read them.
        </p>
      </div>

      <WellbeingGovernance
        organizations={summaries}
        grants={grants}
        people={people}
        governedOrganizationIds={governed.filter((id): id is string => id !== null)}
      />
    </div>
  );
}
