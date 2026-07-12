import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import {
  removeOrgMembership,
  resendReportEmail,
  revokeEntitlement,
  setOrgMemberRole,
} from "@/lib/actions/admin";
import { CreateTeamForUserForm } from "@/components/admin/CreateTeamForUserForm";
import { StatusBadge } from "@/components/admin/table";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { displayArchetypeCode } from "@/lib/utils/display";
import { insightMap } from "@/data/insight-maps";
import type { ArchetypeCode } from "@/lib/types";

export const metadata: Metadata = { title: "User · Admin" };

const ORG_ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "coach", label: "Coach" },
  { value: "organization_admin", label: "Organization admin" },
] as const;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

async function changeOrgRole(formData: FormData): Promise<void> {
  "use server";
  await setOrgMemberRole(
    String(formData.get("membership_id") ?? ""),
    String(formData.get("role") ?? ""),
  );
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireSuperAdmin();
  const { userId } = await params;
  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, full_name, profession, country, timezone, is_super_admin, deactivated_at, created_at, onboarded_at")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) notFound();

  const [{ data: memberships }, { data: results }, { data: entitlements }, { data: orgMemberships }] =
    await Promise.all([
      admin
        .from("team_members")
        .select("role, teams (id, name, archived_at)")
        .eq("profile_id", userId),
      admin
        .from("assessment_results")
        .select("id, archetype_code, score_d, score_i, score_s, score_c, created_at")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false }),
      admin
        .from("entitlements")
        .select("id, status, amount_cents, purchased_at, team_id")
        .eq("purchaser_id", userId)
        .order("purchased_at", { ascending: false }),
      admin
        .from("organization_members")
        .select("id, role, organizations (name)")
        .eq("profile_id", userId),
    ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>User</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">{profile.full_name || profile.email}</h1>
        <p className="font-mono text-xs text-faint">
          {profile.email} · joined {formatDate(profile.created_at)}
          {profile.deactivated_at ? " · DEACTIVATED" : ""}
          {profile.is_super_admin ? " · SUPER ADMIN" : ""}
        </p>
      </div>

      <section className="flex flex-col gap-3" aria-label="Submissions">
        <h2 className="font-display text-h3 font-semibold">Submissions · {results?.length ?? 0}</h2>
        {(results ?? []).length > 0 ? (
          <div className="paper-card divide-y divide-hairline p-0">
            {(results ?? []).map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <span className="font-medium text-ink">
                  {insightMap[row.archetype_code as ArchetypeCode].name}
                </span>
                <span className="font-mono text-xs text-faint">
                  {displayArchetypeCode(row.archetype_code as ArchetypeCode)} · D {row.score_d} I {row.score_i} S {row.score_s} A {row.score_c} · {formatDate(row.created_at)}
                </span>
                <div className="ml-auto flex gap-2">
                  <Link href={`/admin/submissions/${row.id}`} className="text-xs text-botanical hover:underline">
                    Details
                  </Link>
                  <form action={resendReportEmail.bind(null, row.id)}>
                    <button type="submit" className="text-xs text-slate hover:text-ink">
                      Resend report email
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="paper-card p-5 text-sm text-slate">No completed assessments.</p>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-label="Entitlements">
        <h2 className="font-display text-h3 font-semibold">Entitlements</h2>
        {(entitlements ?? []).length > 0 ? (
          <div className="paper-card divide-y divide-hairline p-0">
            {(entitlements ?? []).map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <StatusBadge tone={row.status === "active" ? "green" : row.status === "consumed" ? "blue" : "red"}>
                  {row.status}
                </StatusBadge>
                <span className="font-mono text-xs text-faint">
                  ${(row.amount_cents / 100).toFixed(2)} · {formatDate(row.purchased_at)}
                </span>
                {row.status === "active" ? (
                  <form action={revokeEntitlement.bind(null, row.id)} className="ml-auto">
                    <button type="submit" className="text-xs text-disc-d hover:underline">
                      Revoke
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="paper-card p-5 text-sm text-slate">No purchases.</p>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-label="Teams">
        <h2 className="font-display text-h3 font-semibold">Teams</h2>
        <div className="paper-card divide-y divide-hairline p-0">
          {(memberships ?? []).map((row, index) => {
            const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
            if (!team) return null;
            return (
              <div key={index} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-ink">{team.name}</span>
                <span className="font-mono text-[11px] text-faint">
                  {row.role === "team_admin" ? "ADMIN" : "MEMBER"}
                  {team.archived_at ? " · archived" : ""}
                </span>
              </div>
            );
          })}
          {(memberships ?? []).length === 0 ? (
            <p className="p-5 text-sm text-slate">No team memberships.</p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-label="Organization roles">
        <h2 className="font-display text-h3 font-semibold">Organization roles</h2>
        <div className="paper-card divide-y divide-hairline p-0">
          {(orgMemberships ?? []).map((row) => {
            const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
            return (
              <div key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <span className="text-sm text-ink">{org?.name ?? "Organization"}</span>
                <div className="ml-auto flex items-center gap-3">
                  <form action={changeOrgRole} className="flex items-center gap-2">
                    <input type="hidden" name="membership_id" value={row.id} />
                    <select
                      name="role"
                      defaultValue={row.role}
                      aria-label={`Role in ${org?.name ?? "organization"}`}
                      className="rounded-md border border-hairline bg-canvas px-2 py-1.5 text-xs text-ink"
                    >
                      {ORG_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="text-xs text-botanical hover:underline">
                      Update role
                    </button>
                  </form>
                  <form action={removeOrgMembership.bind(null, row.id)}>
                    <button type="submit" className="text-xs text-disc-d hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
          {(orgMemberships ?? []).length === 0 ? (
            <p className="p-5 text-sm text-slate">No organization memberships.</p>
          ) : null}
        </div>
        <p className="text-xs text-faint">
          Coaches see the coaching workspace; organization admins manage teams across their organization.
        </p>
      </section>

      <section className="paper-card flex flex-col gap-4 p-6" aria-label="Create team on behalf">
        <h2 className="font-display text-base font-semibold">Create a team for this user</h2>
        <CreateTeamForUserForm userId={profile.id} />
      </section>
    </div>
  );
}
