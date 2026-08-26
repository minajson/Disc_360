import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { loadCampaignReporting } from "@/lib/wellbeing/campaign-workspace";
import { getWellbeingCoverage, localFixtureOffered } from "@/lib/wellbeing/analytics";
import { CampaignHeader, CampaignNav } from "@/components/wellbeing/campaign/CampaignChrome";
import { CampaignFrame } from "@/components/wellbeing/campaign/CampaignFrame";
import { ReportingUnavailable } from "@/components/wellbeing/campaign/ReportingUnavailable";
import { Section } from "@/components/wellbeing/campaign/Section";
import { SourceSwitch } from "@/components/wellbeing/analytics/SourceSwitch";
import { ILLUSTRATIVE_DATA_BANNER } from "@/lib/wellbeing/demo-population";
import { LOCAL_FIXTURE_BANNER } from "@/lib/wellbeing/local-fixture";

export const metadata: Metadata = { title: "Campaign reports" };

/**
 * The two reports, and the wall between them.
 *
 * ─────────────────────────────────────────────────────────────────────
 * TWO PIPELINES, DELIBERATELY UNCONNECTED.
 *
 *  · THE MANAGEMENT REPORT is aggregate, campaign-level and suppression
 *    protected. It is produced by `loadWellbeingAggregateReport`, which issues
 *    no query of its own — it calls the same analytics functions the screen
 *    calls, each of which authorises and suppresses before returning a figure.
 *    A cohort withheld on screen is absent from the file rather than hidden
 *    inside it.
 *
 *  · THE INDIVIDUAL REPORT is produced by `loadOwnWellbeingReport`, which
 *    takes no profile parameter at all: it reads through the participant's own
 *    RLS-scoped client and compares ownership again on top. There is no
 *    argument a facilitator could pass it to obtain somebody else's document.
 *
 * The two share a PDF renderer and share nothing else — no loader, no query,
 * no authorisation path. That is what makes "one pipeline cannot accidentally
 * cross the boundary" a structural claim rather than a promise: there is no
 * pipeline that spans both.
 *
 * This page therefore offers exactly one download, and describes the other
 * rather than linking to it. A facilitator's route to a participant's own
 * report does not exist anywhere in this workspace.
 * ─────────────────────────────────────────────────────────────────────
 */
export default async function CampaignReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { teamId } = await params;
  if (!z.uuid().safeParse(teamId).success) notFound();
  const { source: sourceParam } = await searchParams;

  const resolved = await loadCampaignReporting(teamId, sourceParam);
  if (!resolved.ok) {
    return (
      <CampaignFrame identity={resolved.identity} tab="reports">
        <ReportingUnavailable campaignId={teamId} reason={resolved.reason} />
      </CampaignFrame>
    );
  }

  const { identity, instrumentKey, instrument, source, scope, period, headline } =
    resolved.context;
  const { coverage } = await getWellbeingCoverage(
    identity.organizationId,
    instrumentKey,
    source,
    scope,
  );

  const base = `/wellbeing/admin/campaigns/${teamId}/reports`;
  const download = `/api/wellbeing/aggregate-report?org=${identity.organizationId}&instrument=${instrumentKey}&campaign=${teamId}&source=${source}`;
  const publishable = coverage.participants >= coverage.minCohort;

  const syntheticBanner =
    source === "demo"
      ? ILLUSTRATIVE_DATA_BANNER
      : source === "fixture"
        ? LOCAL_FIXTURE_BANNER
        : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <CampaignHeader
        identity={identity}
        period={period}
        participation={headline.participation}
        completed={headline.completed}
        invited={headline.invited}
      />

      <div className="mt-7">
        <CampaignNav active="reports" campaignId={teamId} canReport />
      </div>

      <div className="mt-6">
        <SourceSwitch
          source={source}
          organizationId={identity.organizationId}
          instrumentKey={instrumentKey}
          tab="reports"
          basePath={base}
          fixtureOffered={localFixtureOffered()}
        />
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {/* ── 01 · the management report ───────────────────────────── */}
        <Section
          index={1}
          title="Management report"
          lead={`One aggregate document for ${identity.name}, suitable for circulating internally. It reports on this campaign only.`}
          aside={instrument.name}
        >
          <div className="flex flex-col gap-4 rounded-2xl border border-[rgba(31,78,95,0.16)] bg-pulse-mist/50 p-5 sm:p-6">
            <p className="text-sm leading-relaxed text-slate">
              Campaign snapshot · participation and coverage · overall pattern · cohort comparison
              {instrument.subscales.length > 0 || instrumentKey === "disc360_wellbeing_v1"
                ? " · dimension profile"
                : ""}{" "}
              · movement across waves · areas to explore · method and privacy.
            </p>

            {syntheticBanner && (
              <p className="font-mono text-[11px] tracking-[0.14em] text-[#7a5510] uppercase">
                Generated from synthetic data — labelled {syntheticBanner} on the cover, in the
                file metadata and in the method section.
              </p>
            )}

            <a
              href={download}
              className="pulse-focus w-fit rounded-full bg-pulse-deep px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink"
            >
              Download management report
            </a>

            {!publishable && (
              <p className="text-xs leading-relaxed text-faint">
                Fewer than {coverage.minCohort} people have completed this campaign, so the report
                will explain that no group figure can be published yet rather than producing empty
                pages.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-hairline pt-6">
            <h3 className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">
              What this document never contains
            </h3>
            <ul className="flex flex-col gap-2 text-sm leading-relaxed text-slate">
              {[
                "No participant roster, and no name beside any figure.",
                "No individual score, individual history or raw response.",
                "No email address or contact detail.",
                `Nothing for a group smaller than ${coverage.minCohort} people — suppression applies to this document exactly as it applies on screen, and a withheld figure is absent from the file rather than hidden inside it.`,
                "No comparison against another organisation, another campaign or another instrument.",
              ].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-pulse-teal"
                  />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* ── 02 · the individual report ───────────────────────────── */}
        <Section
          index={2}
          title="Individual reports"
          lead="Each participant has their own report. It belongs to them, and there is no route to it from here — not a link, not an export, not a permission a facilitator could be granted."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-2.5 rounded-2xl border border-hairline bg-canvas p-5">
              <h3 className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">
                What the participant gets
              </h3>
              <ul className="flex flex-col gap-2 text-sm leading-relaxed text-slate">
                <li>Their own score, in their own words, with the instrument&rsquo;s wording.</li>
                <li>Their own history across the waves they took part in.</li>
                <li>A PDF they can download, and an optional email link to it.</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2.5 rounded-2xl border border-hairline bg-canvas p-5">
              <h3 className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">
                What it never contains
              </h3>
              <ul className="flex flex-col gap-2 text-sm leading-relaxed text-slate">
                <li>No comparison against their team, function, office or organisation.</li>
                <li>No ranking, percentile or standing against anybody else.</li>
                <li>No aggregate figure from this workspace.</li>
              </ul>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-faint">
            Participants reach their own report through{" "}
            <Link href="/wellbeing/history" className="underline underline-offset-2">
              My History
            </Link>
            . That route reads through their own session and compares ownership again on top; it
            takes no participant identifier, so there is no value a facilitator could supply it to
            obtain someone else&rsquo;s document.
          </p>
        </Section>

        {/* ── 03 · presentation ────────────────────────────────────── */}
        <Section
          index={3}
          title="Presenting to leadership"
          lead="The same aggregate figures, sized for a room. Suppressed groups are absent from the deck for the same reason they are absent from the report."
        >
          <Link
            href={`/wellbeing/present/${teamId}?source=${source}`}
            className="pulse-focus w-fit rounded-full border border-hairline px-5 py-2.5 text-sm font-medium text-pulse transition-colors hover:border-pulse"
          >
            Open presentation mode →
          </Link>
        </Section>
      </div>
    </div>
  );
}
