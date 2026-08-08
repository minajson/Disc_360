"use client";

import { DiscRadarOverlay } from "@/components/charts/DiscRadarOverlay";
import { DimensionBarChart } from "@/components/charts/DimensionBarChart";
import { DistributionBar } from "@/components/charts/DistributionBar";
import { TeamQuadrantMap } from "@/components/teams/TeamQuadrantMap";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSION_KEY, DIMENSIONS, type Dimension, type DiscScores } from "@/lib/types";
import {
  coverageReading,
  participationRate,
  reportFindings,
  teamFacingActions,
  tensionPairs,
} from "@/lib/insights/report";
import type {
  CommunicationGap,
  RiskZone,
  TeamAction,
  TeamMemberProfile,
  TeamNarrativeItem,
} from "@/lib/insights/team";
import type {
  CommunicationTendency,
  DecisionStyle,
  DistributionSlice,
  StrengthBand,
} from "@/lib/insights/board";

/**
 * The Team Intelligence report, as a document.
 *
 * This is the printed artefact, not the dashboard. The interactive view stays
 * exactly as it is and is hidden for print; this composes the same numbers —
 * every one of them already computed by `lib/insights/team.ts` and
 * `lib/insights/board.ts` — into fixed pages a manager can read end to end.
 *
 * Two consequences of being a document rather than a screen:
 *
 *   · Pagination is explicit. Each page is a block with `break-after: page`,
 *     so the report is seven pages by construction instead of wherever the
 *     content happened to fall, and a chart can never straddle a page.
 *   · The participant roster is absent. A team report is about how the team
 *     operates; several pages of "Member A, Member B" is a register, and it
 *     is still available on the web view for the people who need it.
 */

export interface TeamReportData {
  teamName: string;
  named: boolean;
  memberCount: number;
  completedCount: number;
  averages: DiscScores;
  composition: Record<Dimension, number>;
  profiles: TeamMemberProfile[];
  cultureSummary: string;
  pressureShift: string;
  narrative: TeamNarrativeItem[];
  communicationGaps: CommunicationGap[];
  riskZones: RiskZone[];
  actions: TeamAction[];
  /** Derived by lib/insights/board.ts on the server — never recomputed here. */
  balance: { index: number; label: string; detail: string };
  distribution: DistributionSlice[];
  strength: StrengthBand[];
  tendencies: CommunicationTendency[];
  decision: DecisionStyle;
}

const tone = (dim: Dimension) => `var(--color-${dimensionMeta[dim].colorVar})`;

/* ── page chrome ─────────────────────────────────────────────────── */

function ReportPage({
  index,
  total,
  teamName,
  eyebrow,
  title,
  lead,
  children,
}: {
  index: number;
  total: number;
  teamName: string;
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="report-page">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-teal">
          {String(index).padStart(2, "0")} · {eyebrow}
        </span>
        <h2 className="font-display text-[30px] font-semibold leading-tight text-ink">{title}</h2>
        {lead ? <p className="max-w-2xl text-[14px] leading-relaxed text-slate">{lead}</p> : null}
      </header>

      <div className="report-body">{children}</div>

      <footer className="report-footer">
        <span>
          DISC360 · Team Intelligence · {teamName}
          <span className="px-2 text-hairline-strong">|</span>
          Confidential
        </span>
        <span className="font-mono tabular-nums">
          {index} / {total}
        </span>
      </footer>
    </section>
  );
}

/** A chart and its caption travel together — never split across pages. */
function Figure({
  label,
  children,
  caption,
  className,
}: {
  label: string;
  children: React.ReactNode;
  caption?: string;
  className?: string;
}) {
  return (
    <figure className={`report-figure ${className ?? ""}`}>
      <figcaption className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
        {label}
      </figcaption>
      {children}
      {caption ? <p className="text-[12px] leading-relaxed text-slate">{caption}</p> : null}
    </figure>
  );
}

function Indicator({
  value,
  label,
  note,
  accent,
}: {
  value: string;
  label: string;
  note?: string;
  accent?: string;
}) {
  return (
    <div className="report-indicator">
      <span
        className="font-display text-[34px] font-semibold leading-none text-ink"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">{label}</span>
      {note ? <span className="text-[12px] leading-snug text-slate">{note}</span> : null}
    </div>
  );
}

/* ── the document ────────────────────────────────────────────────── */

export function TeamIntelligenceReport({ data }: { data: TeamReportData }) {
  const total = 7;
  const coverage = coverageReading(data.averages);
  const participation = participationRate(data.completedCount, data.memberCount);
  const tensions = tensionPairs(data.communicationGaps);
  const actions = teamFacingActions(data.actions);
  const findings = reportFindings(data.narrative, data.riskZones);

  if (data.completedCount === 0) return null;

  return (
    <div className="report-doc" data-report="team-intelligence">
      {/* ── 1 · snapshot ── */}
      <section className="report-page">
        <header className="flex flex-col gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">Team</span>
          <span className="font-display text-[22px] font-semibold text-ink">{data.teamName}</span>
          <h1 className="font-display text-[46px] font-semibold leading-[1.05] text-ink">
            Team Intelligence
          </h1>
        </header>

        <div className="report-body">
          <p className="max-w-3xl font-display text-[19px] leading-[1.55] text-ink">
            {data.cultureSummary}
          </p>

          <div className="report-indicator-row">
            <Indicator
              value={`${data.completedCount}/${data.memberCount}`}
              label="Profiles completed"
              note={`${participation}% participation`}
            />
            <Indicator
              value={String(data.balance.index)}
              label="DISC balance"
              note={data.balance.label}
            />
            <Indicator
              value={dimensionMeta[coverage.centreOfGravity].label}
              label="Leading energy"
              note={`Average ${data.averages[DIMENSION_KEY[coverage.centreOfGravity]]}`}
              accent={tone(coverage.centreOfGravity)}
            />
            <Indicator
              value={`${coverage.spread} pts`}
              label="Behavioural spread"
              note={`${dimensionMeta[coverage.centreOfGravity].label} to ${dimensionMeta[coverage.thinnestCoverage].label}`}
            />
          </div>

          <div className="report-grid-3 report-fill">
            {data.narrative.map((item) => (
              <div key={item.title} className="report-card">
                <span
                  className="font-mono text-[10.5px] uppercase tracking-[0.18em]"
                  style={{
                    color:
                      item.kind === "strength"
                        ? "var(--color-disc-s)"
                        : item.kind === "gap"
                          ? "var(--color-disc-d)"
                          : "var(--color-disc-c)",
                  }}
                >
                  {item.kind === "strength" ? "Strength" : item.kind === "gap" ? "Watch out" : "Balance"}
                </span>
                <h3 className="font-display text-[15px] font-semibold text-ink">{item.title}</h3>
                <p className="text-[12px] leading-relaxed text-slate">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <footer className="report-footer">
          <span>
            DISC360 · Team Intelligence · {data.teamName}
            <span className="px-2 text-hairline-strong">|</span>
            Confidential
          </span>
          <span className="font-mono tabular-nums">1 / {total}</span>
        </footer>
      </section>

      {/* ── 2 · shape ── */}
      <ReportPage
        index={2}
        total={total}
        teamName={data.teamName}
        eyebrow="Shape"
        title="The behavioural shape of this team"
        lead="The team's average profile across the four energies, and how its primary styles are distributed."
      >
        <Figure
          label="Team profile · average across completed assessments"
          className="report-figure-hero"
        >
          <DiscRadarOverlay
            series={[{ label: "Team average", scores: data.averages }]}
            showScores
            showLegend={false}
            className="mx-auto h-full w-full max-w-[118mm] self-center"
          />
        </Figure>

        <div className="report-grid-2">
          <Figure
            label="Primary style distribution"
            caption={`${data.completedCount} completed profile${data.completedCount === 1 ? "" : "s"}, by the style that leads each of them.`}
          >
            <DistributionBar slices={data.distribution} className="w-full" />
          </Figure>

          <Figure
            label="Team average energies"
            caption={`${dimensionMeta[coverage.centreOfGravity].label} leads at ${data.averages[DIMENSION_KEY[coverage.centreOfGravity]]}; ${dimensionMeta[coverage.thinnestCoverage].label} is thinnest at ${data.averages[DIMENSION_KEY[coverage.thinnestCoverage]]}.`}
          >
            <DimensionBarChart scores={data.averages} />
          </Figure>
        </div>
      </ReportPage>

      {/* ── 3 · composition & coverage ── */}
      <ReportPage
        index={3}
        total={total}
        teamName={data.teamName}
        eyebrow="Composition"
        title="Where the team is concentrated, and where it is thin"
      >
        <div className="report-split report-fill">
          <Figure label="Composition map" className="report-figure-hero">
            <TeamQuadrantMap profiles={data.profiles} className="w-full" />
          </Figure>

          <div className="flex flex-col gap-3">
            {(
              [
                ["Centre of gravity", coverage.centreOfGravity],
                ["Secondary energy", coverage.secondaryEnergy],
                ["Thinnest coverage", coverage.thinnestCoverage],
              ] as const
            ).map(([label, dim]) => (
              <div key={label} className="report-reading">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
                  {label}
                </span>
                <span
                  className="font-display text-[19px] font-semibold"
                  style={{ color: tone(dim) }}
                >
                  {dimensionMeta[dim].label}
                </span>
                <span className="font-mono text-[11.5px] tabular-nums text-slate">
                  Average {data.averages[DIMENSION_KEY[dim]]} ·{" "}
                  {data.composition[dim] === 0
                    ? "nobody leads with it"
                    : `${data.composition[dim]} lead${data.composition[dim] === 1 ? "s" : ""} with it`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Figure
          label={`How evenly the energies are held · balance ${data.balance.index} · ${data.balance.label}`}
          caption={data.balance.detail}
        >
          <div className="flex flex-col gap-2 pt-1">
            {data.strength.map((band) => (
              <div key={band.dimension} className="flex items-center gap-3">
                <span className="w-[74px] shrink-0 text-[13px] text-ink">
                  {dimensionMeta[band.dimension].label}
                </span>
                <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-ink/8">
                  <div
                    data-print-reveal="width"
                    className="h-full rounded-full"
                    style={
                      {
                        width: `${band.percentage}%`,
                        background: tone(band.dimension),
                        "--print-reveal-width": `${band.percentage}%`,
                      } as React.CSSProperties
                    }
                  />
                </div>
                <span className="w-[62px] shrink-0 text-right font-mono text-[11.5px] tabular-nums text-slate">
                  {band.count} · {band.percentage}%
                </span>
              </div>
            ))}
          </div>
        </Figure>
      </ReportPage>

      {/* ── 4 · communication & decisions ── */}
      <ReportPage
        index={4}
        total={total}
        teamName={data.teamName}
        eyebrow="Operating style"
        title="How this team communicates and decides"
        lead="What to expect from meetings, discussion and the moment a decision has to be made."
      >
        <Figure label="Communication tendencies · share of primary styles">
          <div className="flex flex-col gap-2.5 pt-1">
            {data.tendencies.map((tendency) => (
              <div key={tendency.dimension} className="flex flex-col gap-1">
                <div className="flex items-baseline gap-3">
                  <span className="text-[13px] font-medium text-ink">{tendency.style}</span>
                  <span className="ml-auto font-mono text-[12px] tabular-nums text-slate">
                    {tendency.share}%
                  </span>
                </div>
                <div className="h-[6px] w-full overflow-hidden rounded-full bg-ink/8">
                  <div
                    data-print-reveal="width"
                    className="h-full rounded-full"
                    style={
                      {
                        width: `${tendency.share}%`,
                        background: tone(tendency.dimension),
                        "--print-reveal-width": `${tendency.share}%`,
                      } as React.CSSProperties
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </Figure>

        {tensions.length > 0 ? (
          <Figure
            label="Communication dynamics · the relationships this team actually holds"
            caption="Drawn from the style pairs present on this roster — a tension only appears when both sides of it exist here."
          >
            <div className="report-dynamics">
              {tensions.map((pair) => (
                <div key={`${pair.a}-${pair.b}`} className="report-dynamic">
                  <span className="report-dynamic-node" style={{ color: tone(pair.a) }}>
                    {dimensionMeta[pair.a].displayCode}
                  </span>
                  <span className="report-dynamic-link" aria-hidden />
                  <span className="report-dynamic-node" style={{ color: tone(pair.b) }}>
                    {dimensionMeta[pair.b].displayCode}
                  </span>
                  <span className="report-dynamic-label">{pair.label}</span>
                </div>
              ))}
            </div>
          </Figure>
        ) : null}

        <Figure label={`Decision behaviour · ${data.decision.label}`} caption={data.decision.detail}>
          <div className="flex items-center gap-4 pt-1">
            <Indicator value={String(data.decision.actionBias)} label="Action bias" />
            <span aria-hidden className="h-8 w-px bg-hairline" />
            <Indicator value={String(data.decision.deliberation)} label="Deliberation" />
            <span aria-hidden className="h-8 w-px bg-hairline" />
            <Indicator
              value={`${data.decision.tilt > 0 ? "+" : ""}${data.decision.tilt}`}
              label="Tilt"
              note={data.decision.tilt >= 0 ? "toward action" : "toward verification"}
            />
          </div>
        </Figure>
      </ReportPage>

      {/* ── 5 · where communication can break ── */}
      <ReportPage
        index={5}
        total={total}
        teamName={data.teamName}
        eyebrow="Friction"
        title="Where communication can break"
        lead="Each relationship below exists on this roster. The bridge is the intervention."
      >
        <div className="flex flex-col gap-4 report-fill">
          {data.communicationGaps.map((gap, index) => {
            const pair = tensions[index];
            return (
              <article key={gap.between.join("-")} className="report-card report-friction">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-display text-[17px] font-semibold text-ink">
                    {gap.between[0]} <span className="text-faint">↔</span> {gap.between[1]}
                  </h3>
                  {pair ? (
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-teal">
                      {pair.label}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
                    What it looks like
                  </span>
                  <p className="text-[13px] leading-relaxed text-slate">{gap.friction}</p>
                </div>

                <div className="report-bridge">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-botanical">
                    The bridge
                  </span>
                  <p className="text-[13px] leading-relaxed text-ink">{gap.bridge}</p>
                </div>
              </article>
            );
          })}
        </div>
      </ReportPage>

      {/* ── 6 · pressure & risk ── */}
      <ReportPage
        index={6}
        total={total}
        teamName={data.teamName}
        eyebrow="Pressure"
        title="What changes when it matters"
      >
        <Figure label="Under pressure">
          <div className="report-pressure">
            <div className="report-pressure-step">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
                Normal state
              </span>
              <span
                className="font-display text-[17px] font-semibold"
                style={{ color: tone(coverage.centreOfGravity) }}
              >
                {dimensionMeta[coverage.centreOfGravity].label} leads
              </span>
            </div>
            <span aria-hidden className="report-pressure-arrow">
              →
            </span>
            <div className="report-pressure-step">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
                Under pressure
              </span>
              <span className="text-[13px] leading-relaxed text-ink">
                {dimensionMeta[coverage.centreOfGravity].underPressure}
              </span>
            </div>
            <span aria-hidden className="report-pressure-arrow">
              →
            </span>
            <div className="report-pressure-step">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
                Counterweight needed
              </span>
              <span
                className="font-display text-[17px] font-semibold"
                style={{ color: tone(coverage.thinnestCoverage) }}
              >
                {dimensionMeta[coverage.thinnestCoverage].label}
              </span>
            </div>
          </div>
          <p className="text-[13px] leading-relaxed text-slate">{data.pressureShift}</p>
        </Figure>

        {data.riskZones.length > 0 ? (
          <div className="flex flex-col gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
              Where this composition may cost the team
            </span>
            {data.riskZones.map((zone) => (
              <article key={zone.title} className="report-card">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]"
                    style={{
                      background:
                        zone.severity === "high" ? "var(--color-disc-d-soft)" : "var(--color-disc-i-soft)",
                      color: zone.severity === "high" ? "var(--color-disc-d)" : "var(--color-disc-i)",
                    }}
                  >
                    {zone.severity === "high" ? "High attention" : "Watch"}
                  </span>
                  <h3 className="font-display text-[15px] font-semibold text-ink">{zone.title}</h3>
                </div>
                <p className="text-[13px] leading-relaxed text-slate">{zone.detail}</p>
              </article>
            ))}
          </div>
        ) : null}
      </ReportPage>

      {/* ── 7 · actions ── */}
      <ReportPage
        index={7}
        total={total}
        teamName={data.teamName}
        eyebrow="Next moves"
        title="Recommended actions"
        lead="For the team. Each action answers something this report found."
      >
        <div className="report-split-actions report-fill">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
              What the report found
            </span>
            <ul className="flex flex-col gap-2">
              {findings.map((finding) => (
                <li key={finding.title} className="text-[13px] leading-snug text-slate">
                  <span className="font-medium text-ink">{finding.title}</span>
                </li>
              ))}
            </ul>
          </div>

          <ol className="flex flex-col gap-3">
            {actions.map((entry, index) => (
              <li key={entry.action} className="report-action">
                <span className="report-action-number">{index + 1}</span>
                <p className="text-[13px] leading-relaxed text-ink">{entry.action}</p>
              </li>
            ))}
          </ol>
        </div>

        <p className="report-note">
          {data.named
            ? "This report describes team behaviour in aggregate. Individual profiles remain with their owners."
            : "This team reports anonymously — no participant is named anywhere in this report."}{" "}
          A development tool, not a medical, clinical or employment-selection instrument.
        </p>
      </ReportPage>
    </div>
  );
}

/** Kept alongside the document so the axis order can never drift from it. */
export const REPORT_DIMENSION_ORDER: readonly Dimension[] = DIMENSIONS;
