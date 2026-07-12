import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/PageIntro";
import { FaqList } from "@/components/marketing/FaqList";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LinkButton } from "@/components/ui/LinkButton";
import { PurchaseTeamPlanButton } from "@/components/marketing/PurchaseTeamPlan";
import { createSupabaseServerClient } from "@/lib/db/server";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free individual profiles. Teams for $8. Enterprise on request.",
};

const individualFeatures = [
  "Personal assessment",
  "Individual dashboard",
  "PDF report",
  "Email report",
];

const teamFeatures = [
  "Create a team",
  "Participant invitations",
  "Submission tracking",
  "Team dashboard",
  "Live presentation mode",
  "Individual PDF reports",
  "Team summary export",
];

const enterpriseFeatures = [
  "Everything in Team",
  "Multiple client workspaces",
  "Roles and audit logs",
  "Priority support",
];

const faqs = [
  {
    question: "Is the individual assessment really free?",
    answer: "Yes — assessment, report and history, free forever.",
  },
  {
    question: "What does $8 buy?",
    answer:
      "One team: unlimited participant invitations, live tracking, the presentation dashboard and exports.",
  },
  {
    question: "Do participants pay?",
    answer: "No. Members complete the assessment free through your invitation.",
  },
];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; error?: string }>;
}) {
  const { intent, error } = await searchParams;
  const createTeamIntent = intent === "create-team";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <PageIntro
        eyebrow="Pricing"
        title="Free for you. $8 for your team."
        lead="Individual self-awareness is free. The team map pays for itself in one meeting."
      />

      {createTeamIntent ? (
        <div className="mx-auto w-full max-w-7xl px-5 pb-10 sm:px-8">
          <div className="paper-card flex flex-wrap items-center justify-between gap-5 border-botanical p-6 sm:p-7">
            <div className="flex max-w-xl flex-col gap-1">
              <h2 className="font-display text-lg font-semibold">
                Creating a team requires the Team plan
              </h2>
              <p className="text-sm text-slate">
                One payment of $8 unlocks this team: invitations, live
                tracking, the presentation dashboard and every participant&rsquo;s
                PDF report.
              </p>
              {error ? (
                <p role="alert" className="text-sm text-disc-d">
                  The purchase didn&rsquo;t complete — please try again.
                </p>
              ) : null}
            </div>
            {user ? (
              <PurchaseTeamPlanButton size="lg" />
            ) : (
              <LinkButton href="/sign-up?intent=team" size="lg">
                Create an account to continue
              </LinkButton>
            )}
          </div>
        </div>
      ) : null}

      <section className="mx-auto grid w-full max-w-7xl gap-5 px-5 pb-20 sm:px-8 lg:grid-cols-3">
        {/* Individual */}
        <article className="paper-card flex flex-col gap-6 p-8">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">
              Individual
            </span>
            <div className="flex items-baseline gap-2 pt-2">
              <span className="font-display text-4xl font-semibold tracking-tight">Free</span>
              <span className="text-xs text-faint">forever</span>
            </div>
          </div>
          <FeatureList features={individualFeatures} />
          <LinkButton href="/sign-up" variant="outline" className="mt-auto">
            Start free
          </LinkButton>
        </article>

        {/* Team */}
        <article className="paper-card flex flex-col gap-6 border-botanical p-8 shadow-[0_28px_48px_-30px_rgba(23,76,60,0.4)]">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">
              Team
            </span>
            <div className="flex items-baseline gap-2 pt-2">
              <span className="font-display text-4xl font-semibold tracking-tight">$8</span>
              <span className="text-xs text-faint">per team, one-time</span>
            </div>
          </div>
          <FeatureList features={teamFeatures} />
          <div className="mt-auto">
            {user ? (
              <PurchaseTeamPlanButton />
            ) : (
              <LinkButton href="/sign-up?intent=team">Create a team</LinkButton>
            )}
          </div>
        </article>

        {/* Enterprise */}
        <article className="paper-card flex flex-col gap-6 p-8">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">
              Coach & Enterprise
            </span>
            <div className="flex items-baseline gap-2 pt-2">
              <span className="font-display text-4xl font-semibold tracking-tight">Custom</span>
            </div>
          </div>
          <FeatureList features={enterpriseFeatures} />
          <LinkButton href="/contact" variant="outline" className="mt-auto">
            Talk to us
          </LinkButton>
        </article>
      </section>

      <section className="bg-mineral rule-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-16 sm:px-8">
          <SectionHeading eyebrow="Billing" title="Pricing questions" />
          <FaqList items={faqs} />
        </div>
      </section>
    </>
  );
}

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {features.map((feature) => (
        <li key={feature} className={cn("flex items-start gap-2.5 text-sm text-slate")}>
          <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" fill="none" stroke="var(--color-botanical)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 8.5 6.5 12 13 4.5" />
          </svg>
          {feature}
        </li>
      ))}
    </ul>
  );
}
