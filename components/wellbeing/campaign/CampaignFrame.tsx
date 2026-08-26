import {
  describeCurrentPeriod,
  loadCampaignParticipation,
  type CampaignIdentity,
} from "@/lib/wellbeing/campaign-workspace";
import { CampaignHeader, CampaignNav, type CampaignTab } from "./CampaignChrome";

/**
 * The campaign chrome around a tab that has no figures to draw.
 *
 * A tab the viewer may not read, or a campaign with no instrument yet, still
 * gets the same header and the same navigation — the explanation belongs
 * inside the workspace rather than replacing it. Dropping the chrome would
 * strand a facilitator on a page with no way back to their own campaign.
 */
export async function CampaignFrame({
  identity,
  tab,
  children,
}: {
  identity: CampaignIdentity;
  tab: CampaignTab;
  children: React.ReactNode;
}) {
  const participation = await loadCampaignParticipation(identity.id, identity.instrumentKey);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <CampaignHeader
        identity={identity}
        period={describeCurrentPeriod(
          participation.waves.map((wave) => wave.label),
          new Date(),
        )}
        participation={participation.participation}
        completed={participation.completed}
        invited={participation.invited}
      />
      <div className="mt-7">
        <CampaignNav active={tab} campaignId={identity.id} canReport={identity.canReport} />
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
