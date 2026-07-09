import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { PageContainer } from "@/components/layout/PageContainer";
import { MotionSection } from "@/components/motion/MotionSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { TeamHeader } from "@/components/team/TeamHeader";
import { TeamQuadrantMap } from "@/components/team/TeamQuadrantMap";
import { CompositionBreakdown } from "@/components/team/CompositionBreakdown";
import { TeamRoster } from "@/components/team/TeamRoster";
import { TeamInsightsPanel } from "@/components/team/TeamInsightsPanel";
import { getTeamOverview } from "@/lib/insights/team";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team",
  description:
    "Team composition across Dominant, Influence, Stable, and Analytical — quadrant map, roster, and coverage insights.",
};

export default async function TeamPage() {
  const overview = await getTeamOverview();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <PageContainer className="flex flex-col gap-12 py-14 sm:py-16">
          {overview ? (
            <>
              <TeamHeader overview={overview} />

              <MotionSection as="div">
                <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
                  <TeamQuadrantMap members={overview.members} />
                  <CompositionBreakdown
                    composition={overview.composition}
                    averages={overview.averages}
                    memberCount={overview.members.length}
                  />
                </div>
              </MotionSection>

              <MotionSection as="div">
                <TeamInsightsPanel insights={overview.insights} />
              </MotionSection>

              <MotionSection as="div">
                <div className="flex flex-col gap-6">
                  <h2 className="font-display text-2xl font-semibold tracking-tight">
                    Roster
                  </h2>
                  <TeamRoster members={overview.members} />
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
