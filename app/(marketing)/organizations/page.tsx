import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/PageIntro";
import { CtaBand } from "@/components/marketing/CtaBand";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LinkButton } from "@/components/ui/LinkButton";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import { MotionSection } from "@/components/motion/MotionSection";

export const metadata: Metadata = {
  title: "For organizations",
  description:
    "Departments, roles, anonymization and audit trails — DISC360 for HR and L&D teams running behavioral development at scale.",
};

const pillars = [
  {
    title: "Structure that matches yours",
    detail:
      "Organizations hold teams and departments; admins manage the whole account.",
  },
  {
    title: "Privacy by design",
    detail:
      "Answers are never exposed; reports can be anonymized; access is enforced at the database layer.",
  },
  {
    title: "Roles with real boundaries",
    detail:
      "Every role sees exactly what it permits, and admin actions are audit-logged.",
  },
  {
    title: "Adoption you can track",
    detail:
      "Invited, started and completed per team — with automatic reminders.",
  },
];

export default function OrganizationsPage() {
  return (
    <>
      <PageIntro
        eyebrow="For organizations"
        title="Behavioral development, run like a program — not a workshop."
        lead="Structure, privacy controls and tracking that stands up to scrutiny."
      >
        <LinkButton href="/contact" size="lg">
          Talk to us about your organization
        </LinkButton>
      </PageIntro>

      <section className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="rule-t grid gap-10 py-14 lg:grid-cols-2">
          {pillars.map((pillar, index) => (
            <MotionSection key={pillar.title} as="div" delay={index * 0.05}>
              <article className="flex flex-col gap-2.5">
                <h2 className="font-display text-h3 font-semibold">{pillar.title}</h2>
                <p className="max-w-md text-sm leading-relaxed text-slate">
                  {pillar.detail}
                </p>
              </article>
            </MotionSection>
          ))}
        </div>
      </section>

      <section className="bg-mineral rule-t">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2">
          <SectionHeading
            eyebrow="A responsible instrument"
            title="Clear about what it is — and is not"
            description="A development tool — kept out of hiring and clinical contexts by design and by our terms."
          />
          <MediaPlaceholder
            label="Leadership workshop in a bright conference room"
            ratio="3/2"
            kind="photo"
            dimensions="1600×1067"
            mask="organic"
            className="mx-auto w-full max-w-xl"
          />
        </div>
      </section>

      <CtaBand
        title="Start with one department."
        lead="Pilot with one team's debrief — the map does the rest."
        primary={{ href: "/contact", label: "Contact us" }}
        secondary={{ href: "/teams", label: "See the team experience" }}
      />
    </>
  );
}
