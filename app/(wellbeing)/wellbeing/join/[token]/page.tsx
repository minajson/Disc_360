import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJoinContext, JOIN_STATE_MESSAGES } from "@/lib/join/context";
import { PulseFooter, PulseHeader } from "@/components/wellbeing/PulseChrome";
import {
  CONSENT_BODY,
  SCREENING_DISCLAIMER_LONG,
  WELLBEING_PRODUCT_DESCRIPTION,
  WELLBEING_PRODUCT_NAME,
} from "@/data/wellbeing-content";

export const metadata: Metadata = { title: "Join your wellbeing check-in" };

/**
 * The Wellbeing Pulse join page.
 *
 * Public by necessity — it is what a printed QR code resolves to — and
 * therefore deliberately thin: `resolve_join_token` is a SECURITY DEFINER RPC
 * that validates the token inside the database and returns only
 * participant-safe context. No result, no member and no score is reachable
 * from here, signed in or not.
 *
 * It renders its own chrome rather than the shell layout, because the shell
 * requires an authenticated user and this page must work before sign-in.
 */
export default async function WellbeingJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await getJoinContext(token);
  if (!context) notFound();

  const blocked = context.blocked
    ? (JOIN_STATE_MESSAGES[context.blocked] ?? context.blocked)
    : null;

  // After sign-in, land on the Wellbeing Pulse landing page for this team —
  // never on the DISC360 dashboard.
  const next = `/wellbeing?team=${encodeURIComponent(context.teamId)}`;
  const signInHref = `/sign-in?next=${encodeURIComponent(next)}`;
  const signUpHref = `/sign-up?next=${encodeURIComponent(next)}${
    context.invitedEmail ? `&email=${encodeURIComponent(context.invitedEmail)}` : ""
  }`;

  return (
    <div className="pulse-canvas flex min-h-screen flex-col">
      <PulseHeader homeHref={`/wellbeing/join/${token}`} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8 sm:py-16">
        <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
          {WELLBEING_PRODUCT_DESCRIPTION}
        </p>
        <h1 className="mt-3 font-display text-h1 font-semibold tracking-tight text-balance">
          {WELLBEING_PRODUCT_NAME}
        </h1>

        {context.organizationName && (
          <p className="mt-4 text-lead text-slate">
            You have been invited by {context.organizationName}
            {context.teamName ? ` · ${context.teamName}` : ""}.
          </p>
        )}

        {blocked ? (
          <div className="pulse-card mt-8 p-6 sm:p-9">
            <h2 className="font-display text-h3 font-semibold">This link is not active</h2>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-slate">{blocked}</p>
          </div>
        ) : (
          <div className="pulse-card mt-8 flex flex-col gap-6 p-6 sm:p-9">
            <div className="flex flex-col gap-3 text-[0.95rem] leading-relaxed text-slate">
              {CONSENT_BODY.slice(0, 3).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={signUpHref}
                className="pulse-focus rounded-full bg-pulse px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-pulse-deep"
              >
                Continue
              </Link>
              <Link
                href={signInHref}
                className="pulse-focus rounded-full border border-[rgba(31,78,95,0.24)] px-6 py-3 text-sm font-medium text-pulse"
              >
                I already have an account
              </Link>
            </div>
          </div>
        )}

        <p className="mt-10 text-xs leading-relaxed text-slate">{SCREENING_DISCLAIMER_LONG}</p>
      </main>

      <PulseFooter />
    </div>
  );
}
