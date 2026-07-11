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
      "Organizations hold teams; teams hold departments and campaigns. Organization admins manage users and teams across the whole account.",
  },
  {
    title: "Privacy by design",
    detail:
      "Individual answers are never exposed. Team reports can be fully anonymized. Access is enforced at the database layer with row-level security, not just hidden in the interface.",
  },
  {
    title: "Roles with real boundaries",
    detail:
      "Individuals, team members, team admins, coaches and organization admins each see exactly what their role permits — and administration actions are audit-logged.",
  },
  {
    title: "Adoption you can track",
    detail:
      "Campaign dashboards show invited, started and completed per team and department — with reminders that go out automatically before deadlines.",
  },
];

export default function OrganizationsPage() {
  return (
    <>
      <PageIntro
        eyebrow="For organizations"
        title="Behavioral development, run like a program — not a workshop."
        lead="For HR and L&D teams who need DISC across departments: structure, privacy controls, completion tracking and reporting that stands up to scrutiny."
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
            description="DISC360 is a development tool. We ask every customer to keep it out of hiring decisions and clinical contexts, and the product's language, exports and legal terms are written to support that boundary."
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
        lead="Most organizations pilot DISC360 with a single team's debrief. The map does the rest of the selling."
        primary={{ href: "/contact", label: "Contact us" }}
        secondary={{ href: "/teams", label: "See the team experience" }}
      />
    </>
  );
}
