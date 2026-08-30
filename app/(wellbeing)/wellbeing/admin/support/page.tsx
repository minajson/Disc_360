import type { Metadata } from "next";
import Link from "next/link";
import { resolveWellbeingScope } from "@/lib/wellbeing/access";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { SupportSettingsForm } from "@/components/wellbeing/admin/SupportSettingsForm";
import { SUPPORT_UNCONFIGURED_ADMIN_NOTE } from "@/data/support-content";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Support routes" };

/**
 * Where an organisation says who its people can talk to.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS IS A GOVERNANCE PAGE AND NOT A CAMPAIGN SETTING.
 *
 * Support routes belong to the organisation, not to one check-in. The same EAP
 * number is the right answer on a GHQ-28 result, a WHO-5 result and a result
 * from a campaign that closed last year, and asking a facilitator to re-enter
 * it per campaign guarantees that some campaigns will carry a stale number.
 *
 * WHAT PARTICIPANTS SEE FROM WHAT IS SAVED HERE.
 *
 * A card on EVERY result, at every score. Not a card that appears when
 * somebody scores badly — see data/support-content.ts for why that distinction
 * is the whole point of the feature.
 * ─────────────────────────────────────────────────────────────────────
 */
export default async function SupportSettingsPage() {
  const { scope } = await resolveWellbeingScope();
  const governed = scope.filter((entry) => entry.role === "wellbeing_governance");

  // Not an error page: somebody who holds analyst scope can read figures and
  // cannot publish an organisational commitment. They are sent back rather
  // than shown a form that will refuse them.
  if (governed.length === 0) redirect("/wellbeing");

  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from("organization_support_settings")
    .select("*")
    .in(
      "organization_id",
      governed.map((entry) => entry.organizationId),
    );
  const byOrganisation = new Map((rows ?? []).map((row) => [row.organization_id, row]));

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        href="/wellbeing/admin/campaigns"
        className="pulse-focus rounded text-sm font-medium text-slate transition-colors hover:text-pulse"
      >
        ← All campaigns
      </Link>

      <p className="mt-6 font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
        Wellbeing Pulse · Governance
      </p>
      <h1 className="mt-3 font-display text-h1 font-semibold tracking-tight text-balance">
        Support routes
      </h1>
      <p className="mt-4 max-w-2xl text-lead text-slate">
        The Employee Assistance Programme and Occupational Health details your people can use.
        Everyone in the organisation sees these on every result, whatever their role and whatever
        the check-in showed.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        {governed.map((entry) => {
          const existing = byOrganisation.get(entry.organizationId);
          const configured = Boolean(existing?.eap_enabled || existing?.oh_enabled);
          return (
            <section key={entry.organizationId} className="flex flex-col gap-5">
              <div>
                <h2 className="font-display text-h3 font-semibold text-ink">
                  {entry.organizationName}
                </h2>
                {!configured && (
                  <p className="mt-2 max-w-2xl rounded-2xl border border-[rgba(138,106,47,0.32)] bg-pulse-watch-soft/50 px-5 py-4 text-sm leading-relaxed text-ink">
                    {SUPPORT_UNCONFIGURED_ADMIN_NOTE}
                  </p>
                )}
              </div>
              <SupportSettingsForm
                organizationId={entry.organizationId}
                initial={{
                  eapEnabled: existing?.eap_enabled ?? false,
                  eapProviderName: existing?.eap_provider_name ?? "",
                  eapPhone: existing?.eap_phone ?? "",
                  eapEmail: existing?.eap_email ?? "",
                  eapUrl: existing?.eap_url ?? "",
                  eapHours: existing?.eap_hours ?? "",
                  ohEnabled: existing?.oh_enabled ?? false,
                  ohServiceName: existing?.oh_service_name ?? "",
                  ohPhone: existing?.oh_phone ?? "",
                  ohEmail: existing?.oh_email ?? "",
                  ohUrl: existing?.oh_url ?? "",
                  ohHours: existing?.oh_hours ?? "",
                  supportNote: existing?.support_note ?? "",
                }}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
