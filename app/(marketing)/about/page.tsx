import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/PageIntro";
import { CtaBand } from "@/components/marketing/CtaBand";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LeadershipPortraitPlaceholder } from "@/components/media/LeadershipPortraitPlaceholder";
import { MotionSection } from "@/components/motion/MotionSection";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why DISC360 exists: practical behavioral intelligence, written humanely, used responsibly.",
};

const principles = [
  {
    title: "Practical over clinical",
    detail:
      "Every sentence in a DISC360 report should survive contact with a Tuesday morning. If guidance can't be used in a real conversation this week, it doesn't ship.",
  },
  {
    title: "Humane by default",
    detail:
      "Profiles describe strengths and their costs — never verdicts. People read their report and feel understood, not sorted.",
  },
  {
    title: "Honest about limits",
    detail:
      "DISC describes behavioral preference, not ability, values or character. We say so everywhere, and we design against misuse in hiring and clinical contexts.",
  },
  {
    title: "Privacy is structural",
    detail:
      "Individual answers stay individual. Anonymization is a first-class feature, and access rules are enforced in the database — not just the interface.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageIntro
        eyebrow="About DISC360"
        title="We build the conversation that teams keep postponing."
        lead="DISC360 exists because most workplace friction is a style mismatch nobody has language for — and because the tools that offer that language usually feel like paperwork."
      />

      <section className="mx-auto grid w-full max-w-7xl items-start gap-12 px-5 pb-20 sm:px-8 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="grid gap-10 sm:grid-cols-2">
          {principles.map((principle, index) => (
            <MotionSection key={principle.title} as="div" delay={index * 0.05}>
              <article className="flex flex-col gap-2.5">
                <span className="font-mono text-sm text-faint">0{index + 1}</span>
                <h2 className="font-display text-h3 font-semibold">
                  {principle.title}
                </h2>
                <p className="text-sm leading-relaxed text-slate">
                  {principle.detail}
                </p>
              </article>
            </MotionSection>
          ))}
        </div>
        <LeadershipPortraitPlaceholder
          label="Founding team portrait, warm natural light"
          className="mx-auto w-full max-w-sm"
        />
      </section>

      <section className="bg-mineral rule-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-20 sm:px-8">
          <SectionHeading
            eyebrow="The model we build on"
            title="Standing on sixty years of DISC"
            description="The DISC behavioral model has been used in workplace development since the 1960s. DISC360's contribution is the experience around it: honest assessment design, humane report writing, and team intelligence that turns profiles into decisions. We use the labels Dominant, Influence, Stable and Analytical throughout."
          />
        </div>
      </section>

      <CtaBand
        title="The best introduction is your own profile."
        primary={{ href: "/sign-up", label: "Take the assessment" }}
        secondary={{ href: "/contact", label: "Get in touch" }}
      />
    </>
  );
}
