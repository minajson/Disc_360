import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { Pager } from "@/components/admin/table";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = { title: "Reports · Admin" };

const PAGE_SIZE = 25;

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const admin = createSupabaseAdminClient();

  const [{ data: rows, count }, emailed] = await Promise.all([
    admin
      .from("report_exports")
      .select("id, kind, created_at, profiles (email)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    admin
      .from("notification_logs")
      .select("id", { count: "exact", head: true })
      .eq("template", "report_ready"),
  ]);

  const pageCount = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Reports</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">Report activity</h1>
        <p className="text-sm text-slate">
          {count ?? 0} export{(count ?? 0) === 1 ? "" : "s"} ·{" "}
          {emailed.count ?? 0} report email{(emailed.count ?? 0) === 1 ? "" : "s"} delivered or logged
        </p>
      </div>

      <div className="paper-card divide-y divide-hairline p-0">
        {(rows ?? []).map((row) => {
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          return (
            <div key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
              <span className="min-w-0 flex-1 basis-52 truncate text-sm text-ink">
                {profile?.email ?? "—"}
              </span>
              <span className="font-mono text-xs text-slate">{row.kind.replace(/_/g, " ")}</span>
              <span className="ml-auto font-mono text-[11px] text-faint">
                {new Date(row.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
        {(rows ?? []).length === 0 ? (
          <p className="p-5 text-sm text-slate">No report exports yet.</p>
        ) : null}
      </div>

      <Pager basePath="/admin/reports" params={params} page={page} pageCount={pageCount} />
    </div>
  );
}
