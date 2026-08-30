import type { Metadata } from "next";
import Link from "next/link";
import { requireManagementSurface } from "@/lib/wellbeing/demo-access";
import { listVisibleCampaigns } from "@/lib/wellbeing/campaign-list";
import { LifecycleChip } from "@/components/wellbeing/campaign/LifecycleChip";

export const metadata: Metadata = { title: "Campaigns" };

/**
 * Every campaign this person runs, in one place.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS ROUTE EXISTS.
 *
 * A facilitator could reach a campaign only by remembering its URL, by a link
 * at the bottom of Settings, or through "Management Pilot" — a page named
 * after an evaluation exercise rather than after the work. There was no
 * "Campaigns" anywhere in the navigation of a product whose central object is
 * a campaign.
 *
 * Scope is computed in `listVisibleCampaigns`, which replaced an unscoped
 * service-role query over every wellbeing team on the platform.
 * ─────────────────────────────────────────────────────────────────────
 */
export default async function CampaignsPage() {
  await requireManagementSurface();
  const { campaigns, governedOrganizations } = await listVisibleCampaigns();

  const running = campaigns.filter(
    (campaign) => campaign.lifecycle === "open" || campaign.lifecycle === "paused",
  );
  const preparing = campaigns.filter((campaign) => campaign.lifecycle === "draft");
  const ended = campaigns.filter(
    (campaign) => campaign.lifecycle === "closed" || campaign.lifecycle === "archived",
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
            Wellbeing Pulse
          </p>
          <h1 className="mt-3 font-display text-h1 font-semibold tracking-tight text-balance">
            Campaigns
          </h1>
        </div>
        {governedOrganizations.length > 0 && (
          <Link
            href="/wellbeing/admin/campaigns/new"
            className="pulse-focus rounded-full bg-pulse px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pulse-deep"
          >
            New campaign
          </Link>
        )}
      </div>

      {campaigns.length === 0 ? (
        <p className="mt-10 max-w-xl text-lead text-slate">
          {governedOrganizations.length > 0
            ? "You are not running a campaign yet. Create one, choose its questionnaire, and share the QR code with the people taking part."
            : "You are not running a campaign yet. Whoever holds Wellbeing Pulse governance in your organisation can create one and give you access to it."}
        </p>
      ) : (
        <div className="mt-10 flex flex-col gap-10">
          <Group title="Running now" campaigns={running} />
          <Group title="Not yet open" campaigns={preparing} />
          <Group title="Ended" campaigns={ended} />
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  campaigns,
}: {
  title: string;
  campaigns: Awaited<ReturnType<typeof listVisibleCampaigns>>["campaigns"];
}) {
  if (campaigns.length === 0) return null;
  return (
    <section>
      <h2 className="font-mono text-[11px] tracking-[0.16em] text-faint uppercase">{title}</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {campaigns.map((campaign) => (
          <li key={campaign.teamId}>
            <Link
              href={`/wellbeing/admin/campaigns/${campaign.teamId}`}
              className="pulse-focus flex flex-col gap-3 rounded-2xl border border-[rgba(31,78,95,0.16)] bg-paper p-5 transition-colors hover:border-pulse sm:flex-row sm:items-center sm:gap-6"
            >
              <div className="min-w-0 flex-1">
                <p className="font-display text-[1.05rem] font-semibold text-ink">
                  {campaign.name}
                </p>
                <p className="mt-1 text-sm text-slate">
                  {campaign.organizationName}
                  {campaign.questionnaireName ? ` · ${campaign.questionnaireName}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-5">
                <span className="font-mono text-xs text-slate tabular-nums">
                  {campaign.completed} of {campaign.joined} completed
                </span>
                <LifecycleChip lifecycle={campaign.lifecycle} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
