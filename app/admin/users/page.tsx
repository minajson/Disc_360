import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import {
  grantTeamEntitlement,
  setUserActive,
  toggleSuperAdmin,
} from "@/lib/actions/admin";
import { AdminSearch, Pager, SortHeader, StatusBadge } from "@/components/admin/table";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = { title: "Users · Admin" };

const PAGE_SIZE = 20;
const SORTS = new Set(["email", "full_name", "created_at"]);

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }>;
}) {
  const { user: self } = await requireSuperAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const sort = SORTS.has(params.sort ?? "") ? params.sort! : "created_at";
  const ascending = params.dir === "asc";

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("profiles")
    .select("id, email, full_name, is_super_admin, deactivated_at, created_at", {
      count: "exact",
    });
  if (params.q) {
    query = query.or(`email.ilike.%${params.q}%,full_name.ilike.%${params.q}%`);
  }
  const { data: users, count } = await query
    .order(sort, { ascending })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const pageCount = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Users</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">{count ?? 0} accounts</h1>
      </div>

      <AdminSearch placeholder="Search email or name…" defaultValue={params.q} />

      <div className="paper-card overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline font-mono text-[11px] uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">
                <SortHeader basePath="/admin/users" params={params} field="full_name" label="Name" />
              </th>
              <th className="px-3 py-3 font-medium">
                <SortHeader basePath="/admin/users" params={params} field="email" label="Email" />
              </th>
              <th className="px-3 py-3 font-medium text-faint">Status</th>
              <th className="px-3 py-3 font-medium">
                <SortHeader basePath="/admin/users" params={params} field="created_at" label="Joined" />
              </th>
              <th className="px-5 py-3 text-right font-medium text-faint">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {(users ?? []).map((row) => (
              <tr key={row.id}>
                <td className="px-5 py-3">
                  <Link href={`/admin/users/${row.id}`} className="font-medium text-ink hover:text-botanical">
                    {row.full_name || "—"}
                  </Link>
                </td>
                <td className="px-3 py-3 text-slate">{row.email}</td>
                <td className="px-3 py-3">
                  <span className="flex flex-wrap gap-1.5">
                    {row.is_super_admin ? <StatusBadge tone="blue">super admin</StatusBadge> : null}
                    {row.deactivated_at ? (
                      <StatusBadge tone="red">deactivated</StatusBadge>
                    ) : (
                      <StatusBadge tone="green">active</StatusBadge>
                    )}
                  </span>
                </td>
                <td className="px-3 py-3 font-mono text-xs text-faint">
                  {new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-1.5">
                    <form action={grantTeamEntitlement.bind(null, row.id)}>
                      <button type="submit" className="rounded-full border border-hairline px-3 py-1 text-xs text-slate hover:border-botanical hover:text-botanical">
                        Grant team
                      </button>
                    </form>
                    {row.id !== self.id ? (
                      <>
                        <form action={toggleSuperAdmin.bind(null, row.id)}>
                          <button type="submit" className="rounded-full border border-hairline px-3 py-1 text-xs text-slate hover:border-botanical hover:text-botanical">
                            {row.is_super_admin ? "Revoke admin" : "Make admin"}
                          </button>
                        </form>
                        <form action={setUserActive.bind(null, row.id, Boolean(row.deactivated_at))}>
                          <button type="submit" className="rounded-full border border-hairline px-3 py-1 text-xs text-slate hover:border-disc-d hover:text-disc-d">
                            {row.deactivated_at ? "Reactivate" : "Deactivate"}
                          </button>
                        </form>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager basePath="/admin/users" params={params} page={page} pageCount={pageCount} />
    </div>
  );
}
