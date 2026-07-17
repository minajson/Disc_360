import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = { title: "Roles · Admin" };

/**
 * Cross-cutting view of who holds elevated access.
 *
 * Roles in DISC360 are membership-scoped rows (organization_members,
 * team_members), not flags on a profile — the one exception being
 * is_super_admin. That makes "who can administer what?" impossible to answer
 * from the Users list, which is per-account. This page inverts it: it starts
 * from the privilege and lists the holders.
 *
 * It is deliberately read-only. Every row links to the user detail page,
 * which owns the mutations, so there is exactly one place a role is changed
 * and one audit trail.
 */

interface RoleHolder {
  profileId: string;
  name: string;
  email: string;
  scope: string;
}

const ORG_ROLE_LABEL: Record<string, string> = {
  organization_admin: "Organization admin",
  coach: "Coach",
};

export default async function AdminRolesPage() {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data: supers }, { data: orgRoles }, { data: teamAdmins }, { data: coaches }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_super_admin", true)
        .order("email"),
      admin
        .from("organization_members")
        .select("role, profiles (id, full_name, email), organizations (name)")
        .in("role", ["organization_admin", "coach"]),
      admin
        .from("team_members")
        .select("profile_id, display_name, email, teams (name, archived_at)")
        .eq("role", "team_admin"),
      admin
        .from("coach_profiles")
        .select("profile_id, title, organization, profiles (id, full_name, email)"),
    ]);

  const superAdmins: RoleHolder[] = (supers ?? []).map((row) => ({
    profileId: row.id,
    name: row.full_name,
    email: row.email,
    scope: "Entire platform",
  }));

  const one = <T,>(value: T | T[] | null): T | null =>
    Array.isArray(value) ? (value[0] ?? null) : value;

  const organizationRoles = (orgRoles ?? []).flatMap((row) => {
    const profile = one(row.profiles as { id: string; full_name: string; email: string } | null);
    const organization = one(row.organizations as { name: string } | null);
    if (!profile) return [];
    return [
      {
        profileId: profile.id,
        name: profile.full_name,
        email: profile.email,
        scope: `${ORG_ROLE_LABEL[row.role] ?? row.role} · ${organization?.name ?? "—"}`,
      },
    ];
  });

  const facilitators = (teamAdmins ?? []).flatMap((row) => {
    const team = one(row.teams as { name: string; archived_at: string | null } | null);
    if (!row.profile_id || !team || team.archived_at) return [];
    return [
      {
        profileId: row.profile_id,
        name: row.display_name,
        email: row.email,
        scope: team.name,
      },
    ];
  });

  const coachProfiles = (coaches ?? []).flatMap((row) => {
    const profile = one(row.profiles as { id: string; full_name: string; email: string } | null);
    if (!profile) return [];
    return [
      {
        profileId: profile.id,
        name: profile.full_name,
        email: profile.email,
        scope: [row.title, row.organization].filter(Boolean).join(" · ") || "Coach",
      },
    ];
  });

  const sections: { title: string; blurb: string; holders: RoleHolder[]; empty: string }[] = [
    {
      title: "Super admins",
      blurb:
        "Full platform access, including every team's data. The only role stored as a flag on the profile.",
      holders: superAdmins,
      empty: "No super admins — this should never happen.",
    },
    {
      title: "Organization roles",
      blurb: "Scoped to one organization via organization_members.",
      holders: organizationRoles,
      empty: "No organization admins or coaches assigned yet.",
    },
    {
      title: "Team facilitators",
      blurb:
        "Hold team_admin on a live team: can invite, present and export that team's report.",
      holders: facilitators,
      empty: "No team facilitators yet.",
    },
    {
      title: "Coach profiles",
      blurb: "Accounts with a published coach profile shown to participants.",
      holders: coachProfiles,
      empty: "No coach profiles created yet.",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Roles</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">Access overview</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate">
          Everyone holding elevated access, grouped by privilege. Roles are
          membership-scoped, so a person can appear in more than one section.
          Open a user to change their roles.
        </p>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-h3 font-semibold">{section.title}</h2>
            <span className="font-mono text-[11px] text-faint">
              {section.holders.length}{" "}
              {section.holders.length === 1 ? "person" : "people"}
            </span>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-slate">{section.blurb}</p>

          {section.holders.length > 0 ? (
            <div className="paper-card overflow-x-auto p-0">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-hairline text-xs text-faint">
                    <th scope="col" className="px-5 py-3 font-medium">Name</th>
                    <th scope="col" className="px-5 py-3 font-medium">Email</th>
                    <th scope="col" className="px-5 py-3 font-medium">Scope</th>
                    <th scope="col" className="px-5 py-3 font-medium">
                      <span className="sr-only">Manage</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {section.holders.map((holder) => (
                    <tr
                      key={`${section.title}-${holder.profileId}-${holder.scope}`}
                      className="border-b border-hairline/60 last:border-0"
                    >
                      <td className="px-5 py-3 text-ink">{holder.name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate">
                        {holder.email}
                      </td>
                      <td className="px-5 py-3 text-slate">{holder.scope}</td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/admin/users/${holder.profileId}`}
                          className="text-xs text-botanical underline-offset-4 hover:underline"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="paper-card p-6">
              <p className="text-sm text-slate">{section.empty}</p>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
