import type { Metadata } from "next";
import Link from "next/link";
import { CONSENT_DECLINED_BODY, CONSENT_DECLINED_HEADING } from "@/data/wellbeing-content";

export const metadata: Metadata = { title: "No problem" };

/**
 * Declining consent.
 *
 * This page performs no write, and no write happened on the way here: the
 * session row is created only after agreement, so there is genuinely nothing
 * recorded — including the fact that this page was seen.
 */
export default function WellbeingDeclinedPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <h1 className="font-display text-h2 font-semibold">{CONSENT_DECLINED_HEADING}</h1>
      <p className="mt-4 text-lead text-slate">{CONSENT_DECLINED_BODY}</p>
      <Link
        href="/wellbeing"
        className="pulse-focus mt-8 inline-block rounded-full border border-[rgba(31,78,95,0.24)] px-5 py-2.5 text-sm font-medium text-pulse"
      >
        Back to Wellbeing Pulse
      </Link>
    </div>
  );
}
