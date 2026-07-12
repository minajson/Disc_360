import { MotionSection } from "@/components/motion/MotionSection";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { HomeHero } from "@/components/marketing/home/HomeHero";
import { TrustRow } from "@/components/marketing/home/TrustRow";
import { PathwaysSplit } from "@/components/marketing/home/PathwaysSplit";
import { DimensionsInteractive } from "@/components/marketing/home/DimensionsInteractive";
import { AssessmentPreviewSection } from "@/components/marketing/home/AssessmentPreviewSection";
import { ReportPreviewSection } from "@/components/marketing/home/ReportPreviewSection";
import { TeamPreviewSection } from "@/components/marketing/home/TeamPreviewSection";
import { AdaptationStory } from "@/components/marketing/home/AdaptationStory";
import { AudienceBand } from "@/components/marketing/home/AudienceBand";
import { CaseStudiesSection } from "@/components/marketing/home/CaseStudiesSection";
import { FinalConversion } from "@/components/marketing/home/FinalConversion";

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <TrustRow />
      <PathwaysSplit />

      <MotionSection>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-5 py-20 sm:px-8 lg:py-24">
          <SectionHeading
            index="01"
            eyebrow="The four dimensions"
            title="Four ways people move through work"
            description="Open each dimension to see what it governs — and what it looks like under pressure."
          />
          <DimensionsInteractive />
        </div>
      </MotionSection>

      <AssessmentPreviewSection />
      <ReportPreviewSection />
      <TeamPreviewSection />
      <AdaptationStory />
      <AudienceBand />
      <CaseStudiesSection />
      <FinalConversion />
    </>
  );
}
