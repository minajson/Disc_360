import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { getPublicBaseUrl } from "@/lib/utils/site-url";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = { title: "Settings · Admin" };

export default async function AdminSettingsPage() {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data: version }, { count: auditCount }] = await Promise.all([
    admin.from("assessment_versions").select("name, version, is_active").eq("is_active", true).maybeSingle(),
    admin.from("audit_logs").select("id", { count: "exact", head: true }),
  ]);

  const rows: { label: string; value: string }[] = [
    { label: "Site URL", value: getPublicBaseUrl().url },
    { label: "Supabase URL", value: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "—" },
    {
      label: "Email delivery",
      value: process.env.RESEND_API_KEY
        ? "Resend (live)"
        : "Development sink — logged to notification_logs",
    },
    { label: "Payments", value: "Development checkout (simulated $8 team plan)" },
    {
      label: "Active assessment version",
      value: version ? `${version.name} (v${version.version})` : "none",
    },
    { label: "Audit log entries", value: String(auditCount ?? 0) },
    { label: "Environment", value: process.env.NODE_ENV ?? "development" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Settings</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">Platform configuration</h1>
        <p className="text-sm text-slate">
          Read-only view of the running configuration. Values change via
          environment variables and migrations.
        </p>
      </div>

      <div className="paper-card divide-y divide-hairline p-0">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-5 py-3.5">
            <span className="w-52 text-sm font-medium text-ink">{row.label}</span>
            <span className="font-mono text-xs text-slate">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
