import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/PageIntro";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The agreement covering your use of DISC360.",
};

const sections = [
  {
    heading: "The service",
    body: [
      "DISC360 provides behavioral self-assessment, individual reports, and team intelligence features built on the DISC behavioral model. Features vary by plan as described on the pricing page.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "You may not use DISC360 results as the basis for hiring, firing, promotion or other employment-selection decisions; as a medical, psychological or clinical evaluation; or to build discriminatory profiles of individuals.",
      "Team administrators must only invite people with a legitimate team relationship, and must respect members' visibility choices.",
    ],
  },
  {
    heading: "Your content and data",
    body: [
      "You retain ownership of your data. You grant DISC360 the license needed to operate the service — computing profiles, generating reports, and displaying team aggregates according to the visibility settings chosen.",
      "Privacy commitments, including anonymization and deletion rights, are described in the privacy policy, which forms part of these terms.",
    ],
  },
  {
    heading: "Accounts and security",
    body: [
      "You are responsible for the accuracy of your account information and the security of your credentials. Notify us promptly of suspected unauthorized access.",
    ],
  },
  {
    heading: "Disclaimers",
    body: [
      "Reports describe behavioral preferences based on your own answers, and are provided for development purposes only, without warranty of fitness for any other purpose. The service is provided 'as is' to the maximum extent permitted by law.",
    ],
  },
  {
    heading: "Changes and termination",
    body: [
      "We may update these terms with reasonable notice; continued use constitutes acceptance. You may close your account at any time, and we may suspend accounts that violate acceptable use.",
    ],
  },
  {
    heading: "Contact",
    body: ["Questions about these terms: hello@disc360.app."],
  },
];

export default function TermsPage() {
  return (
    <>
      <PageIntro
        eyebrow="Legal"
        title="Terms of service"
        lead="The agreement covering your use of DISC360 — including the boundaries that keep the instrument responsible."
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
