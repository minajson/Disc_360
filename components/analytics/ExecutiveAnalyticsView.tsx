"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DiscRadarOverlay } from "@/components/charts/DiscRadarOverlay";
import { DimensionBarChart } from "@/components/charts/DimensionBarChart";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSION_KEY, DIMENSIONS, type Dimension } from "@/lib/types";
import type { ExecutiveAnalytics } from "@/lib/insights/executive";
import type { GroupAggregate } from "@/lib/insights/analytics";

/**
 * Executive Analytics — organisation-wide behaviour intelligence.
 *
 * Same Meridian language as the rest of the product: ivory canvas, paper
 * cards, hairlines, numbered sections, DISC identifier colours confined to
 * data marks. Nothing here introduces a palette.
 *
 * Performance: the two heaviest charts (time-series trend, heat map) are code
 * split and mount below the fold, so first paint of the dashboard is the
 * summary and the KPI row rather than every chart on the page.
 */

const TrendChart = dynamic(
  () => import("@/components/charts/TrendChart").then((module) => module.TrendChart),
  {
    loading: () => <ChartSkeleton height={260} label="Loading trend…" />,
  },
);

const HeatMapGrid = dynamic(
  () => import("@/components/charts/HeatMapGrid").then((module) => module.HeatMapGrid),
  {
    loading: () => <ChartSkeleton height={200} label="Loading heat map…" />,
  },
);

function ChartSkeleton({ height, label }: { height: number; label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center rounded-2xl border border-hairline bg-mineral"
      style={{ height }}
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </span>
    </div>
  );
}

function Panel({
  title,
  children,
  className,
  action,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("paper-card flex flex-col gap-4 p-6 lg:p-7", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Section({
  index,
  eyebrow,
  title,
  children,
}: {
  index: number;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      data-reveal
      className="flex flex-col gap-5"
      initial={reduced ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.32, 0.94, 0.6, 1] }}
    >
      <div className="flex flex-col gap-1.5">
        <Eyebrow>
          {String(index).padStart(2, "0")} · {eyebrow}
        </Eyebrow>
        <h2 className="font-display text-h3 font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

function Kpi({ value, label, detail }: { value: string; label: string; detail?: string }) {
  return (
    <div className="paper-card flex flex-col gap-1 p-6">
      <span className="font-display text-4xl font-semibold tracking-tight text-ink">
        {value}
      </span>
      <span className="text-sm text-slate">{label}</span>
      {detail ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          {detail}
        </span>
      ) : null}
    </div>
  );
}

type GroupLens = "departments" | "teams" | "units";

const LENS_LABEL: Record<GroupLens, string> = {
  departments: "Department",
  teams: "Team",
  units: "Business unit",
};

function GroupComparisonTable({
  groups,
  lens,
}: {
  groups: GroupAggregate[];
  lens: GroupLens;
}) {
  if (groups.length === 0) {
    return <p className="text-sm text-slate">No completed profiles in this view yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="rule-b font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            <th scope="col" className="py-2 pr-4 font-medium">
              {LENS_LABEL[lens]}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              People
            </th>
            {DIMENSIONS.map((dim) => (
              <th
                key={dim}
                scope="col"
                className="px-3 py-2 text-right font-medium"
                style={{ color: `var(--color-disc-${dim.toLowerCase()})` }}
              >
                {dimensionMeta[dim].displayCode}
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Lead
            </th>
            <th scope="col" className="py-2 pl-3 text-right font-medium">
              Spread
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {groups.map((group) => (
            <tr key={group.group}>
              <th scope="row" className="max-w-[14rem] truncate py-2.5 pr-4 font-medium text-ink">
                {group.group}
              </th>
              <td className="px-3 py-2.5 text-right font-mono text-xs text-slate">
                {group.count}
              </td>
              {DIMENSIONS.map((dim) => (
                <td key={dim} className="px-3 py-2.5 text-right font-mono text-xs text-ink">
                  {group.averages[DIMENSION_KEY[dim]]}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right">
                <span
                  className="rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
                  style={{
                    background: `var(--color-disc-${group.lead.toLowerCase()}-soft)`,
                    color: `var(--color-disc-${group.lead.toLowerCase()})`,
                  }}
                >
                  {dimensionMeta[group.lead].label}
                </span>
              </td>
              <td className="py-2.5 pl-3 text-right font-mono text-xs text-faint">
                {group.spread}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExecutiveAnalyticsView({
  data,
  teamHrefBase = "/app/teams",
}: {
  data: ExecutiveAnalytics;
  /** Where a team name links to — differs between the app and admin shells. */
  teamHrefBase?: string;
}) {
  const [lens, setLens] = useState<GroupLens>("departments");

  const groups = useMemo(() => {
    if (lens === "teams") return data.teamGroups;
    if (lens === "units") return data.businessUnits;
    return data.departments;
  }, [lens, data]);

  const heat = lens === "teams" ? data.teamHeatMap : data.departmentHeatMap;

  const availableLenses = useMemo(() => {
    const lenses: GroupLens[] = ["departments", "teams"];
    if (data.businessUnits.length > 1) lenses.push("units");
    return lenses;
  }, [data.businessUnits.length]);

  const leadDimension: Dimension = DIMENSIONS.reduce((lead, dim) =>
    data.averages[DIMENSION_KEY[dim]] > data.averages[DIMENSION_KEY[lead]] ? dim : lead,
  );

  if (data.profileCount === 0) {
    return (
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <Eyebrow>Executive analytics</Eyebrow>
          <h1 className="font-display text-h2 font-semibold">Organisation intelligence</h1>
        </header>
        <div className="paper-card flex flex-col items-start gap-3 p-8">
          <p className="max-w-xl text-sm leading-relaxed text-slate">
            {data.teams.length === 0
              ? "No teams in scope yet. Create a team, or ask an organisation administrator to add you to one — analytics appear as soon as a team you administer starts assessing."
              : "No completed profiles yet across the teams in scope. Executive analytics populate as participants finish their assessments."}
          </p>
          <Link
            href="/app/teams"
            className="rounded-full border border-hairline px-5 py-2 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical"
          >
            Go to teams
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-3">
        <Eyebrow>Executive analytics</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">Organisation intelligence</h1>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
          {data.scopeLabel}
          {data.organizations.length > 0 ? ` · ${data.organizations.join(", ")}` : ""}
        </p>
      </header>

      {/* 01 — executive summary */}
      <Section index={1} eyebrow="Summary" title="What leadership needs to know">
        <div className="paper-card flex flex-col gap-4 p-8">
          <ol className="flex flex-col gap-3.5">
            {data.summary.map((line, index) => (
              <li key={line} className="flex items-start gap-4">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-hairline font-mono text-[11px] text-faint">
                  {index + 1}
                </span>
                <span className="pres-measure text-lead leading-relaxed text-ink">{line}</span>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* 02 — completion analytics */}
      <Section index={2} eyebrow="Completion" title="Coverage across the organisation">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi
            value={`${data.completion.rate}%`}
            label="Completion rate"
            detail={`${data.completion.completedCount} of ${data.completion.memberCount} invited`}
          />
          <Kpi
            value={String(data.completion.teamsTracked)}
            label="Teams in scope"
            detail={`${data.organizations.length} organisation${data.organizations.length === 1 ? "" : "s"}`}
          />
          <Kpi
            value={String(data.profileCount)}
            label="Completed profiles"
            detail="Latest per person, per team"
          />
          <Kpi
            value={dimensionMeta[leadDimension].label}
            label="Leading energy"
            detail={`Average ${data.averages[DIMENSION_KEY[leadDimension]]}`}
          />
        </div>

        {data.completion.laggingTeams.length > 0 ? (
          <Panel title="Teams needing attention">
            <ul className="flex flex-col divide-y divide-hairline">
              {data.completion.laggingTeams.map((team) => (
                <li key={team.teamId} className="flex items-center gap-4 py-2.5">
                  <Link
                    href={`${teamHrefBase}/${team.teamId}/dashboard`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-botanical"
                  >
                    {team.teamName}
                  </Link>
                  <div className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-ink/8">
                    <div
                      className="h-full rounded-full bg-disc-i"
                      style={{ width: `${Math.max(2, team.rate)}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-xs text-slate">
                    {team.rate}%
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </Section>

      {/* 03 — DISC distribution */}
      <Section index={3} eyebrow="Distribution" title="How behaviour is distributed">
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Panel title="Organisation average">
            <DiscRadarOverlay
              series={[
                { label: "Organisation", scores: data.averages },
                ...groups.slice(0, 5).map((group) => ({
                  label: group.group,
                  scores: group.averages,
                  color: `var(--color-disc-${group.lead.toLowerCase()})`,
                })),
              ]}
              className="mx-auto max-w-[var(--pres-chart-md,340px)]"
            />
          </Panel>
          <Panel title="Average intensity">
            <DimensionBarChart scores={data.averages} />
            <div className="flex flex-col gap-3 rule-t pt-5">
              <h4 className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                High-band population
              </h4>
              <p className="text-sm leading-relaxed text-slate">
                Share of people who run each dimension at strength. Independent
                per dimension — these deliberately do not sum to 100.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-4">
                {data.highBands.map((band) => (
                  <div key={band.dimension} className="flex flex-col gap-0.5">
                    <span
                      className="font-display text-2xl font-semibold"
                      style={{
                        color: `var(--color-disc-${band.dimension.toLowerCase()})`,
                      }}
                    >
                      {band.percentage}%
                    </span>
                    <span className="text-xs text-slate">
                      High {dimensionMeta[band.dimension].displayCode}
                    </span>
                    <span className="font-mono text-[10px] text-faint">
                      {band.count} people
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </Section>

      {/* 04 — group comparison */}
      <Section index={4} eyebrow="Comparison" title="Department, team and business unit">
        <div
          role="group"
          aria-label="Comparison lens"
          className="flex w-fit rounded-full border border-hairline bg-paper p-1 print:hidden"
        >
          {availableLenses.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={lens === value}
              onClick={() => setLens(value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                lens === value ? "bg-botanical text-mineral" : "text-slate hover:text-ink",
              )}
            >
              {LENS_LABEL[value]}
            </button>
          ))}
        </div>

        <Panel title={`${LENS_LABEL[lens]} comparison`}>
          <GroupComparisonTable groups={groups} lens={lens} />
        </Panel>

        <Panel title={`${LENS_LABEL[lens]} heat map`}>
          <HeatMapGrid heat={heat} groupLabel={LENS_LABEL[lens]} />
        </Panel>
      </Section>

      {/* 05 — trend */}
      <Section index={5} eyebrow="Trend" title="Assessment activity over twelve months">
        <Panel title="Completions and average intensity">
          <TrendChart points={data.trend} />
        </Panel>
      </Section>

      {/* 06 — behaviour clusters */}
      <Section index={6} eyebrow="Clusters" title="Which behaviour profiles dominate">
        <Panel title="Behaviour clusters">
          <ul className="flex flex-col gap-3">
            {data.clusters.map((cluster) => (
              <li key={cluster.code} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm font-medium text-ink">{cluster.name}</span>
                  <span className="shrink-0 font-mono text-xs text-faint">
                    {cluster.count} · {cluster.share}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink/8">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(1.5, cluster.share)}%`,
                      background: `var(--color-disc-${cluster.primary.toLowerCase()})`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </Section>

      {/* 07 — teams */}
      <Section index={7} eyebrow="Teams" title="Every team in scope">
        <Panel title="Team roster">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="rule-b font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                  <th scope="col" className="py-2 pr-4 font-medium">Team</th>
                  <th scope="col" className="px-3 py-2 font-medium">Organisation</th>
                  <th scope="col" className="px-3 py-2 font-medium">Department</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Completed</th>
                  <th scope="col" className="py-2 pl-3 text-right font-medium">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {data.teams.map((team) => {
                  const rate =
                    team.memberCount > 0
                      ? Math.round((team.completedCount / team.memberCount) * 100)
                      : 0;
                  return (
                    <tr key={team.teamId}>
                      <th scope="row" className="py-2.5 pr-4 font-medium">
                        <Link
                          href={`${teamHrefBase}/${team.teamId}/dashboard`}
                          className="text-ink hover:text-botanical"
                        >
                          {team.teamName}
                        </Link>
                      </th>
                      <td className="px-3 py-2.5 text-slate">{team.organizationName}</td>
                      <td className="px-3 py-2.5 text-slate">{team.department ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-slate">
                        {team.completedCount}/{team.memberCount}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono text-xs text-ink">
                        {rate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </Section>

      <p className="max-w-3xl text-xs leading-relaxed text-faint">
        Executive analytics aggregate team composition and working preferences.
        They are not a measure of ability, health or suitability for a role, and
        must not be used for selection decisions. Individual assessment
        responses are never included and remain readable only by their author.
      </p>
    </div>
  );
}
