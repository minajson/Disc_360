import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/PageIntro";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How DISC360 collects, uses, protects and deletes your data.",
};

const sections = [
  {
    heading: "What we collect",
    body: [
      "Account data: your name, email address, and optional profile details (role, country, timezone) provided during onboarding.",
      "Assessment data: your answers to assessment scenarios, computed scores, and the resulting behavioral profile.",
      "Team data: team membership, invitation status, and — where a team administrator enables named reporting — your profile's inclusion in team summaries.",
      "Technical data: authentication events and security-relevant actions, kept in audit logs.",
    ],
  },
  {
    heading: "How we use it",
    body: [
      "To compute and present your behavioral profile and reports; to operate team features you or your team administrator enable; to send the emails you have consented to receive; and to keep the platform secure.",
      "We do not sell personal data. We do not use assessment answers for advertising.",
    ],
  },
  {
    heading: "What we deliberately protect",
    body: [
      "Your individual answers are never shown to other users — including team administrators. Team reports are built from computed profiles, and can be fully anonymized at the team administrator's choice.",
      "Access rules are enforced at the database layer (row-level security), not only in the interface.",
    ],
  },
  {
    heading: "What DISC360 is not",
    body: [
      "DISC360 is a self-awareness and team-development tool. It is not a medical or psychological-clinical instrument, and it must not be used for employment selection. Reports describe behavioral preference, not ability or character.",
    ],
  },
  {
    heading: "Consent and communication preferences",
    body: [
      "During onboarding you record consent to data processing. Non-essential email (reminders, team updates, product news) is controlled by notification preferences you can change at any time; essential account email (verification, password reset) is always delivered.",
    ],
  },
  {
    heading: "Retention, export and deletion",
    body: [
      "Assessment history is kept while your account exists so you can track change over time. You may request a full export of your data, and you may request account deletion — both from your settings page. Deletion removes personal data and anonymizes any team aggregates your profile contributed to.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Privacy questions and requests: hello@disc360.app. We respond within two business days.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <PageIntro
        eyebrow="Legal"
        title="Privacy policy"
        lead="Written to be read. The short version: your answers stay yours, anonymization is real, and you can leave with your data."
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 pb-24 sm:px-8">
        {sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-3">
            <h2 className="font-display text-h3 font-semibold">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="text-sm leading-relaxed text-slate">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        <p className="rule-t pt-6 font-mono text-xs text-faint">
          Last updated July 2026.
        </p>
      </div>
    </>
  );
}
