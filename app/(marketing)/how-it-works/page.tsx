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
      "Each scenario offers four workplace behaviors. You choose the one MOST like you, then the one LEAST like you. Forced choice keeps the profile honest — there are no right answers to perform.",
  },
  {
    title: "Scores become a profile",
    detail:
      "Your choices are tallied per dimension, normalized to a 0–100 scale, and matched to one of 13 behavioral archetypes — pure styles, hybrid blends, or the balanced Integrator.",
  },
  {
    title: "The profile becomes guidance",
    detail:
      "Every archetype carries a full working document: communication style, adaptation guidance, conflict response, motivators, stressors, blind spots and growth recommendations.",
  },
  {
    title: "Profiles become a team map",
    detail:
      "When a team completes the assessment, DISC360 maps the composition — where styles cluster, where friction is likely, which pairings complement — and turns it into an action plan.",
  },
];

const faqs = [
  {
    question: "What does DISC360 actually measure?",
    answer:
      "Observable behavioral preferences across four dimensions — Dominant, Influence, Stable and Analytical. It describes how you tend to communicate, decide and respond to pressure. It does not measure intelligence, ability, values or mental health.",
  },
  {
    question: "Is this a scientifically validated clinical instrument?",
    answer:
      "DISC360 is a self-awareness and team-development tool built on the widely used DISC behavioral model. It is deliberately not a medical, clinical or employment-selection instrument, and we ask organizations not to use it as one.",
  },
  {
    question: "Can my answers change over time?",
    answer:
      "Yes. Behavior shifts with roles, seasons and context. Profiles are dated, history is kept, and we recommend re-assessing every six to twelve months or after a significant role change.",
  },
  {
    question: "Who can see my individual results?",
    answer:
      "You. Team summaries only include your named profile when the team's visibility setting allows it — and administrators can run fully anonymized team reports. Your raw answers are never shown to anyone.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageIntro
        eyebrow="How it works"
        title="Seven minutes of choices. A working document for years."
        lead="DISC360 turns a short forced-choice assessment into practical behavioral guidance — grounded in the DISC model, written like a good coach."
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
            description="Dominant and Stable answer how you handle pace and power. Influence and Analytical answer how you handle people and proof. Your profile is where you sit on the whole spectrum — not a box."
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
