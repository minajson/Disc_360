import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/PageIntro";
import { CtaBand } from "@/components/marketing/CtaBand";
import { FaqList } from "@/components/marketing/FaqList";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { DiscSpectrumScene } from "@/components/media/DiscSpectrumScene";
import { MotionSection } from "@/components/motion/MotionSection";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "From 24 forced-choice scenarios to a working behavioral profile — how DISC360 measures, scores and translates DISC into practical guidance.",
};

const steps = [
  {
    title: "Answer 24 honest scenarios",
    detail:
      "Four behaviors per scenario: pick MOST like you, then LEAST. Forced choice keeps it honest.",
  },
  {
    title: "Scores become a profile",
    detail:
      "Choices are tallied, normalized 0–100, and matched to one of 13 archetypes.",
  },
  {
    title: "The profile becomes guidance",
    detail:
      "Your report covers communication, conflict, pressure, motivators and growth.",
  },
  {
    title: "Profiles become a team map",
    detail:
      "Completed profiles become a team map: clusters, friction, pairings, action plan.",
  },
];

const faqs = [
  {
    question: "What does DISC360 actually measure?",
    answer:
      "Behavioral preferences across the four dimensions — not intelligence, ability, values or mental health.",
  },
  {
    question: "Is this a scientifically validated clinical instrument?",
    answer:
      "It is a development tool built on the DISC model — deliberately not a medical, clinical or hiring instrument.",
  },
  {
    question: "Can my answers change over time?",
    answer:
      "Yes — behavior shifts with roles and seasons. Re-assess every 6–12 months.",
  },
  {
    question: "Who can see my individual results?",
    answer:
      "You. Team summaries can be fully anonymized, and raw answers are never shown to anyone.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageIntro
        eyebrow="How it works"
        title="Seven minutes of choices. A working document for years."
        lead="A short forced-choice assessment, scored deterministically, written like a good coach."
      />

      <section className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="rule-t grid gap-10 py-14 lg:grid-cols-2">
          {steps.map((step, index) => (
            <MotionSection key={step.title} as="div" delay={index * 0.05}>
              <article className="flex gap-6">
                <span className="font-mono text-sm text-faint">0{index + 1}</span>
                <div className="flex flex-col gap-2.5">
                  <h2 className="font-display text-h3 font-semibold">{step.title}</h2>
                  <p className="max-w-md text-sm leading-relaxed text-slate">
                    {step.detail}
                  </p>
                </div>
              </article>
            </MotionSection>
          ))}
        </div>
      </section>

      <section className="bg-mineral rule-t">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading
            eyebrow="The model"
            title="One spectrum, four energies"
            description="Pace and power, people and proof — your profile is a position on the spectrum, not a box."
          />
          <DiscSpectrumScene className="mx-auto max-h-[440px] w-full max-w-2xl" />
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-20 sm:px-8">
        <SectionHeading eyebrow="Honest answers" title="Questions we get asked" />
        <FaqList items={faqs} />
      </section>

      <CtaBand
        title="See your own profile first."
        lead="The best way to evaluate DISC360 is your own report, seven minutes from now."
        primary={{ href: "/sign-up", label: "Take the assessment" }}
        secondary={{ href: "/pricing", label: "View pricing" }}
      />
    </>
  );
}
