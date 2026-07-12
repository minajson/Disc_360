import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { revokeEntitlement } from "@/lib/actions/admin";
import { Pager, StatusBadge } from "@/components/admin/table";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = { title: "Payments · Admin" };

const PAGE_SIZE = 25;

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const admin = createSupabaseAdminClient();

  const [{ data: rows, count }, { data: allAmounts }] = await Promise.all([
    admin
      .from("entitlements")
      .select("id, amount_cents, status, simulated, purchased_at, profiles (email), teams (name)", {
        count: "exact",
      })
      .order("purchased_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    admin.from("entitlements").select("amount_cents, status"),
  ]);

  const revenue = (allAmounts ?? [])
    .filter((row) => row.status !== "revoked")
    .reduce((sum, row) => sum + row.amount_cents, 0);

  const pageCount = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Payments</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">
          ${(revenue / 100).toFixed(2)} · {count ?? 0} purchases
        </h1>
        <p className="text-sm text-slate">
          Team-plan entitlement ledger. Simulated rows come from the
          development checkout or admin grants.
        </p>
      </div>

      <div className="paper-card divide-y divide-hairline p-0">
        {(rows ?? []).map((row) => {
          const purchaser = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
          return (
            <div key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
              <span className="min-w-0 flex-1 basis-52 truncate text-sm text-ink">
                {purchaser?.email ?? "—"}
              </span>
              <span className="font-mono text-sm text-ink">
                ${(row.amount_cents / 100).toFixed(2)}
              </span>
              <StatusBadge
                tone={row.status === "active" ? "green" : row.status === "consumed" ? "blue" : "red"}
              >
                {row.status}
              </StatusBadge>
              {row.simulated ? <StatusBadge tone="neutral">simulated</StatusBadge> : null}
              <span className="text-xs text-slate">
                {team ? `→ ${team.name}` : "unused"}
              </span>
              <span className="font-mono text-[11px] text-faint">
                {new Date(row.purchased_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              {row.status === "active" ? (
                <form action={revokeEntitlement.bind(null, row.id)} className="ml-auto">
                  <button type="submit" className="text-xs text-disc-d hover:underline">
                    Revoke
                  </button>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>

      <Pager basePath="/admin/payments" params={params} page={page} pageCount={pageCount} />
    </div>
  );
}
