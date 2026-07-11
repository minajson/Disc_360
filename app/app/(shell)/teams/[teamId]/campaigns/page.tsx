import type { Metadata } from "next";
import { requireTeamAdmin } from "@/lib/auth/guards";
import {
  archiveCampaign,
  closeCampaign,
  launchCampaign,
  reopenCampaign,
  sendCampaignReminders,
} from "@/lib/actions/campaigns";
import { CreateCampaignForm } from "@/components/teams/CampaignForms";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Campaigns" };

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

const statusStyles: Record<string, string> = {
  draft: "bg-sand text-ink",
  scheduled: "bg-disc-i-soft text-disc-i",
  active: "bg-disc-s-soft text-disc-s",
  closed: "bg-disc-c-soft text-disc-c",
  archived: "bg-ink/5 text-faint",
};

function ActionButton({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "danger" }) {
  return (
    <button
      type="submit"
      className={cn(
        "rounded-full border border-hairline px-3.5 py-1.5 text-xs text-slate transition-colors",
        tone === "danger"
          ? "hover:border-disc-d hover:text-disc-d"
          : "hover:border-botanical hover:text-botanical",
      )}
    >
      {label}
    </button>
  );
}

export default async function TeamCampaignsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { supabase } = await requireTeamAdmin(teamId);

  const { data: campaigns } = await supabase
    .from("assessment_campaigns")
    .select("id, name, status, starts_at, deadline_at, invitation_message, campaign_assignments (status)")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  return (
    <>
      <section aria-labelledby="campaigns-heading" className="flex flex-col gap-4">
        <h2 id="campaigns-heading" className="font-display text-h3 font-semibold">
          Campaigns
        </h2>

        {(campaigns ?? []).length > 0 ? (
          <div className="flex flex-col gap-4">
            {(campaigns ?? []).map((campaign) => {
              const assignments = campaign.campaign_assignments ?? [];
              const completed = assignments.filter((a) => a.status === "completed").length;
              const started = assignments.filter((a) => a.status === "started").length;
              const invited = assignments.length;
              const completion = invited > 0 ? Math.round((completed / invited) * 100) : 0;

              return (
                <article key={campaign.id} className="paper-card flex flex-col gap-4 p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-display text-base font-semibold text-ink">
                      {campaign.name}
                    </h3>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wide",
                        statusStyles[campaign.status] ?? "bg-ink/5 text-faint",
                      )}
                    >
                      {campaign.status}
                    </span>
                    <span className="ml-auto font-mono text-[11px] text-faint">
                      {formatDate(campaign.starts_at)} → {formatDate(campaign.deadline_at)}
                    </span>
                  </div>

                  {invited > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between font-mono text-[11px] text-faint">
                        <span>
                          {completed} completed · {started} started · {invited} invited
                        </span>
                        <span>{completion}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/8" role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100} aria-label={`${campaign.name} completion`}>
                        <div
                          className="h-full rounded-full bg-botanical"
                          style={{ width: `${completion}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate">
                      Not launched yet — launching assigns every roster member.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {(campaign.status === "draft" || campaign.status === "scheduled") && (
                      <form action={launchCampaign.bind(null, teamId, campaign.id)}>
                        <ActionButton label="Launch & invite" />
                      </form>
                    )}
                    {campaign.status === "active" && (
                      <>
                        <form action={sendCampaignReminders.bind(null, teamId, campaign.id)}>
                          <ActionButton label="Send reminders" />
                        </form>
                        <form action={closeCampaign.bind(null, teamId, campaign.id)}>
                          <ActionButton label="Close" />
                        </form>
                      </>
                    )}
                    {campaign.status === "closed" && (
                      <form action={reopenCampaign.bind(null, teamId, campaign.id)}>
                        <ActionButton label="Reopen" />
                      </form>
                    )}
                    {campaign.status !== "archived" && (
                      <form action={archiveCampaign.bind(null, teamId, campaign.id)}>
                        <ActionButton label="Archive" tone="danger" />
                      </form>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="paper-card p-7 text-sm text-slate">
            No campaigns yet — create your first below.
          </div>
        )}
      </section>

      <section aria-labelledby="new-campaign-heading" className="paper-card flex flex-col gap-4 p-7">
        <h2 id="new-campaign-heading" className="font-display text-base font-semibold">
          New campaign
        </h2>
        <CreateCampaignForm teamId={teamId} />
      </section>
    </>
  );
}
