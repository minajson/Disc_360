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
      "Keep organizations, teams and campaigns separated per engagement — with access that ends when the engagement does.",
  },
  {
    title: "Campaigns that run themselves",
    detail:
      "Deadlines, invitations and reminders are automatic. You arrive at the debrief with completion already at ninety percent.",
  },
  {
    title: "Debriefs on the big screen",
    detail:
      "Presentation mode walks the room through culture, gaps and pairings — large type, keyboard navigation, QR for participants.",
  },
  {
    title: "Reports that survive the session",
    detail:
      "Every participant keeps a personal report; every leader keeps the team map and action plan. Your session compounds.",
  },
];

export default function CoachesPage() {
  return (
    <>
      <PageIntro
        eyebrow="For coaches and consultants"
        title="Run DISC debriefs clients remember — and renew."
        lead="DISC360 handles the logistics of assessment campaigns so your time goes where it's valuable: the conversation in the room."
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
            description="DISC360 supports development conversations. It is explicitly not a hiring filter, a clinical measure or a performance verdict — and the product language keeps it that way, protecting you and your clients."
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
