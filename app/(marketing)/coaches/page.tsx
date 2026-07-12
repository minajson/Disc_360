import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/PageIntro";
import { CtaBand } from "@/components/marketing/CtaBand";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LinkButton } from "@/components/ui/LinkButton";
import { LeadershipPortraitPlaceholder } from "@/components/media/LeadershipPortraitPlaceholder";
import { MotionSection } from "@/components/motion/MotionSection";

export const metadata: Metadata = {
  title: "For coaches",
  description:
    "Client workspaces, assessment campaigns and a presentation mode built for debriefs — DISC360 for coaches and consultants.",
};

const workflow = [
  {
    title: "One workspace per client",
    detail:
      "Organizations and teams separated per engagement.",
  },
  {
    title: "Campaigns that run themselves",
    detail:
      "Invitations and reminders are automatic — you arrive with completion done.",
  },
  {
    title: "Debriefs on the big screen",
    detail:
      "Large type, tabbed views, QR for participants.",
  },
  {
    title: "Reports that survive the session",
    detail:
      "Participants keep reports; leaders keep the map and plan.",
  },
];

export default function CoachesPage() {
  return (
    <>
      <PageIntro
        eyebrow="For coaches and consultants"
        title="Run DISC debriefs clients remember — and renew."
        lead="DISC360 handles the logistics; your time goes to the conversation in the room."
      >
        <LinkButton href="/sign-up?intent=coach" size="lg">
          Set up a coaching workspace
        </LinkButton>
      </PageIntro>

      <section className="mx-auto grid w-full max-w-7xl items-start gap-12 px-5 pb-20 sm:px-8 lg:grid-cols-[0.7fr_1.3fr]">
        <LeadershipPortraitPlaceholder className="mx-auto w-full max-w-sm lg:sticky lg:top-24" />
        <div className="grid gap-10 sm:grid-cols-2">
          {workflow.map((item, index) => (
            <MotionSection key={item.title} as="div" delay={index * 0.05}>
              <article className="flex flex-col gap-2.5">
                <span className="font-mono text-sm text-faint">0{index + 1}</span>
                <h2 className="font-display text-h3 font-semibold">{item.title}</h2>
                <p className="text-sm leading-relaxed text-slate">{item.detail}</p>
              </article>
            </MotionSection>
          ))}
        </div>
      </section>

      <section className="bg-mineral rule-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-20 sm:px-8">
          <SectionHeading
            eyebrow="Professional boundaries"
            title="Built to be used responsibly"
            description="Not a hiring filter, clinical measure or performance verdict — the product language keeps it that way."
          />
        </div>
      </section>

      <CtaBand
        title="Bring it to your next engagement."
        primary={{ href: "/sign-up?intent=coach", label: "Start a workspace" }}
        secondary={{ href: "/contact", label: "Talk to us" }}
      />
    </>
  );
}
