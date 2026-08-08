"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DiscRadarOverlay } from "@/components/charts/DiscRadarOverlay";
import { DistributionBar } from "@/components/charts/DistributionBar";
import { DimensionBarChart } from "@/components/charts/DimensionBarChart";
import { TeamQuadrantMap } from "@/components/teams/TeamQuadrantMap";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSION_KEY, DIMENSIONS, type DiscScores } from "@/lib/types";
import { leadSentences } from "@/lib/insights/board";
import type { TeamMemberProfile } from "@/lib/insights/team";
import type {
  BoardInsight,
  BoardRisk,
  CommunicationTendency,
  DecisionStyle,
  DistributionSlice,
  StrengthBand,
} from "@/lib/insights/board";

/**
 * Presentation-grade team results — the view that goes on the conference-room
 * screen in front of an executive team.
 *
 * Everything on this page is the existing DISC360 visual language at board
 * scale: the same ivory canvas, paper cards, hairlines, numbered sections and
 * DISC identifier colours, with the display serif carrying the weight instead
 * of density. Nothing here is a new palette or a new card.
 *
 * Presentation mode is a projection setting, not a different page: it goes
 * full screen, drops the chrome and steps the type up one scale. The same DOM
 * prints, so "Export PDF" produces the same document.
 */

export interface ExecutiveBriefData {
  teamId: string;
  teamName: string;
  named: boolean;
  memberCount: number;
  completedCount: number;
  averages: DiscScores;
  profiles: TeamMemberProfile[];
  cultureSummary: string;
  collaboration: string;
  balance: { index: number; label: string; detail: string };
  distribution: DistributionSlice[];
  strengths: StrengthBand[];
  communication: CommunicationTendency[];
  decision: DecisionStyle;
  insights: BoardInsight[];
  risks: BoardRisk[];
}

const insightTone: Record<BoardInsight["tone"], { label: string; className: string }> = {
  strength: { label: "Strength", className: "text-disc-s" },
  risk: { label: "Watch", className: "text-disc-d" },
  balance: { label: "Balance", className: "text-disc-c" },
};

function Section({
  index,
  eyebrow,
  title,
  presentation,
  children,
}: {
  index: number;
  eyebrow: string;
  title: string;
  presentation: boolean;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      data-reveal
      className="flex flex-col gap-5 break-inside-avoid"
      initial={reduced ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: [0.32, 0.94, 0.6, 1] }}
    >
      <div className="flex flex-col gap-1.5">
        <Eyebrow>
          {String(index).padStart(2, "0")} · {eyebrow}
        </Eyebrow>
        <h2
          className={cn(
            "font-display font-semibold text-ink",
            presentation ? "pres-h2" : "text-h3",
          )}
        >
          {title}
        </h2>
      </div>
      {children}
    </motion.section>
  );
}

function Metric({
  value,
  label,
  detail,
  presentation,
}: {
  value: string;
  label: string;
  detail?: string;
  presentation: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className={cn(
          "font-display font-semibold tracking-tight text-ink",
          presentation ? "pres-metric" : "text-4xl lg:text-5xl",
        )}
      >
        {value}
      </span>
      <span className={cn("text-slate", presentation ? "pres-label" : "text-sm")}>
        {label}
      </span>
      {detail ? (
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
          {detail}
        </span>
      ) : null}
    </div>
  );
}

export function ExecutiveBrief({ data }: { data: ExecutiveBriefData }) {
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [presentation, setPresentation] = useState(false);
  const [showNames, setShowNames] = useState(data.named);
  const [department, setDepartment] = useState<string | null>(null);

  const departments = useMemo(
    () =>
      [...new Set(data.profiles.map((profile) => profile.department).filter(Boolean))]
        .sort() as string[],
    [data.profiles],
  );

  const profiles = useMemo(
    () =>
      data.profiles
        .map((profile) => ({
          ...profile,
          label: showNames ? profile.label : profile.anonLabel,
        }))
        .filter((profile) => department === null || profile.department === department),
    [data.profiles, showNames, department],
  );

  const completionRate =
    data.memberCount > 0
      ? Math.round((data.completedCount / data.memberCount) * 100)
      : 0;

  const togglePresentation = useCallback(() => {
    setPresentation((current) => {
      const next = !current;
      if (next) void stageRef.current?.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      return next;
    });
  }, []);

  // Leaving full screen with Esc must also leave presentation mode, or the
  // page is left in projector type with no way back to the controls.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setPresentation(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  if (data.completedCount === 0) {
    return (
      <div className="paper-card flex flex-col items-start gap-3 p-8">
        <p className="max-w-md text-sm leading-relaxed text-slate">
          No completed profiles yet. The executive brief appears once members
          finish their assessments — track progress from the team dashboard.
        </p>
      </div>
    );
  }

  const radarSeries = [
    { label: "Team average", scores: data.averages },
    ...profiles.slice(0, 8).map((profile) => ({
      label: profile.label,
      scores: profile.scores,
      color: `var(--color-disc-${profile.primary.toLowerCase()})`,
    })),
  ];

  return (
    <div
      ref={stageRef}
      className={cn(
        "flex flex-col gap-12 bg-canvas",
        presentation && "presentation-scale overflow-y-auto px-8 py-10 lg:px-16 lg:py-14",
      )}
    >
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2.5 print:hidden">
        {departments.length > 1 ? (
          <select
            aria-label="Filter by sub team"
            value={department ?? ""}
            onChange={(event) => setDepartment(event.target.value || null)}
            className="rounded-full border border-hairline bg-paper px-4 py-1.5 text-xs text-slate focus:border-botanical focus:outline-none"
          >
            <option value="">All sub teams</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        ) : null}
        {data.named ? (
          <button
            type="button"
            onClick={() => setShowNames((value) => !value)}
            aria-pressed={showNames}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs transition-colors",
              showNames
                ? "border-botanical text-botanical"
                : "border-hairline text-slate hover:text-ink",
            )}
          >
            {showNames ? "Names on" : "Anonymized"}
          </button>
        ) : (
          <span className="rounded-full border border-hairline px-4 py-1.5 text-xs text-faint">
            Anonymized
          </span>
        )}
        <button
          type="button"
          onClick={togglePresentation}
          aria-pressed={presentation}
          className={cn(
            "rounded-full px-5 py-1.5 text-xs font-medium transition-colors",
            presentation
              ? "bg-botanical text-mineral"
              : "border border-hairline text-slate hover:border-botanical hover:text-botanical",
          )}
        >
          {presentation ? "Exit presentation" : "Presentation mode"}
        </button>
        <Link
          href={`/app/teams/${data.teamId}/presentation`}
          className="rounded-full border border-hairline px-4 py-1.5 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
        >
          Open deck
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto rounded-full border border-hairline px-4 py-1.5 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
        >
          Export PDF
        </button>
      </div>

      {/* 01 — headline */}
      <motion.header
        className="flex flex-col gap-6"
        initial={reduced ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.32, 0.94, 0.6, 1] }}
      >
        <Eyebrow>Executive brief · {data.teamName}</Eyebrow>
        <p
          className={cn(
            "font-display leading-snug text-ink",
            presentation ? "pres-h1 pres-measure" : "max-w-4xl text-h2",
          )}
        >
          {leadSentences(data.cultureSummary)}
        </p>
        <div className="grid grid-cols-2 gap-6 rule-t pt-6 sm:grid-cols-4">
          <Metric
            presentation={presentation}
            value={`${data.completedCount}/${data.memberCount}`}
            label="Profiles completed"
            detail={`${completionRate}% completion`}
          />
          <Metric
            presentation={presentation}
            value={String(data.balance.index)}
            label="DISC balance index"
            detail={data.balance.label}
          />
          <Metric
            presentation={presentation}
            value={dimensionMeta[
              DIMENSIONS.reduce((lead, dim) =>
                data.averages[DIMENSION_KEY[dim]] > data.averages[DIMENSION_KEY[lead]]
                  ? dim
                  : lead,
              )
            ].label}
            label="Leading energy"
            detail="Team centre of gravity"
          />
          <Metric
            presentation={presentation}
            value={data.decision.label}
            label="Decision style"
            detail={`${data.decision.actionBias} action · ${data.decision.deliberation} deliberate`}
          />
        </div>
      </motion.header>

      {/* 02 — team radar + averages */}
      <Section
        index={2}
        eyebrow="Profile"
        title="The team at a glance"
        presentation={presentation}
      >
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="paper-card flex flex-col gap-4 p-7">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
              Team radar
            </h3>
            <DiscRadarOverlay
              series={radarSeries}
              className="mx-auto max-w-[var(--pres-chart-lg,420px)]"
            />
            {profiles.length > 8 ? (
              <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                Showing the team average and the first 8 profiles
              </p>
            ) : null}
          </div>
          <div className="paper-card flex flex-col gap-7 p-7">
            <div className="flex flex-col gap-3">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
                Average DISC profile
              </h3>
              <DimensionBarChart scores={data.averages} />
            </div>
            <div className="flex flex-col gap-3 rule-t pt-6">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
                Behaviour distribution
              </h3>
              <DistributionBar
                slices={data.distribution}
                size={presentation ? "lg" : "md"}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* 03 — balance + strength */}
      <Section
        index={3}
        eyebrow="Balance"
        title="How evenly the energies are held"
        presentation={presentation}
      >
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="paper-card flex flex-col gap-5 p-7">
            <Metric
              presentation={presentation}
              value={String(data.balance.index)}
              label={`DISC balance · ${data.balance.label}`}
            />
            <div className="h-3 overflow-hidden rounded-full bg-ink/8">
              <motion.div
                className="h-full rounded-full bg-botanical"
                data-print-reveal="width"
                style={
                  { "--print-reveal-width": `${data.balance.index}%` } as React.CSSProperties
                }
                initial={reduced ? { width: `${data.balance.index}%` } : { width: 0 }}
                whileInView={{ width: `${data.balance.index}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.32, 0.94, 0.6, 1] }}
              />
            </div>
            <p className="text-sm leading-relaxed text-slate">{data.balance.detail}</p>
          </div>

          <div className="paper-card flex flex-col gap-4 p-7">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
              Strength distribution
            </h3>
            <p className="text-sm leading-relaxed text-slate">
              How many people can operate in each mode when it is called for —
              independent of which style leads them, so these do not sum to 100.
            </p>
            <div className="flex flex-col gap-4 pt-1">
              {data.strengths.map((band, index) => (
                <div key={band.dimension} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs text-slate sm:w-24 sm:text-sm">
                    {dimensionMeta[band.dimension].label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-[4px] bg-ink/8">
                    <motion.div
                      className="h-full rounded-[4px]"
                      data-print-reveal="width"
                      style={
                        {
                          background: `var(--color-disc-${band.dimension.toLowerCase()})`,
                          "--print-reveal-width": `${band.percentage}%`,
                        } as React.CSSProperties
                      }
                      initial={reduced ? { width: `${band.percentage}%` } : { width: 0 }}
                      whileInView={{ width: `${band.percentage}%` }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.7,
                        delay: index * 0.08,
                        ease: [0.32, 0.94, 0.6, 1],
                      }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right font-mono text-xs text-ink">
                    {band.count} · {band.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* 04 — member map */}
      <Section
        index={4}
        eyebrow="Composition"
        title="Where each person sits"
        presentation={presentation}
      >
        <div className="paper-card p-6">
          <TeamQuadrantMap
            profiles={profiles}
            presentation={presentation}
            className="mx-auto w-full max-w-[var(--pres-chart-lg,48rem)]"
          />
        </div>
      </Section>

      {/* 05 — communication + decision */}
      <Section
        index={5}
        eyebrow="Operating style"
        title="How this team communicates and decides"
        presentation={presentation}
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="paper-card flex flex-col gap-4 p-7">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
              Communication tendencies
            </h3>
            <ul className="flex flex-col gap-4">
              {data.communication
                .filter((entry) => entry.count > 0)
                .map((entry) => (
                  <li key={entry.dimension} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        className={cn(
                          "font-display font-semibold text-ink",
                          presentation ? "text-xl" : "text-base",
                        )}
                      >
                        {entry.style}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-faint">
                        {entry.count} · {entry.share}%
                      </span>
                    </div>
                    <span
                      className="text-sm leading-snug"
                      style={{
                        color: `var(--color-disc-${entry.dimension.toLowerCase()})`,
                      }}
                    >
                      {dimensionMeta[entry.dimension].label}
                    </span>
                    <span className="text-sm leading-relaxed text-slate">{entry.risk}</span>
                  </li>
                ))}
            </ul>
          </div>

          <div className="paper-card flex flex-col gap-5 p-7">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
              Decision style · {data.decision.label}
            </h3>
            <div className="flex flex-col gap-5 pt-1">
              {[
                {
                  label: "Action bias",
                  value: data.decision.actionBias,
                  color: "var(--color-disc-d)",
                },
                {
                  label: "Deliberation",
                  value: data.decision.deliberation,
                  color: "var(--color-disc-c)",
                },
              ].map((meter, index) => (
                <div key={meter.label} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm text-slate">
                    <span>{meter.label}</span>
                    <span className="font-mono text-ink">{meter.value}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-ink/8">
                    <motion.div
                      className="h-full rounded-full"
                      data-print-reveal="width"
                      style={
                        {
                          background: meter.color,
                          "--print-reveal-width": `${meter.value}%`,
                        } as React.CSSProperties
                      }
                      initial={reduced ? { width: `${meter.value}%` } : { width: 0 }}
                      whileInView={{ width: `${meter.value}%` }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.7,
                        delay: index * 0.1,
                        ease: [0.32, 0.94, 0.6, 1],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm leading-relaxed text-slate">{data.decision.detail}</p>
          </div>
        </div>
      </Section>

      {/* 06 — collaboration */}
      <Section
        index={6}
        eyebrow="Collaboration"
        title="What it is like to work inside this team"
        presentation={presentation}
      >
        <div className="paper-card p-8">
          <p
            className={cn(
              "font-display leading-relaxed text-ink",
              presentation ? "pres-h3 pres-measure" : "max-w-4xl text-lead",
            )}
          >
            {data.collaboration}
          </p>
        </div>
      </Section>

      {/* 07 — risks */}
      <Section
        index={7}
        eyebrow="Risk"
        title="Where this composition will cost you"
        presentation={presentation}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {data.risks.map((risk) => (
            <div
              key={risk.title}
              className={cn(
                "paper-card flex flex-col gap-2.5 p-6",
                risk.severity === "high" && "border-disc-d/40",
              )}
            >
              <span
                className={cn(
                  "self-start rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em]",
                  risk.severity === "high"
                    ? "bg-disc-d-soft text-disc-d"
                    : "bg-disc-i-soft text-disc-i",
                )}
              >
                {risk.severity === "high" ? "High attention" : "Watch"}
              </span>
              <h3
                className={cn(
                  "font-display font-semibold text-ink",
                  presentation ? "text-xl" : "text-base",
                )}
              >
                {risk.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate">{risk.detail}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 08 — facilitator insights */}
      <Section
        index={8}
        eyebrow="Facilitation"
        title="Generated talking points"
        presentation={presentation}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {data.insights.map((insight) => {
            const tone = insightTone[insight.tone];
            return (
              <div key={insight.title} className="paper-card flex flex-col gap-2.5 p-6">
                <span
                  className={cn(
                    "font-mono text-[11px] uppercase tracking-[0.16em]",
                    tone.className,
                  )}
                >
                  {tone.label}
                </span>
                <h3
                  className={cn(
                    "font-display font-semibold text-ink",
                    presentation ? "text-xl" : "text-base",
                  )}
                >
                  {insight.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate">{insight.detail}</p>
              </div>
            );
          })}
        </div>
        <p className="max-w-3xl text-xs leading-relaxed text-faint">
          These insights describe team composition and working preferences.
          They are not a measure of ability, health or suitability for a role,
          and must not be used for selection decisions.
        </p>
      </Section>
    </div>
  );
}
