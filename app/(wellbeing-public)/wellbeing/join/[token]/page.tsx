import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/server";
import { acceptTeamLink } from "@/lib/actions/invitations";
import { getJoinContext, JOIN_STATE_MESSAGES } from "@/lib/join/context";
import {
  checkCampaignReadiness,
  CAMPAIGN_NOT_READY_PARTICIPANT_MESSAGE,
} from "@/lib/wellbeing/readiness";
import { getUsableOAuthProviders } from "@/lib/auth/oauth-providers";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { PulseFooter, PulseHeader } from "@/components/wellbeing/PulseChrome";
import {
  WELLBEING_PRODUCT_DESCRIPTION,
  WELLBEING_PRODUCT_NAME,
} from "@/data/wellbeing-content";
import { INSTRUMENTS, isInstrumentKey } from "@/data/wellbeing-instruments";

export const metadata: Metadata = { title: "You're invited" };

/**
 * The Wellbeing Pulse invitation — screen one of the participant journey.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THIS SCREEN IS, AND WHAT IT DELIBERATELY IS NOT.
 *
 * It is what a printed QR code resolves to, for someone who may never have
 * used this platform. So it is short, it says who invited them and what is
 * being asked, it answers the one question everybody has — who can see this —
 * and it offers one way forward.
 *
 * It is NOT a registration form. The previous route collected a full name, an
 * email address, a job title, a free-text "Sub Team" and an "Employee /
 * reference ID" on this first screen, before the person had agreed to
 * anything. Google already knows the name and the address; the campaign
 * context belongs after consent, on a screen of its own; and an employee
 * reference number has no place in a wellbeing programme at all — it is the
 * one field that would make a response trivially re-identifiable inside an
 * HR system.
 *
 * WHY OAUTH IS HERE RATHER THAN A LINK AWAY.
 *
 * A person scanning this has an intent — this campaign, this instrument — and
 * every hop is a chance to lose it. `next` is set explicitly to the campaign
 * and rides through the provider round trip on the callback URL, so
 * "Continue with Google" returns here, not to the DISC360 dashboard.
 *
 * There is no second authentication system: these are the platform's own
 * providers, resolved by the platform's own server-side status check.
 * ─────────────────────────────────────────────────────────────────────
 */
export default async function WellbeingJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await getJoinContext(token);
  if (!context) notFound();

  // ── configuration problems are the facilitator's, not the participant's ──
  //
  // A campaign missing a lookup its context form is built from cannot be
  // completed. Discovering that AFTER scanning a code, part-way through a
  // form, is the worst possible moment — the person cannot fix it and has no
  // idea who can.
  //
  // So it is refused here, before the invitation renders, and the participant
  // is told something true and useful without being shown the organisation's
  // configuration state.
  const readiness = await checkCampaignReadiness(
    context.teamId,
    context.wellbeingInstrumentKey,
  );

  const blocked = context.blocked
    ? (JOIN_STATE_MESSAGES[context.blocked] ?? context.blocked)
    : readiness.ready
      ? null
      : CAMPAIGN_NOT_READY_PARTICIPANT_MESSAGE;

  // ── a signed-in visitor is already past this screen ──────────────────
  //
  // Whether they arrived signed in, or came back here after Google, the
  // invitation is not what they need — the campaign is. Accepting the link
  // HERE, from the token, is what puts them on the campaign roster: the
  // token is the authorization, and a signed-in participant must never be
  // able to join a campaign by supplying its id.
  //
  // Without this the participant still answered the right instrument (the
  // session carries team_id) but never appeared on the roster, so the
  // campaign's own participation rate excluded every person who joined by
  // scanning the code — which is all of them.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !blocked) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", user.id)
      .maybeSingle();
    // A fresh Google account has no profile yet. Onboarding carries the
    // invitation through and returns here, so consent still precedes
    // membership.
    if (!profile?.onboarded_at) redirect(`/onboarding?join=${token}`);

    await acceptTeamLink(token);
    redirect(`/wellbeing?team=${encodeURIComponent(context.teamId)}`);
  }

  // The invitation, carried through authentication. Returning to this page
  // rather than straight to the pulse is deliberate: this is where the token
  // is, and the token is what grants membership.
  const next = `/wellbeing/join/${token}`;
  const emailHref = `/sign-up?next=${encodeURIComponent(next)}${
    context.invitedEmail ? `&email=${encodeURIComponent(context.invitedEmail)}` : ""
  }`;
  const signInHref = `/sign-in?next=${encodeURIComponent(next)}`;

  // Only providers that can complete a sign-in — see getUsableOAuthProviders.
  // A dead button on an invitation is a reason to give up.
  const providers = getUsableOAuthProviders();
  const invitedBy = context.organizationName ?? context.teamName;

  // What is actually being asked, and roughly how long it takes — read from
  // the campaign's own configured instrument rather than assumed. Telling
  // somebody "twelve questions, two to three minutes" when their campaign runs
  // a twenty-eight item questionnaire is the first promise this product would
  // break to them.
  const instrument =
    context.wellbeingInstrumentKey && isInstrumentKey(context.wellbeingInstrumentKey)
      ? INSTRUMENTS[context.wellbeingInstrumentKey]
      : null;

  return (
    <div className="flex min-h-screen flex-col">
      <PulseHeader homeHref={`/wellbeing/join/${token}`} />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-9 sm:px-8 sm:py-14">
        <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
          {WELLBEING_PRODUCT_DESCRIPTION}
        </p>
        <h1 className="mt-3 font-display text-[clamp(1.75rem,7vw,2.5rem)] leading-[1.08] font-semibold tracking-tight text-balance">
          {WELLBEING_PRODUCT_NAME}
        </h1>

        {invitedBy && (
          <p className="mt-3.5 text-[1.05rem] leading-relaxed text-slate">
            You have been invited by <strong className="font-medium text-ink">{invitedBy}</strong>
            {context.sessionName ? ` · ${context.sessionName}` : ""}
            {context.facilitatorName ? `, facilitated by ${context.facilitatorName}` : ""}.
          </p>
        )}

        {instrument && (
          <p className="mt-2.5 font-mono text-xs text-slate">
            {instrument.name} · {instrument.itemCount} questions ·{" "}
            {instrument.minutesToComplete}
          </p>
        )}

        {blocked ? (
          <div className="pulse-card mt-8 p-6">
            <h2 className="font-display text-h3 font-semibold">
              {readiness.ready ? "This link is not active" : "Not open yet"}
            </h2>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-slate">{blocked}</p>
          </div>
        ) : (
          <>
            {/*
              The three facts that decide whether someone takes part. Kept
              above the fold on a phone, and kept to three — a wall of policy
              text at this moment reads as something to get past, not as
              reassurance.
            */}
            <ul className="mt-7 flex flex-col gap-3.5">
              {[
                {
                  title: "Private to you",
                  body: "Your answers and your score are yours. Your manager, your facilitator and platform administrators cannot see them.",
                },
                {
                  title: "Reported only as groups",
                  body: "Your organisation sees combined figures for groups of people, never an individual result — and never for a group small enough that someone in it could be picked out.",
                },
                {
                  title: "Voluntary",
                  body: "Taking part is your choice, and you can stop at any point.",
                },
              ].map((point) => (
                <li key={point.title} className="flex gap-3.5">
                  <span
                    aria-hidden="true"
                    className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-pulse-teal"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-ink">{point.title}</span>
                    <span className="text-sm leading-relaxed text-slate">{point.body}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="pulse-card mt-8 flex flex-col gap-5 p-6">
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-lg font-semibold text-ink">Continue</h2>
                <p className="text-sm leading-relaxed text-slate">
                  Sign in so your check-in stays private to you and you can see your own history
                  later.
                </p>
              </div>

              {/*
                The platform's own providers, with this campaign as the
                destination on the other side of the round trip. The component
                draws its own "or with email" rule, so this screen does not
                add a second one.
              */}
              {/* Nothing renders when no provider is usable, so the "or with
                  email" rule the component draws would be orphaned. */}
              {providers.length > 0 && <OAuthButtons providers={providers} next={next} />}

              <div className="flex flex-col gap-2.5">
                <Link
                  href={emailHref}
                  className="pulse-focus flex min-h-11 w-full items-center justify-center rounded-full bg-pulse px-6 text-sm font-medium text-white transition-colors hover:bg-pulse-deep"
                >
                  Continue with email
                </Link>
                <Link
                  href={signInHref}
                  className="pulse-focus flex min-h-11 w-full items-center justify-center rounded-full border border-[rgba(31,78,95,0.24)] px-6 text-sm font-medium text-pulse"
                >
                  I already have an account
                </Link>
              </div>
            </div>

            <p className="mt-6 text-xs leading-relaxed text-faint">
              Next you will be asked a few questions about your role — your function and team — so
              your answers can be counted in the right group. Then the check-in itself, which takes
              a few minutes.
            </p>
          </>
        )}
      </main>

      <PulseFooter />
    </div>
  );
}
