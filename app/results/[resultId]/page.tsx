import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { PageContainer } from "@/components/layout/PageContainer";
import { GlowPulse } from "@/components/motion/GlowPulse";
import { MotionSection } from "@/components/motion/MotionSection";
import { ResultHero } from "@/components/results/ResultHero";
import { ScoreBreakdown } from "@/components/results/ScoreBreakdown";
import { InsightSection } from "@/components/results/InsightSection";
import { StrengthsList } from "@/components/results/StrengthsList";
import { BlindSpotsList } from "@/components/results/BlindSpotsList";
import { CommunicationGuide } from "@/components/results/CommunicationGuide";
import { CommunicationStylePanel } from "@/components/results/CommunicationStylePanel";
import { ConflictResponsePanel } from "@/components/results/ConflictResponsePanel";
import { MotivationPanel } from "@/components/results/MotivationPanel";
import { GrowthPanel } from "@/components/results/GrowthPanel";
import { LeadershipStylePanel } from "@/components/results/LeadershipStylePanel";
import { StressResponsePanel } from "@/components/results/StressResponsePanel";
import { IdealEnvironmentPanel } from "@/components/results/IdealEnvironmentPanel";
import { ComplementaryTypes } from "@/components/results/ComplementaryTypes";
import { ShareActions } from "@/components/results/ShareActions";
import { insightMap } from "@/data/insight-maps";
import { db } from "@/lib/mock-db/client";
import type { Result } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your profile",
};

export default async function ResultPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const { resultId } = await params;
  const result = (await db.result.findUnique({
    where: { id: resultId },
  })) as Result | null;
  if (!result) notFound();

  const insight = insightMap[result.archetypeCode];

  return (
    <>
      <SiteHeader />
      <main className="relative flex-1 overflow-hidden">
        <div aria-hidden className="atlas-grid absolute inset-0 max-h-[720px]" />
        <GlowPulse className="-top-48 left-1/2 -translate-x-1/2" size={680} />

        <PageContainer className="relative flex flex-col gap-20 py-16 sm:py-20">
          <ResultHero result={result} insight={insight} />

          <MotionSection as="div">
            <ScoreBreakdown result={result} />
          </MotionSection>

          <MotionSection>
            <InsightSection
              eyebrow="Strengths"
              title="Where you create outsized value"
            >
              <StrengthsList strengths={insight.strengths} />
            </InsightSection>
          </MotionSection>

          <MotionSection>
            <InsightSection
              eyebrow="Blind spots"
              title="Where your strengths overreach"
              description="These are not flaws — they are your strengths applied at the wrong dose or the wrong moment."
            >
              <BlindSpotsList blindSpots={insight.blindSpots} />
            </InsightSection>
          </MotionSection>

          <MotionSection>
            <InsightSection
              eyebrow="Your voice"
              title="How you communicate"
            >
              <CommunicationStylePanel
                communicationStyle={insight.communicationStyle}
              />
            </InsightSection>
          </MotionSection>

          <MotionSection>
            <InsightSection
              eyebrow="Working with you"
              title="How to communicate with you"
              description="Share this with colleagues — it's the fastest way to make your style an asset instead of a surprise."
            >
              <CommunicationGuide communication={insight.communication} />
            </InsightSection>
          </MotionSection>

          <MotionSection>
            <InsightSection eyebrow="Leadership" title="How you lead">
              <LeadershipStylePanel leadershipStyle={insight.leadershipStyle} />
            </InsightSection>
          </MotionSection>

          <MotionSection>
            <InsightSection
              eyebrow="Conflict"
              title="How you respond to conflict"
            >
              <ConflictResponsePanel conflictResponse={insight.conflictResponse} />
            </InsightSection>
          </MotionSection>

          <MotionSection>
            <InsightSection
              eyebrow="Motivation"
              title="What fuels you — and what depletes you"
            >
              <MotivationPanel
                motivators={insight.motivators}
                drainers={insight.drainers}
              />
            </InsightSection>
          </MotionSection>

          <MotionSection>
            <InsightSection
              eyebrow="Under pressure"
              title="Your stress response"
              description="Pressure doesn't change who you are — it concentrates it. Know the triggers, name the behaviors, use the recovery."
            >
              <StressResponsePanel stressResponse={insight.stressResponse} />
            </InsightSection>
          </MotionSection>

          <MotionSection>
            <InsightSection
              eyebrow="Environment"
              title="Where you do your best work"
            >
              <IdealEnvironmentPanel idealEnvironment={insight.idealEnvironment} />
            </InsightSection>
          </MotionSection>

          <MotionSection>
            <InsightSection eyebrow="Growth" title="Where to grow next">
              <GrowthPanel coaching={insight.coaching} />
            </InsightSection>
          </MotionSection>

          <MotionSection>
            <InsightSection
              eyebrow="Complementary types"
              title="Who completes your blind side"
            >
              <ComplementaryTypes
                complementaryTypes={insight.complementaryTypes}
              />
            </InsightSection>
          </MotionSection>

          <ShareActions />
        </PageContainer>
      </main>
      <SiteFooter />
    </>
  );
}
