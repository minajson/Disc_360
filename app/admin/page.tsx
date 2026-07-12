import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  await requireSuperAdmin();
  // Service role after guard: platform-wide counts are this page's purpose.
  const admin = createSupabaseAdminClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    users,
    activeTeams,
    submissions,
    completedToday,
    pendingInvitations,
    reportsEmailed,
    failedEmails,
    revenue,
    purchases,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("teams").select("id", { count: "exact", head: true }).is("archived_at", null),
    admin.from("assessment_results").select("id", { count: "exact", head: true }),
    admin
      .from("assessment_results")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
    admin
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("notification_logs")
      .select("id", { count: "exact", head: true })
      .in("template", ["report_ready", "assessment_completion"]),
    admin
      .from("notification_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    admin.from("entitlements").select("amount_cents").neq("status", "revoked"),
    admin
      .from("entitlements")
      .select("id", { count: "exact", head: true })
      .eq("product", "team"),
  ]);

  const revenueCents = (revenue.data ?? []).reduce(
    (sum, row) => sum + row.amount_cents,
    0,
  );

  const cards: { label: string; value: string; href: string }[] = [
    { label: "Total users", value: String(users.count ?? 0), href: "/admin/users" },
    { label: "Active teams", value: String(activeTeams.count ?? 0), href: "/admin/teams" },
    { label: "Total submissions", value: String(submissions.count ?? 0), href: "/admin/submissions" },
    { label: "Completed today", value: String(completedToday.count ?? 0), href: "/admin/submissions" },
    { label: "Pending invitations", value: String(pendingInvitations.count ?? 0), href: "/admin/teams" },
    { label: "Reports emailed", value: String(reportsEmailed.count ?? 0), href: "/admin/emails" },
    { label: "Failed emails", value: String(failedEmails.count ?? 0), href: "/admin/emails" },
    { label: "Total revenue", value: `$${(revenueCents / 100).toFixed(2)}`, href: "/admin/payments" },
    { label: "Team purchases", value: String(purchases.count ?? 0), href: "/admin/payments" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Overview</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">Platform health</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="group">
            <div className="paper-card flex flex-col gap-1 px-5 py-4 transition-all duration-200 group-hover:-translate-y-0.5">
              <span className="text-xs text-faint">{card.label}</span>
              <span className="font-display text-2xl font-semibold tracking-tight text-ink">
                {card.value}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
