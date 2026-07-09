import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { PageContainer } from "@/components/layout/PageContainer";
import { MotionSection } from "@/components/motion/MotionSection";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { HeroSection } from "@/components/landing/HeroSection";
import { TrustBar } from "@/components/landing/TrustBar";
import { DimensionShowcase } from "@/components/landing/DimensionShowcase";
import { ValuePropsGrid } from "@/components/landing/ValuePropsGrid";
import { ResultPreviewPanel } from "@/components/landing/ResultPreviewPanel";
import { AudienceSplit } from "@/components/landing/AudienceSplit";
import { FinalCTA } from "@/components/landing/FinalCTA";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <HeroSection />
        <TrustBar />

        <MotionSection>
          <PageContainer className="flex flex-col gap-12 py-24 sm:py-28">
            <SectionHeading
              eyebrow="The four dimensions"
              title="One framework, four ways people move through the world"
              description="Every profile is a blend of Dominant, Influence, Stable, and Analytical energy. Explore what each dimension governs — and what it looks like under pressure."
            />
            <DimensionShowcase />
          </PageContainer>
        </MotionSection>

        <MotionSection>
          <PageContainer className="flex flex-col gap-12 border-t border-line py-24 sm:py-28">
            <SectionHeading
              eyebrow="Why Disc360"
              title="From seven minutes of choices to a working advantage"
              description="Built for individuals who want self-command, and for the coaches, HR leaders, and teams responsible for making people work well together."
            />
            <ValuePropsGrid />
          </PageContainer>
        </MotionSection>

        <MotionSection>
          <PageContainer className="flex flex-col gap-12 border-t border-line py-24 sm:py-28">
            <SectionHeading
              eyebrow="The report"
              title="An executive-grade profile, not a quiz result"
              description="Normalized scores across all four dimensions, your archetype, and the exact charts your report is built from — live below."
            />
            <ResultPreviewPanel />
          </PageContainer>
        </MotionSection>

        <MotionSection>
          <PageContainer className="flex flex-col gap-12 border-t border-line py-24 sm:py-28">
            <SectionHeading
              eyebrow="Who it's for"
              title="Individual clarity. Organizational leverage."
            />
            <AudienceSplit />
          </PageContainer>
        </MotionSection>

        <FinalCTA />
      </main>
      <SiteFooter />
    </>
  );
}
