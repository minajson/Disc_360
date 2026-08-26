import Link from "next/link";
import type { CampaignIdentity, CampaignPeriod } from "@/lib/wellbeing/campaign-workspace";
import { CAMPAIGN_STATUS_DETAIL, CAMPAIGN_STATUS_LABEL } from "@/lib/wellbeing/campaign-workspace";

/**
 * The campaign workspace chrome.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT THE DISC TEAM DASHBOARD WITH NEW LABELS.
 *
 * The two products answer different questions. A DISC team dashboard is about
 * named individuals and how they work together — profiles, comparisons, an
 * anchor, a facilitator's brief. A wellbeing campaign is about a workforce and
 * how confident anyone can be in what it reported, and the individuals in it
 * are deliberately unreachable.
 *
 * So the header leads with the four things that decide whether a figure on the
 * page can be trusted at all — which instrument, which wave, what state the
 * campaign is in, and how much of the workforce actually answered — rather
 * than with a member count and an avatar row. Everything below it inherits
 * that framing.
 *
 * The escape route back to DISC360 is NOT repeated here. The Wellbeing Pulse
 * shell already carries exactly one, resolved server-side from memberships the
 * viewer actually holds; a second copy would be a second thing to get wrong,
 * and an ordinary participant must never see either.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * `external` marks a tab that leaves the workspace shell.
 *
 * Presentation is the only one. It is a full-bleed projected surface with no
 * navigation of its own, so it lives outside this layout at
 * /wellbeing/present/:id rather than under /campaigns/:id — and the tab has to
 * say so, or it points at a route that does not exist.
 */
export const CAMPAIGN_TABS = [
  { key: "overview", label: "Overview", href: "" },
  { key: "analytics", label: "Analytics", href: "/analytics", reporting: true },
  { key: "compare", label: "Compare", href: "/compare", reporting: true },
  { key: "trends", label: "Trends", href: "/trends", reporting: true },
  { key: "reports", label: "Reports", href: "/reports", reporting: true },
  {
    key: "presentation",
    label: "Presentation",
    href: "/wellbeing/present/:id",
    reporting: true,
    external: true,
  },
  { key: "settings", label: "Settings", href: "/settings" },
] as const;

export type CampaignTab = (typeof CAMPAIGN_TABS)[number]["key"];

const STATUS_TONE: Record<string, { background: string; color: string }> = {
  active: { background: "var(--color-pulse-soft)", color: "var(--color-pulse-deep)" },
  draft: { background: "var(--color-sand)", color: "var(--color-slate)" },
  full: { background: "var(--color-pulse-attention-soft)", color: "#7a5510" },
  closed: { background: "var(--color-sand)", color: "var(--color-slate)" },
  archived: { background: "var(--color-sand)", color: "var(--color-slate)" },
};

export function CampaignHeader({
  identity,
  period,
  participation,
  completed,
  invited,
}: {
  identity: CampaignIdentity;
  period: CampaignPeriod;
  /** Completed over invited. Null where there is no roster to divide by. */
  participation: number | null;
  completed: number;
  invited: number;
}) {
  const tone = STATUS_TONE[identity.status] ?? STATUS_TONE.draft!;

  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
          {identity.organizationName} · Wellbeing Pulse campaign
        </p>
        <h1 className="font-display text-[clamp(1.75rem,3.4vw,2.6rem)] leading-[1.08] font-semibold tracking-tight text-balance text-ink">
          {identity.name}
        </h1>
      </div>

      {/*
        Instrument, wave, status and participation on one line. These four
        qualify every number on every tab below, so they are chrome rather
        than a card someone can scroll past.
      */}
      <dl className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-hairline py-3.5">
        <div className="flex items-baseline gap-2">
          <dt className="sr-only">Instrument</dt>
          <dd className="text-sm font-medium text-ink">
            {identity.instrument?.name ?? "No instrument selected"}
          </dd>
        </div>

        <span aria-hidden="true" className="hidden h-4 w-px bg-[rgba(31,78,95,0.2)] sm:block" />

        <div className="flex items-baseline gap-2">
          <dt className="sr-only">Wave</dt>
          <dd className="font-mono text-xs tracking-[0.06em] text-slate">
            {period.label} · {period.period}
          </dd>
        </div>

        <span aria-hidden="true" className="hidden h-4 w-px bg-[rgba(31,78,95,0.2)] sm:block" />

        <div className="flex items-baseline gap-2">
          <dt className="sr-only">Status</dt>
          <dd>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: tone.background, color: tone.color }}
              title={CAMPAIGN_STATUS_DETAIL[identity.status]}
            >
              {CAMPAIGN_STATUS_LABEL[identity.status]}
            </span>
          </dd>
        </div>

        <div className="flex items-baseline gap-2 sm:ml-auto">
          <dt className="font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
            Participation
          </dt>
          <dd className="font-mono text-xs text-slate tabular-nums">
            {participation === null ? "—" : `${participation}%`}
            <span className="text-faint"> · {completed} of {invited}</span>
          </dd>
        </div>
      </dl>
    </header>
  );
}

/**
 * Tabs, horizontal on desktop and scrollable on a phone.
 *
 * A tab the viewer cannot open is not rendered. Reporting tabs need a
 * wellbeing role in this organisation — team administration does not grant one
 * — and showing a facilitator six tabs that all refuse them would present the
 * privacy model as a series of errors rather than as a design.
 */
export function CampaignNav({
  active,
  campaignId,
  canReport,
}: {
  active: CampaignTab;
  campaignId: string;
  canReport: boolean;
}) {
  const base = `/wellbeing/admin/campaigns/${campaignId}`;
  const tabs = CAMPAIGN_TABS.filter((tab) => canReport || !("reporting" in tab && tab.reporting));

  return (
    <nav
      aria-label="Campaign"
      className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex min-w-max items-center gap-1 border-b border-[rgba(31,78,95,0.16)]">
        {tabs.map((tab) => {
          const current = tab.key === active;
          const href =
            "external" in tab && tab.external
              ? tab.href.replace(":id", campaignId)
              : `${base}${tab.href}`;
          return (
            <li key={tab.key}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`pulse-focus -mb-px block rounded-t-lg border-b-2 px-3.5 py-2.5 text-sm transition-colors sm:px-4 ${
                  current
                    ? "border-pulse font-medium text-pulse"
                    : "border-transparent text-slate hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
