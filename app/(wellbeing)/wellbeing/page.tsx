import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/guards";
import {
  getInstrumentAvailability,
  getMyWellbeingCampaigns,
  resolveParticipantCampaign,
  getMyWellbeingHistory,
} from "@/lib/wellbeing/queries";
import { startWellbeingPulseAction } from "@/lib/actions/wellbeing";
import {
  CONSENT_AGREE,
  CONSENT_BODY,
  consentIntro,
  CONSENT_DECLINE,
  CONSENT_HEADING,
  participantDisclaimerFor,
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
  searchParams: Promise<{ campaign?: string; unavailable?: string }>;
}) {
  const { campaign: campaignParam } = await searchParams;
  const context = await requireOnboarded();
  const [availability, { history }] = await Promise.all([
    getInstrumentAvailability(context),
    getMyWellbeingHistory(),
  ]);

  // Which instrument this participant is about to answer.
  //
  // A CAMPAIGN decides for itself. Falling back to "the one active
  // instrument" for someone invited to a campaign describes the wrong
  // questionnaire to the one person entitled to know exactly what they are
  // being asked — a participant invited to a GHQ-12 campaign was told they
  // were taking a workplace wellbeing reflection.
  //
  // For a solo participant with no campaign, the rule is unchanged: the one
  // active instrument if there is exactly one, otherwise none. They are never
  // asked to choose between questionnaires either way.
  // The campaign from the link if there is one, otherwise the participant's
  // own campaign membership. Falling back to "the single live instrument" only
  // works while exactly one is live, which stopped being true the moment every
  // instrument was activated — see getMyWellbeingCampaigns.
  //
  // A campaign id from the URL is not trusted on its own: it is resolved
  // server-side and only accepted if this participant actually belongs to the
  // campaign's roster. Otherwise anyone could describe another organisation's
  // campaign to themselves by editing a query string.
  const live = availability.filter((entry) => entry.available);
  const myCampaigns = await getMyWellbeingCampaigns(context);
  const campaign = resolveParticipantCampaign(myCampaigns, campaignParam);
  const questionnaire = campaign
    ? (availability.find((entry) => entry.key === campaign.instrumentKey) ?? null)
    : live.length === 1
      ? live[0]!
      : null;
  const completedCount = history.completedInstruments.reduce(
    (total, key) => total + history[key].count,
    0,
  );

  const firstName = context.profile.preferred_name?.trim() || context.profile.full_name.split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
      {/* The instrument this participant would actually answer — never a
          hard-coded name. Telling someone they are taking GHQ-12 when their
          campaign runs something else misdescribes the questionnaire to the
          one person entitled to know exactly what they are answering. */}
      <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
        {questionnaire ? questionnaire.instrument.descriptor : WELLBEING_PRODUCT_DESCRIPTION}
      </p>
      <h1 className="mt-3 font-display text-h1 font-semibold tracking-tight text-balance">
        {firstName ? `${firstName}, how have things been?` : "How have things been?"}
      </h1>
      <p className="mt-4 max-w-xl text-lead text-slate">
        {WELLBEING_PRODUCT_NAME} is a short, private check-in on how you have been feeling over
        the last few weeks compared with usual.
        {questionnaire
          ? ` ${questionnaire.instrument.itemCount} questions, about ${questionnaire.instrument.minutesToComplete}.`
          : ""}
      </p>

      {completedCount > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-[rgba(31,78,95,0.16)] bg-paper px-5 py-4">
          <p className="text-sm text-slate">
            You have completed{" "}
            <strong className="font-medium text-ink">
              {completedCount} {completedCount === 1 ? "pulse" : "pulses"}
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
              {/*
                The opening sentence describes THIS campaign's questionnaire.
                It was hard-coded as "twelve short questions … about three
                minutes", which is a false statement to anyone invited to
                WHO-5 (five items) or GHQ-28 (twenty-eight) — and consent that
                misdescribes what is being asked is not consent.
              */}
              {[
                ...(questionnaire
                  ? [
                      consentIntro(
                        questionnaire.instrument.itemCount,
                        questionnaire.instrument.minutesToComplete,
                      ),
                    ]
                  : []),
                ...CONSENT_BODY,
              ].map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>

          <form action={startWellbeingPulseAction} className="flex flex-col gap-5">
            {campaign && (
              <input type="hidden" name="campaign_id" value={campaign.campaignId} />
            )}
            <input type="hidden" name="instrument_key" value={questionnaire.key} />

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
          {completedCount > 0 && (
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
        {/* The disclaimer belongs to the instrument being offered, not to the
            shell — four instruments run here and they do not share wording.
            A two-way branch here told WHO-5 and GHQ-28 participants they had
            taken GHQ-12. */}
        {questionnaire
          ? participantDisclaimerFor(questionnaire.key)
          : SCREENING_DISCLAIMER_LONG}
      </p>
    </div>
  );
}
