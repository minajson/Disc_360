import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { loadCampaignReporting } from "@/lib/wellbeing/campaign-workspace";
import {
  COMPARE_DIMENSIONS,
  getWellbeingComparison,
  getWellbeingCoverage,
  localFixtureOffered,
  type CompareDimension,
} from "@/lib/wellbeing/analytics";
import { analyticsPlanFor } from "@/lib/wellbeing/instrument-analytics";
import { CampaignHeader, CampaignNav } from "@/components/wellbeing/campaign/CampaignChrome";
import { CampaignFrame } from "@/components/wellbeing/campaign/CampaignFrame";
import { ReportingUnavailable } from "@/components/wellbeing/campaign/ReportingUnavailable";
import { Section } from "@/components/wellbeing/campaign/Section";
import { CohortComparison } from "@/components/wellbeing/analytics/CohortComparison";
import { CohortCoverage } from "@/components/wellbeing/campaign/CohortCoverage";
import { SourceSwitch } from "@/components/wellbeing/analytics/SourceSwitch";

export const metadata: Metadata = { title: "Compare cohorts" };

const DIMENSION_LEAD: Record<CompareDimension, string> = {
  department:
    "How the answers differ between functions. Functions vary in size, in the work they do and in who chose to take part — a difference here is a place to ask a question, not an explanation.",
  team: "How the answers differ between working teams. A team crosses functions, so this and the function view can disagree without either being wrong.",
  work_location:
    "Field-based and office-based work are different working conditions, and this is usually the first comparison worth looking at because the difference between them is rarely small.",
  office_location:
    "How the answers differ between offices. Field-based responses are not included, because field work has no office location to report.",
  wave: "How each period compares with the others. Composition changes between waves — different people answer — so a difference describes the responses received, not the same people moving.",
};

/**
 * Cohort comparison.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THIS IS COHORT COMPARISON. IT IS NEVER PEOPLE COMPARISON.
 *
 * The DISC side of this platform has a Compare Members surface, and it is
 * correct there: DISC is about named individuals and how they work together.
 * Applying the same idea to wellbeing would produce a named-person comparison
 * of screening data, which is the single worst thing this product could build.
 *
 * There is no route from here to an individual, and there is no query behind
 * this page that could return one. Every cohort has passed suppression on the
 * server before its figures became a return value; a withheld cohort has no
 * figures anywhere in this page's payload to reveal.
 *
 * The comparison also refuses to rank. Rows are alphabetical, there is no
 * position, and no cohort is described as better or worse than another.
 * ─────────────────────────────────────────────────────────────────────
 */
export default async function CampaignComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ source?: string; by?: string }>;
}) {
  const { teamId } = await params;
  if (!z.uuid().safeParse(teamId).success) notFound();
  const { source: sourceParam, by } = await searchParams;

  const resolved = await loadCampaignReporting(teamId, sourceParam);
  if (!resolved.ok) {
    return (
      <CampaignFrame identity={resolved.identity} tab="compare">
        <ReportingUnavailable campaignId={teamId} reason={resolved.reason} />
      </CampaignFrame>
    );
  }

  const { identity, instrumentKey, instrument, source, scope, period, headline } =
    resolved.context;
  const plan = analyticsPlanFor(instrumentKey);

  const dimension: CompareDimension = COMPARE_DIMENSIONS.some((entry) => entry.key === by)
    ? (by as CompareDimension)
    : "department";

  const [comparison, coverage] = await Promise.all([
    getWellbeingComparison(identity.organizationId, instrumentKey, dimension, source, scope),
    getWellbeingCoverage(identity.organizationId, instrumentKey, source, scope),
  ]);

  const base = `/wellbeing/admin/campaigns/${teamId}/compare`;

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
        <CampaignNav active="compare" campaignId={teamId} canReport />
      </div>

      <div className="mt-6">
        <SourceSwitch
          source={source}
          organizationId={identity.organizationId}
          instrumentKey={instrumentKey}
          tab="compare"
          basePath={base}
          fixtureOffered={localFixtureOffered()}
        />
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <Section
          index={1}
          title="Compare by"
          lead="Choose how to divide the workforce. Only groups large enough to protect confidentiality are shown, and the same rule applies to every choice here."
        >
          <div
            role="group"
            aria-label="Compare by"
            className="-mx-1 flex flex-wrap gap-2 px-1"
          >
            {COMPARE_DIMENSIONS.map((entry) => (
              <Link
                key={entry.key}
                href={`${base}?source=${source}&by=${entry.key}`}
                aria-current={entry.key === dimension ? "true" : undefined}
                className={`pulse-focus rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  entry.key === dimension
                    ? "border-pulse bg-pulse text-white"
                    : "border-hairline text-slate hover:border-pulse hover:text-pulse"
                }`}
              >
                {entry.label}
              </Link>
            ))}
          </div>
        </Section>

        <Section
          index={2}
          title={comparison.view.label}
          lead={DIMENSION_LEAD[dimension]}
          aside={
            comparison.view.suppressedCount > 0
              ? `${comparison.view.publishedCount} shown · ${comparison.view.suppressedCount} withheld`
              : `${comparison.view.publishedCount} group${comparison.view.publishedCount === 1 ? "" : "s"}`
          }
        >
          {/* The explanation now travels WITH the chart rather than beside it,
              so every surface that draws this comparison gets the same one. */}
          <CohortComparison
            cohorts={comparison.view.cohorts}
            instrumentKey={comparison.context.instrumentKey}
            scoreLabel={instrument.primaryScoreLabel}
            scoreMin={instrument.primaryScoreMin}
            scoreMax={instrument.primaryScoreMax}
            threshold={plan.thresholdRate ? comparison.context.threshold : null}
            minCohort={comparison.context.minCohort}
          />
        </Section>

        <Section
          index={3}
          title="What this comparison covers"
          lead="Before reading any difference above, how much of the workforce this way of dividing it can actually describe."
          aside={`minimum group ${coverage.coverage.minCohort}`}
        >
          <CohortCoverage coverage={coverage.coverage} />
        </Section>
      </div>
    </div>
  );
}
