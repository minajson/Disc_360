import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/PageIntro";
import { ContactForm } from "@/components/marketing/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to the DISC360 team about teams, coaching or enterprise.",
};

export default function ContactPage() {
  return (
    <>
      <PageIntro
        eyebrow="Contact"
        title="Tell us what you're trying to build."
        lead="Team rollouts, coaching engagements, enterprise questions or product feedback — we read every message."
      />
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 pb-24 sm:px-8 lg:grid-cols-[1.2fr_0.8fr]">
        <ContactForm />
        <aside className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
              Email
            </span>
            <a href="mailto:hello@disc360.app" className="text-sm text-botanical hover:underline">
              hello@disc360.app
            </a>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
              Response time
            </span>
            <p className="text-sm text-slate">Within two business days.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
              For urgent account issues
            </span>
            <p className="max-w-xs text-sm leading-relaxed text-slate">
              Include the email address on the account and the team name — it
              cuts a day off the back-and-forth.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
