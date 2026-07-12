import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { AdminSearch, Pager, StatusBadge } from "@/components/admin/table";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = { title: "Emails · Admin" };

const PAGE_SIZE = 25;
const STATUS_TONES: Record<string, "green" | "amber" | "red" | "blue" | "neutral"> = {
  sent: "green",
  logged: "blue",
  skipped: "amber",
  failed: "red",
  queued: "neutral",
};

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const admin = createSupabaseAdminClient();

  let query = admin
    .from("notification_logs")
    .select("id, email, template, subject, status, error, created_at", { count: "exact" });
  if (params.q) query = query.ilike("email", `%${params.q}%`);
  if (params.status && ["queued", "sent", "failed", "skipped", "logged"].includes(params.status)) {
    query = query.eq("status", params.status as "sent");
  }
  const { data: rows, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const pageCount = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Emails</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">
          {count ?? 0} notification{(count ?? 0) === 1 ? "" : "s"}
        </h1>
      </div>

      <AdminSearch
        placeholder="Search recipient…"
        defaultValue={params.q}
        extra={
          <select
            name="status"
            defaultValue={params.status ?? ""}
            aria-label="Filter by status"
            className="rounded-full border border-hairline bg-paper px-4 py-2 text-sm text-slate focus:border-botanical focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="sent">Sent</option>
            <option value="logged">Logged (dev)</option>
            <option value="skipped">Skipped</option>
            <option value="failed">Failed</option>
          </select>
        }
      />

      <div className="paper-card divide-y divide-hairline p-0">
        {(rows ?? []).map((row) => (
          <div key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
            <span className="min-w-0 flex-1 basis-48 truncate text-sm text-ink">{row.email}</span>
            <span className="min-w-0 flex-1 basis-56 truncate text-xs text-slate">{row.subject}</span>
            <StatusBadge tone={STATUS_TONES[row.status] ?? "neutral"}>{row.status}</StatusBadge>
            <span className="font-mono text-[11px] text-faint">
              {new Date(row.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            {row.error ? (
              <span className="basis-full pl-0 text-xs text-disc-d">{row.error}</span>
            ) : null}
          </div>
        ))}
      </div>

      <Pager basePath="/admin/emails" params={params} page={page} pageCount={pageCount} />
    </div>
  );
}
