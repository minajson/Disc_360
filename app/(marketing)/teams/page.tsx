import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/PageIntro";
import { CtaBand } from "@/components/marketing/CtaBand";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LinkButton } from "@/components/ui/LinkButton";
import { TeamCultureMapScene } from "@/components/media/TeamCultureMapScene";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import { MotionSection } from "@/components/motion/MotionSection";

export const metadata: Metadata = {
  title: "For teams",
  description:
    "Invite your team, track completion, and get a culture map a manager can act on — named or anonymized.",
};

const adminFeatures = [
  "Invite by link, team code, email or CSV upload",
  "Campaigns with start dates, deadlines and automatic reminders",
  "Live tracking: invited, started, completed",
  "Named or anonymized results — decided by you, per team",
  "Department grouping and filters",
  "A presentation mode built for the conference room",
];

const setupSteps = [
  {
    title: "Create the team",
    detail: "Name it, describe it, set the department and how results may be viewed.",
  },
  {
    title: "Invite members",
    detail: "Share one link, send email invitations, or upload a CSV. Track every status.",
  },
  {
    title: "Run the campaign",
    detail: "Set a deadline; DISC360 nudges the stragglers so you don't have to.",
  },
  {
    title: "Read the map together",
    detail: "The culture map, friction points and action plan — on screen, in one meeting.",
  },
];

export default function TeamsPage() {
  return (
    <>
      <PageIntro
        eyebrow="For teams"
        title="Your team's culture, mapped in one afternoon."
        lead="Most team friction is a style mismatch nobody has language for. DISC360 gives the whole team the same vocabulary — and gives you the map."
      >
        <LinkButton href="/sign-up?intent=team" size="lg">
          Create a team
        </LinkButton>
      </PageIntro>

      <section className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
        <TeamCultureMapScene className="mx-auto w-full max-w-xl" />
        <div className="flex flex-col gap-6">
          {setupSteps.map((step, index) => (
            <MotionSection key={step.title} as="div" delay={index * 0.05}>
              <article className="flex gap-5">
                <span className="font-mono text-sm text-faint">0{index + 1}</span>
                <div className="flex flex-col gap-1">
                  <h2 className="font-display text-lg font-semibold">{step.title}</h2>
                  <p className="max-w-sm text-sm leading-relaxed text-slate">
                    {step.detail}
                  </p>
                </div>
              </article>
            </MotionSection>
          ))}
        </div>
      </section>

      <section className="bg-mineral rule-t">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2">
          <div className="flex flex-col gap-8">
            <SectionHeading
              eyebrow="Built for administrators"
              title="Everything between 'good idea' and 'everyone actually did it'"
            />
            <ul className="flex flex-col gap-3">
              {adminFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm leading-relaxed text-slate">
                  <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" fill="none" stroke="var(--color-botanical)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 8.5 6.5 12 13 4.5" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <MediaPlaceholder
            label="Team working together around a table, warm natural light"
            ratio="3/2"
            kind="photo"
            dimensions="1600×1067"
            mask="organic"
            className="mx-auto w-full max-w-xl"
          />
        </div>
      </section>

      <CtaBand
        title="The map is free to start."
        lead="Create the team, invite three colleagues, and see the first composition read today."
        primary={{ href: "/sign-up?intent=team", label: "Create a team" }}
        secondary={{ href: "/pricing", label: "Team pricing" }}
      />
    </>
  );
}
