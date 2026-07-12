import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { archiveTeamAsAdmin } from "@/lib/actions/admin";
import { AdminSearch, Pager, SortHeader, StatusBadge } from "@/components/admin/table";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = { title: "Teams · Admin" };

const PAGE_SIZE = 20;
const SORTS = new Set(["name", "created_at"]);

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const sort = SORTS.has(params.sort ?? "") ? params.sort! : "created_at";

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("teams")
    .select(
      "id, name, team_code, department, archived_at, created_at, organizations (name), team_members (id, profile_id)",
      { count: "exact" },
    );
  if (params.q) query = query.ilike("name", `%${params.q}%`);
  const { data: teams, count } = await query
    .order(sort, { ascending: params.dir === "asc" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const pageCount = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Teams</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">{count ?? 0} teams</h1>
      </div>

      <AdminSearch placeholder="Search team name…" defaultValue={params.q} />

      <div className="paper-card overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline font-mono text-[11px] uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">
                <SortHeader basePath="/admin/teams" params={params} field="name" label="Team" />
              </th>
              <th className="px-3 py-3 font-medium text-faint">Organization</th>
              <th className="px-3 py-3 font-medium text-faint">Members</th>
              <th className="px-3 py-3 font-medium text-faint">Status</th>
              <th className="px-3 py-3 font-medium">
                <SortHeader basePath="/admin/teams" params={params} field="created_at" label="Created" />
              </th>
              <th className="px-5 py-3 text-right font-medium text-faint">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {(teams ?? []).map((team) => {
              const org = Array.isArray(team.organizations)
                ? team.organizations[0]
                : team.organizations;
              const members = team.team_members ?? [];
              return (
                <tr key={team.id}>
                  <td className="px-5 py-3">
                    <span className="font-medium text-ink">{team.name}</span>
                    <span className="ml-2 font-mono text-[11px] text-faint">{team.team_code}</span>
                  </td>
                  <td className="px-3 py-3 text-slate">{org?.name ?? "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate">
                    {members.filter((m) => m.profile_id).length}/{members.length}
                  </td>
                  <td className="px-3 py-3">
                    {team.archived_at ? (
                      <StatusBadge tone="neutral">archived</StatusBadge>
                    ) : (
                      <StatusBadge tone="green">active</StatusBadge>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-faint">
                    {new Date(team.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-5 py-3">
                    {!team.archived_at ? (
                      <form action={archiveTeamAsAdmin.bind(null, team.id)} className="flex justify-end">
                        <button type="submit" className="rounded-full border border-hairline px-3 py-1 text-xs text-slate hover:border-disc-d hover:text-disc-d">
                          Archive
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pager basePath="/admin/teams" params={params} page={page} pageCount={pageCount} />
    </div>
  );
}
