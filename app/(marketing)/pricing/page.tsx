import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/PageIntro";
import { FaqList } from "@/components/marketing/FaqList";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LinkButton } from "@/components/ui/LinkButton";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free individual profiles. Team plans per member. Coach and enterprise workspaces on request.",
};

interface Tier {
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  cta: { href: string; label: string };
  featured?: boolean;
}

const tiers: Tier[] = [
  {
    name: "Individual",
    price: "Free",
    cadence: "forever",
    description: "Your complete profile and report — no credit card.",
    features: [
      "Full 24-scenario assessment",
      "Complete archetype report",
      "Printable and downloadable report",
      "Assessment history and retakes",
    ],
    cta: { href: "/sign-up", label: "Start free" },
  },
  {
    name: "Team",
    price: "$8",
    cadence: "per member · per month",
    description: "The team map, campaigns and the presentation room.",
    features: [
      "Everything in Individual, for every member",
      "Team culture map and quadrant",
      "Campaigns, deadlines and reminders",
      "Named or anonymized reporting",
      "Presentation mode and exports",
      "Department grouping and filters",
    ],
    cta: { href: "/sign-up?intent=team", label: "Create a team" },
    featured: true,
  },
  {
    name: "Coach & Enterprise",
    price: "Custom",
    cadence: "per engagement or per seat",
    description: "Multiple client workspaces, organizations and audit needs.",
    features: [
      "Everything in Team",
      "Multiple organizations and client workspaces",
      "Organization roles and audit logs",
      "Priority support and onboarding",
    ],
    cta: { href: "/contact", label: "Talk to us" },
  },
];

const faqs = [
  {
    question: "Is the individual assessment really free?",
    answer:
      "Yes — the full assessment, report and history, free. Team features are what we charge for, because that's where the coordination work lives.",
  },
  {
    question: "How does team billing work?",
    answer:
      "Per active member per month. Archived teams and members who leave stop counting. Annual billing with two months free is available on request.",
  },
  {
    question: "Do participants need a paid seat to take a team assessment?",
    answer:
      "No. Members join through your invitation and complete the assessment free; the team plan covers the team intelligence built on top.",
  },
  {
    question: "What happens to our data if we cancel?",
    answer:
      "You can export reports before closing the account, and request full deletion at any time — covered in our privacy policy.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PageIntro
        eyebrow="Pricing"
        title="Free for you. Fair for your team."
        lead="Individual self-awareness should never sit behind a paywall. Team intelligence pays for itself in the first meeting."
      />

      <section className="mx-auto grid w-full max-w-7xl gap-5 px-5 pb-20 sm:px-8 lg:grid-cols-3">
        {tiers.map((tier) => (
          <article
            key={tier.name}
            className={cn(
              "paper-card flex flex-col gap-6 p-8",
              tier.featured && "border-botanical shadow-[0_28px_48px_-30px_rgba(23,76,60,0.4)]",
            )}
          >
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">
                {tier.name}
              </span>
              <div className="flex items-baseline gap-2 pt-2">
                <span className="font-display text-4xl font-semibold tracking-tight">
                  {tier.price}
                </span>
                <span className="text-xs text-faint">{tier.cadence}</span>
              </div>
              <p className="pt-2 text-sm text-slate">{tier.description}</p>
            </div>
            <ul className="flex flex-col gap-2.5">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate">
                  <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" fill="none" stroke="var(--color-botanical)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 8.5 6.5 12 13 4.5" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            <LinkButton
              href={tier.cta.href}
              variant={tier.featured ? "primary" : "outline"}
              className="mt-auto"
            >
              {tier.cta.label}
            </LinkButton>
          </article>
        ))}
      </section>

      <section className="bg-mineral rule-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-20 sm:px-8">
          <SectionHeading eyebrow="Billing" title="Pricing questions" />
          <FaqList items={faqs} />
        </div>
      </section>
    </>
  );
}
