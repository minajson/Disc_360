import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/guards";
import { getActiveQuestionnaire, getMyWellbeingHistory } from "@/lib/wellbeing/queries";
import { startWellbeingPulseAction } from "@/lib/actions/wellbeing";
import {
  CONSENT_AGREE,
  CONSENT_BODY,
  CONSENT_DECLINE,
  CONSENT_HEADING,
  SCREENING_DISCLAIMER_LONG,
  WELLBEING_PRODUCT_DESCRIPTION,
  WELLBEING_PRODUCT_NAME,
} from "@/data/wellbeing-content";

export const metadata: Metadata = { title: "Your wellbeing check-in" };

/**
 * The Wellbeing Pulse landing page.
 *
 * Consent lives here, before anything is written. Declining navigates away and
 * creates no row at all — which is what the consent copy promises, so it has
 * to be true in the data model and not only in the sentence.
 *
 * When no licensed questionnaire is active the page says so plainly. That is a
 * real product state (GHQ-12 wording is licensed content), not a stub: the
 * database refuses to activate an unlicensed version, so this cannot be
 * bypassed by a deployment mistake.
 */
export default async function WellbeingHomePage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; unavailable?: string }>;
}) {
  const { team } = await searchParams;
  const context = await requireOnboarded();
  const [questionnaire, { history }] = await Promise.all([
    getActiveQuestionnaire(context),
    getMyWellbeingHistory(),
  ]);

  const firstName = context.profile.preferred_name?.trim() || context.profile.full_name.split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
      <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
        {WELLBEING_PRODUCT_DESCRIPTION}
      </p>
      <h1 className="mt-3 font-display text-h1 font-semibold tracking-tight text-balance">
        {firstName ? `${firstName}, how have things been?` : "How have things been?"}
      </h1>
      <p className="mt-4 max-w-xl text-lead text-slate">
        {WELLBEING_PRODUCT_NAME} is a short, private check-in on how you have been feeling over
        the last few weeks compared with usual. Twelve questions, about three minutes.
      </p>

      {history.count > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-[rgba(31,78,95,0.16)] bg-paper px-5 py-4">
          <p className="text-sm text-slate">
            You have completed{" "}
            <strong className="font-medium text-ink">
              {history.count} {history.count === 1 ? "pulse" : "pulses"}
            </strong>{" "}
            so far.
          </p>
          <Link
            href="/wellbeing/history"
            className="pulse-focus ml-auto rounded-full px-3 py-1.5 text-sm font-medium text-pulse underline underline-offset-4"
          >
            See my history →
          </Link>
        </div>
      )}

      {questionnaire ? (
        <section className="pulse-card mt-10 flex flex-col gap-6 p-6 sm:p-9">
          <div>
            <h2 className="font-display text-h3 font-semibold">{CONSENT_HEADING}</h2>
            <div className="mt-4 flex flex-col gap-3 text-[0.95rem] leading-relaxed text-slate">
              {CONSENT_BODY.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>

          <form action={startWellbeingPulseAction} className="flex flex-col gap-5">
            {team && <input type="hidden" name="team_id" value={team} />}

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[rgba(31,78,95,0.2)] bg-pulse-mist/60 p-4 transition-colors hover:border-pulse">
              <input
                type="checkbox"
                name="consent"
                required
                className="pulse-focus mt-0.5 h-5 w-5 shrink-0 accent-[#1f4e5f]"
              />
              <span className="text-[0.95rem] font-medium text-ink">{CONSENT_AGREE}</span>
            </label>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                className="pulse-focus rounded-full bg-pulse px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-pulse-deep"
              >
                Start my Wellbeing Pulse
              </button>
              <Link
                href="/wellbeing/declined"
                className="pulse-focus rounded px-1 text-sm text-slate underline underline-offset-4 hover:text-ink"
              >
                {CONSENT_DECLINE}
              </Link>
            </div>
          </form>
        </section>
      ) : (
        <section className="pulse-card mt-10 flex flex-col gap-4 p-6 sm:p-9">
          <h2 className="font-display text-h3 font-semibold">Not open just yet</h2>
          <p className="text-[0.95rem] leading-relaxed text-slate">
            The Wellbeing Pulse questionnaire is not available in this workspace yet. The GHQ-12
            questions are licensed content, and they are published here only once your
            organisation&rsquo;s licence to use them electronically has been recorded.
          </p>
          <p className="text-[0.95rem] leading-relaxed text-slate">
            Nothing is missing from your account, and nothing is required from you. Your
            wellbeing governance contact will be able to tell you when it opens.
          </p>
          {history.count > 0 && (
            <Link
              href="/wellbeing/history"
              className="pulse-focus mt-2 w-fit rounded-full border border-[rgba(31,78,95,0.2)] px-5 py-2.5 text-sm font-medium text-pulse"
            >
              See my previous pulses →
            </Link>
          )}
        </section>
      )}

      <p className="mt-10 max-w-2xl text-xs leading-relaxed text-slate">
        {SCREENING_DISCLAIMER_LONG}
      </p>
    </div>
  );
}
