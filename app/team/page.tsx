import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { PageContainer } from "@/components/layout/PageContainer";
import { MotionSection } from "@/components/motion/MotionSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TeamHeader } from "@/components/team/TeamHeader";
import { TeamExplorer } from "@/components/team/TeamExplorer";
import { CompositionBreakdown } from "@/components/team/CompositionBreakdown";
import { TeamInsightsPanel } from "@/components/team/TeamInsightsPanel";
import { CommunicationGapsPanel } from "@/components/team/CommunicationGapsPanel";
import { RiskZonesPanel } from "@/components/team/RiskZonesPanel";
import { TeamActionsPanel } from "@/components/team/TeamActionsPanel";
import { getTeamOverview } from "@/lib/insights/team";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team",
  description:
    "Team composition across Dominant, Influence, Stable, and Analytical — quadrant map, culture summary, communication gaps, risk zones, and coach recommendations.",
};

export default async function TeamPage() {
  const overview = await getTeamOverview();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <PageContainer className="flex flex-col gap-14 py-14 sm:py-16">
          {overview ? (
            <>
              <TeamHeader overview={overview} />

              <MotionSection as="div">
                <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
                  <TeamExplorer
                    members={overview.members}
                    departments={overview.departments}
                  />
                  <div className="flex flex-col gap-5">
                    <CompositionBreakdown
                      composition={overview.composition}
                      averages={overview.averages}
                      memberCount={overview.members.length}
                    />
                    <TeamInsightsPanel insights={overview.insights} />
                  </div>
                </div>
              </MotionSection>

              <MotionSection>
                <div className="flex flex-col gap-8">
                  <SectionHeading
                    align="left"
                    eyebrow="Communication gaps"
                    title="Where styles talk past each other"
                    description="The style pairs on this roster with the highest translation cost — and the working agreements that bridge them."
                  />
                  <CommunicationGapsPanel gaps={overview.communicationGaps} />
                </div>
              </MotionSection>

              <MotionSection>
                <div className="flex flex-col gap-8">
                  <SectionHeading
                    align="left"
                    eyebrow="Risk zones"
                    title="Where this composition can fail"
                  />
                  <RiskZonesPanel riskZones={overview.riskZones} />
                </div>
              </MotionSection>

              <MotionSection>
                <div className="flex flex-col gap-8">
                  <SectionHeading
                    align="left"
                    eyebrow="Next moves"
                    title="Recommended actions"
                    description="Rule-based recommendations generated from this team's composition — for the team itself, and for whoever coaches it."
                  />
                  <TeamActionsPanel actions={overview.actions} />
                </div>
              </MotionSection>
            </>
          ) : (
            <EmptyState
              title="No team yet"
              description="Team intelligence appears once members complete their assessments."
              action={{ href: "/assessment", label: "Take the assessment" }}
            />
          )}
        </PageContainer>
      </main>
      <SiteFooter />
    </>
  );
}
