import Link from "next/link";
import { DEMO_SOURCE_NOTE, ILLUSTRATIVE_DATA_BANNER } from "@/lib/wellbeing/demo-population";
import { LOCAL_FIXTURE_BANNER, LOCAL_FIXTURE_NOTE } from "@/lib/wellbeing/local-fixture";
import type { AnalyticsSource } from "@/lib/wellbeing/analytics";

/**
 * LIVE PILOT / ANALYTICS DEMO / LOCAL DEVELOPMENT FIXTURE.
 *
 * Three things a management audience must never confuse, so the distinction is
 * made structurally rather than by a caption: each synthetic source carries a
 * standing banner that cannot scroll out of the way of a figure, and the
 * switch itself states which is currently on screen.
 *
 * A ten-person pilot legitimately withholds most subdivisions, so the
 * synthetic sources exist to show what the workspace does at scale — not to
 * make the pilot look busier than it is. They are never merged with live data,
 * and their figures are generated in memory rather than read from, or written
 * to, any participant table.
 *
 * The local fixture is offered ONLY where the server said it may be: it
 * describes a customer-shaped workforce, so it is a development and review
 * tool and its option simply does not render anywhere else.
 */

/** The sources on offer, so the filter bar and this switch cannot drift. */
export function analyticsSourceOptions(
  fixtureOffered: boolean,
): { key: AnalyticsSource; label: string }[] {
  return [
    { key: "live", label: "Live pilot" },
    { key: "demo", label: "Analytics demo" },
    ...(fixtureOffered ? [{ key: "fixture" as const, label: "Local fixture" }] : []),
  ];
}

const BANNER: Partial<Record<AnalyticsSource, { label: string; note: string }>> = {
  demo: { label: ILLUSTRATIVE_DATA_BANNER, note: DEMO_SOURCE_NOTE },
  fixture: { label: LOCAL_FIXTURE_BANNER, note: LOCAL_FIXTURE_NOTE },
};

export function SourceSwitch({
  source,
  organizationId,
  instrumentKey,
  tab,
  basePath = "/wellbeing/analytics",
  fixtureOffered = false,
  bannerOnly = false,
}: {
  source: AnalyticsSource;
  organizationId: string;
  instrumentKey: string;
  tab: string;
  /** The surface this switch belongs to — the workspace, or one campaign. */
  basePath?: string;
  fixtureOffered?: boolean;
  /**
   * Render the standing banner WITHOUT the switch.
   *
   * The organisational workspace moved the source control into
   * `AnalyticsFilters`, alongside the organisation and the questionnaire,
   * because all three change what the server computes. The BANNER still has to
   * appear on its own — it is the thing that must never scroll out of the way
   * of a synthetic figure — so it is rendered separately from the control that
   * chose it.
   */
  bannerOnly?: boolean;
}) {
  const href = (next: AnalyticsSource) =>
    `${basePath}?org=${organizationId}&instrument=${instrumentKey}&tab=${tab}&source=${next}`;

  const banner = BANNER[source];

  const options = analyticsSourceOptions(fixtureOffered);

  if (bannerOnly) {
    return banner ? (
      <div className="flex flex-col gap-1.5 rounded-2xl border border-[rgba(169,118,20,0.28)] bg-[rgba(169,118,20,0.07)] px-5 py-4">
        <p className="font-mono text-[11px] tracking-[0.16em] text-[#7a5510] uppercase">
          {banner.label}
        </p>
        <p className="text-sm leading-relaxed text-slate">{banner.note}</p>
      </div>
    ) : null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label="Data source"
        className="inline-flex w-fit rounded-full border border-[rgba(31,78,95,0.24)] bg-paper p-1"
      >
        {options.map((option) => (
          <Link
            key={option.key}
            href={href(option.key)}
            aria-current={option.key === source ? "true" : undefined}
            className={`pulse-focus rounded-full px-4 py-1.5 text-xs font-medium tracking-[0.04em] whitespace-nowrap transition-colors ${
              option.key === source
                ? "bg-pulse-deep text-white"
                : "text-slate hover:text-pulse-deep"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {banner && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-[rgba(169,118,20,0.28)] bg-[rgba(169,118,20,0.07)] px-5 py-4">
          <p className="font-mono text-[11px] tracking-[0.16em] text-[#7a5510] uppercase">
            {banner.label}
          </p>
          <p className="text-sm leading-relaxed text-slate">{banner.note}</p>
        </div>
      )}
    </div>
  );
}
