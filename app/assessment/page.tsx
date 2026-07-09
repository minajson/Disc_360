import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { PageContainer } from "@/components/layout/PageContainer";
import { GlowPulse } from "@/components/motion/GlowPulse";
import { AssessmentIntro } from "@/components/assessment/AssessmentIntro";

export const metadata: Metadata = {
  title: "Assessment",
  description:
    "Take the Disc360 assessment — 24 forced-choice decisions, about seven minutes, one precise behavioral profile.",
};

export default function AssessmentPage() {
  return (
    <>
      <SiteHeader />
      <main className="relative flex-1 overflow-hidden">
        <div aria-hidden className="atlas-grid absolute inset-0" />
        <GlowPulse className="-top-48 left-1/2 -translate-x-1/2" size={640} />
        <PageContainer className="relative py-20 sm:py-24">
          <AssessmentIntro />
        </PageContainer>
      </main>
      <SiteFooter />
    </>
  );
}
