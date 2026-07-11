import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/PageIntro";
import { CtaBand } from "@/components/marketing/CtaBand";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { DimensionMark } from "@/components/ui/DimensionMark";
import { LinkButton } from "@/components/ui/LinkButton";
import { DiscRadarChart } from "@/components/charts/DiscRadarChart";
import { DimensionBarChart } from "@/components/charts/DimensionBarChart";
import { MotionSection } from "@/components/motion/MotionSection";

export const metadata: Metadata = {
  title: "For individuals",
  description:
    "Language for how you actually operate — your strengths, your pressure behavior, and how to be heard by people wired differently.",
};

const outcomes = [
  {
    title: "Name your operating style",
    detail:
      "Your archetype gives precise language for instincts you've been using blind — the way you push, persuade, steady or scrutinize.",
  },
  {
    title: "See your pressure behavior coming",
    detail:
      "Stress doesn't change who you are; it concentrates it. Know your triggers, your under-pressure defaults, and what actually restores you.",
  },
  {
    title: "Be heard by people wired differently",
    detail:
      "A do-and-don't guide for your style — and adaptation guidance for reaching each of the other three energies without losing yourself.",
  },
  {
    title: "Choose environments deliberately",
    detail:
      "Your ideal working conditions, spelled out — so role changes, team choices and job offers get evaluated against something real.",
  },
];

export default function IndividualsPage() {
  return (
    <>
      <PageIntro
        eyebrow="For individuals"
        title="Self-awareness you can actually use on Tuesday."
        lead="Not a label. A working profile of how you decide, communicate, lead and respond under pressure — with guidance specific enough to apply in your next hard conversation."
      >
        <LinkButton href="/sign-up" size="lg">
          Take the assessment
        </LinkButton>
      </PageIntro>

      <section className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="rule-t grid gap-10 py-14 lg:grid-cols-2">
          {outcomes.map((outcome, index) => (
            <MotionSection key={outcome.title} as="div" delay={index * 0.05}>
              <article className="flex flex-col gap-2.5">
                <h2 className="font-display text-h3 font-semibold">
                  {outcome.title}
                </h2>
                <p className="max-w-md text-sm leading-relaxed text-slate">
                  {outcome.detail}
                </p>
              </article>
            </MotionSection>
          ))}
        </div>
      </section>

      <section className="bg-mineral rule-t">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2">
          <SectionHeading
            eyebrow="A sample profile"
            title="What a finished profile looks like"
            description="A Dominant-Influence blend — 'The Catalyst'. Direct under pressure, persuasive in the room, impatient with slow consensus. The full report runs to twelve sections of guidance."
          />
          <div className="paper-card mx-auto grid w-full max-w-lg gap-8 p-8 sm:grid-cols-[0.9fr_1.1fr] sm:items-center">
            <DiscRadarChart scores={{ d: 77, i: 73, s: 23, c: 27 }} />
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <DimensionMark dimension="D" compact />
                <DimensionMark dimension="I" compact />
                <span className="ml-1 font-display text-base font-semibold">
                  The Catalyst
                </span>
              </div>
              <DimensionBarChart scores={{ d: 77, i: 73, s: 23, c: 27 }} />
            </div>
          </div>
        </div>
      </section>

      <CtaBand
        title="Seven minutes. No credit card."
        primary={{ href: "/sign-up", label: "Start your assessment" }}
        secondary={{ href: "/how-it-works", label: "How it works" }}
      />
    </>
  );
}
