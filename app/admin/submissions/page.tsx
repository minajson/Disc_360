import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { resendReportEmail } from "@/lib/actions/admin";
import { AdminSearch, Pager } from "@/components/admin/table";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { insightMap } from "@/data/insight-maps";
import { displayArchetypeCode } from "@/lib/utils/display";
import type { ArchetypeCode } from "@/lib/types";

export const metadata: Metadata = { title: "Submissions · Admin" };

const PAGE_SIZE = 20;

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const admin = createSupabaseAdminClient();

  // Result summaries only — raw answers are never listed in admin views.
  let query = admin
    .from("assessment_results")
    .select("id, archetype_code, score_d, score_i, score_s, score_c, created_at, profiles!inner (email, full_name)", {
      count: "exact",
    });
  if (params.q) query = query.ilike("profiles.email", `%${params.q}%`);
  const { data: rows, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const pageCount = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Submissions</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">{count ?? 0} completed assessments</h1>
      </div>

      <AdminSearch placeholder="Search by email…" defaultValue={params.q} />

      <div className="paper-card divide-y divide-hairline p-0">
        {(rows ?? []).map((row) => {
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          const code = row.archetype_code as ArchetypeCode;
          return (
            <div key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
              <div className="flex min-w-0 flex-1 basis-52 flex-col">
                <span className="truncate text-sm font-medium text-ink">
                  {profile?.full_name || profile?.email}
                </span>
                <span className="truncate font-mono text-[11px] text-faint">{profile?.email}</span>
              </div>
              <span className="text-sm text-slate">{insightMap[code].name}</span>
              <span className="font-mono text-[11px] text-faint">
                {displayArchetypeCode(code)} · D {row.score_d} I {row.score_i} S {row.score_s} A {row.score_c}
              </span>
              <span className="font-mono text-[11px] text-faint">
                {new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <div className="ml-auto flex items-center gap-2.5">
                <Link href={`/admin/submissions/${row.id}`} className="text-xs text-botanical hover:underline">
                  Details
                </Link>
                <form action={resendReportEmail.bind(null, row.id)}>
                  <button type="submit" className="rounded-full border border-hairline px-3 py-1 text-xs text-slate hover:border-botanical hover:text-botanical">
                    Resend report
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      <Pager basePath="/admin/submissions" params={params} page={page} pageCount={pageCount} />
    </div>
  );
}
