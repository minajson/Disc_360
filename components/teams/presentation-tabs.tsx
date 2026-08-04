"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import { insightMap } from "@/data/insight-maps";
import { DonutChart } from "@/components/charts/DonutChart";
import { DiscRadarChart } from "@/components/charts/DiscRadarChart";
import { TeamQuadrantMap } from "@/components/teams/TeamQuadrantMap";
import { DIMENSION_KEY, DIMENSIONS, type Dimension } from "@/lib/types";
import { leadSentences } from "@/lib/insights/board";
import type { TeamIntelligence, TeamMemberProfile } from "@/lib/insights/team";

/**
 * Facilitator tab content. Everything derives from completed profiles plus
 * the static insight maps — concise labels only, no paragraphs.
 */

export interface TabContext {
  data: TeamIntelligence;
  profiles: TeamMemberProfile[]; // display-labeled + department-filtered
  /**
   * ISO timestamp resolved on the server. Tabs that stamp a generation date
   * read it from here rather than calling `new Date()` during render, which
   * would differ between the server and client passes.
   */
  generatedAt: string;
}

/* ── shared bits ────────────────────────────────────────────────────── */

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("paper-card flex flex-col gap-4 p-6", className)}>
      <h3 className="pres-mono font-mono uppercase tracking-[0.2em] text-teal">{title}</h3>
      {children}
    </div>
  );
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="pres-metric font-display font-semibold text-ink">{value}</span>
      <span className="pres-label text-slate">{label}</span>
    </div>
  );
}

function Bullets({ items, color = "var(--color-teal)" }: { items: string[]; color?: string }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="pres-body pres-measure flex items-start gap-3 text-ink">
          <span aria-hidden className="mt-[0.55em] size-2 shrink-0 rounded-full" style={{ background: color }} />
          {item}
        </li>
      ))}
    </ul>
  );
}

const discColor = (dim: Dimension) => `var(--color-disc-${dim.toLowerCase()})`;

function representedDimensions(profiles: TeamMemberProfile[]): Dimension[] {
  const counts = new Map<Dimension, number>();
  for (const profile of profiles) {
    counts.set(profile.primary, (counts.get(profile.primary) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([dim]) => dim);
}

/* ── 1 · Overview ───────────────────────────────────────────────────── */

export function OverviewTab({ data, profiles }: TabContext) {
  const spread = useMemo(() => {
    const values = DIMENSIONS.map((dim) => data.averages[DIMENSION_KEY[dim]]);
    return Math.max(...values) - Math.min(...values);
  }, [data.averages]);
  const balanceScore = Math.max(0, 100 - spread);

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <Panel title="Completion">
        <div className="grid grid-cols-2 gap-6">
          <BigStat value={`${data.completedCount}/${data.memberCount}`} label="profiles completed" />
          <BigStat
            value={`${data.memberCount > 0 ? Math.round((data.completedCount / data.memberCount) * 100) : 0}%`}
            label="completion rate"
          />
          <BigStat value={String(balanceScore)} label="team balance score" />
          <BigStat
            value={dimensionMeta[representedDimensions(profiles)[0] ?? "D"].label}
            label="leading energy"
          />
        </div>
      </Panel>
      <Panel title="Culture in one line">
        <p className="pres-h3 pres-measure font-display text-ink">
          {leadSentences(data.cultureSummary)}
        </p>
        <DonutChart
          centerLabel="primaries"
          segments={DIMENSIONS.map((dim) => ({
            label: dimensionMeta[dim].label,
            value: profiles.filter((p) => p.primary === dim).length,
            color: discColor(dim),
          }))}
          className="pt-2"
        />
      </Panel>
    </div>
  );
}

/* ── 2 · Distribution ───────────────────────────────────────────────── */

export function DistributionTab({ data, profiles }: TabContext) {
  const departmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const profile of profiles) {
      const key = profile.department ?? "No department";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [profiles]);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Primary styles">
        <DonutChart
          centerLabel="primaries"
          segments={DIMENSIONS.map((dim) => ({
            label: dimensionMeta[dim].label,
            value: profiles.filter((p) => p.primary === dim).length,
            color: discColor(dim),
          }))}
        />
      </Panel>
      <Panel title="Team averages">
        <DiscRadarChart scores={data.averages} className="mx-auto max-w-[var(--pres-chart-md,300px)]" />
      </Panel>
      <Panel title="Member map" className="lg:col-span-2">
        <TeamQuadrantMap profiles={profiles} presentation className="mx-auto w-full max-w-[var(--pres-chart-lg,42rem)]" />
      </Panel>
      {departmentCounts.length > 1 ? (
        <Panel title="By department" className="lg:col-span-2">
          <div className="flex flex-wrap gap-3">
            {departmentCounts.map(([department, count]) => (
              <span key={department} className="pres-label rounded-full border border-hairline bg-paper px-4 py-2 text-ink">
                {department} <span className="font-mono text-faint">{count}</span>
              </span>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

/* ── 3 · Communication ─────────────────────────────────────────────── */

const commStyleLabel: Record<Dimension, string> = {
  D: "Direct & brief",
  I: "Expressive & verbal",
  S: "Steady & considered",
  C: "Precise & written",
};

export function CommunicationTab({ data, profiles }: TabContext) {
  const represented = representedDimensions(profiles);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Preferred styles">
        <div className="flex flex-col gap-3">
          {represented.map((dim) => (
            <div key={dim} className="flex items-center gap-3">
              <span aria-hidden className="size-3 rounded-full" style={{ background: discColor(dim) }} />
              <span className="pres-body flex-1 text-ink">{commStyleLabel[dim]}</span>
              <span className="pres-label font-mono text-faint">
                {profiles.filter((p) => p.primary === dim).length}
              </span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Mismatch indicators">
        <div className="flex flex-col gap-4">
          {data.communicationGaps.map((gap) => (
            <div key={gap.between.join("-")} className="flex flex-col gap-1">
              <span className="pres-h3 font-display font-semibold text-ink">
                {gap.between[0]} ↔ {gap.between[1]}
              </span>
              <span className="pres-label leading-snug text-slate">{gap.bridge}</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Manager guidance" className="lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2">
          {represented.slice(0, 4).map((dim) => (
            <div key={dim} className="flex flex-col gap-2">
              <span className="pres-label font-medium" style={{ color: discColor(dim) }}>
                With {dimensionMeta[dim].label} members
              </span>
              <Bullets items={insightMap[dim].communication.do.slice(0, 2)} color={discColor(dim)} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ── 4 · Leadership ────────────────────────────────────────────────── */

export function LeadershipTab({ data, profiles }: TabContext) {
  const represented = representedDimensions(profiles);
  const actionBias = Math.round((data.averages.d + data.averages.i) / 2);
  const deliberation = Math.round((data.averages.s + data.averages.c) / 2);
  const missing = DIMENSIONS.filter((dim) => !profiles.some((p) => p.primary === dim));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Leadership tendencies">
        <div className="flex flex-col gap-4">
          {represented.map((dim) => (
            <div key={dim} className="flex flex-col gap-0.5">
              <span className="pres-h3 font-display font-semibold text-ink">
                {insightMap[dim].leadershipStyle.headline}
              </span>
              <span className="pres-label text-slate">
                {dimensionMeta[dim].label} · {profiles.filter((p) => p.primary === dim).length} member
                {profiles.filter((p) => p.primary === dim).length === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Decision-making balance">
        <div className="flex flex-col gap-5 pt-2">
          {[
            { label: "Action bias", value: actionBias, color: "var(--color-disc-d)" },
            { label: "Deliberation", value: deliberation, color: "var(--color-disc-c)" },
          ].map((meter) => (
            <div key={meter.label} className="flex flex-col gap-1.5">
              <div className="pres-label flex justify-between text-slate">
                <span>{meter.label}</span>
                <span className="font-mono text-ink">{meter.value}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-ink/8">
                <div className="h-full rounded-full" style={{ width: `${meter.value}%`, background: meter.color }} />
              </div>
            </div>
          ))}
          <p className="pres-label leading-snug text-slate">
            {actionBias > deliberation + 10
              ? "Decisions move fast — verification needs a named owner."
              : deliberation > actionBias + 10
                ? "Decisions are careful — deadlock-breaking needs a named owner."
                : "Action and deliberation are in healthy tension."}
          </p>
        </div>
      </Panel>
      <Panel title="Leadership gaps" className="lg:col-span-2">
        {missing.length > 0 ? (
          <Bullets
            items={missing.map(
              (dim) =>
                `No ${dimensionMeta[dim].label}-led voice — ${dimensionMeta[dim].essence.toLowerCase()}`,
            )}
            color="var(--color-disc-d)"
          />
        ) : (
          <p className="pres-body text-ink">All four leadership energies are represented.</p>
        )}
      </Panel>
    </div>
  );
}

/* ── 5 · Conflict ──────────────────────────────────────────────────── */

export function ConflictTab({ data, profiles }: TabContext) {
  const represented = representedDimensions(profiles);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Conflict approaches">
        <div className="flex flex-col gap-3.5">
          {represented.map((dim) => (
            <div key={dim} className="flex items-center gap-3">
              <span aria-hidden className="size-3 rounded-full" style={{ background: discColor(dim) }} />
              <span className="pres-body flex-1 text-ink">
                {insightMap[dim].conflictResponse.headline}
              </span>
              <span className="pres-label font-mono text-faint">
                {profiles.filter((p) => p.primary === dim).length}
              </span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Friction risks">
        {data.frictionPairs.length > 0 ? (
          <div className="flex flex-col gap-3">
            {data.frictionPairs.map((pair) => (
              <div key={`${pair.aIndex}-${pair.bIndex}`} className="flex flex-col gap-0.5">
                <span className="pres-h3 font-display font-semibold text-ink">
                  {data.profiles[pair.aIndex]?.label} ↔ {data.profiles[pair.bIndex]?.label}
                </span>
                <span className="pres-label leading-snug text-slate">{pair.reason}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="pres-body text-ink">No high-tension pairings detected.</p>
        )}
      </Panel>
      <Panel title="Prevention actions" className="lg:col-span-2">
        <Bullets
          items={represented
            .slice(0, 2)
            .flatMap((dim) => insightMap[dim].conflictResponse.tips.slice(0, 2))}
        />
      </Panel>
    </div>
  );
}

/* ── 6 · Pressure ──────────────────────────────────────────────────── */

export function PressureTab({ data, profiles }: TabContext) {
  const represented = representedDimensions(profiles);
  const lead = represented[0] ?? "D";
  const concentration =
    profiles.length > 0
      ? Math.round(
          (profiles.filter((p) => p.primary === lead).length / profiles.length) * 100,
        )
      : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Likely responses">
        <div className="flex flex-col gap-3.5">
          {represented.map((dim) => (
            <div key={dim} className="flex items-start gap-3">
              <span aria-hidden className="mt-1.5 size-3 shrink-0 rounded-full" style={{ background: discColor(dim) }} />
              <div className="flex flex-col gap-0.5">
                <span className="pres-body font-medium text-ink">
                  {dimensionMeta[dim].label}
                </span>
                <span className="pres-label leading-snug text-slate">
                  {dimensionMeta[dim].underPressure}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Risk concentration">
        <BigStat
          value={`${concentration}%`}
          label={`of the team defaults to the ${dimensionMeta[lead].label} pressure response`}
        />
        <p className="pres-label leading-snug text-slate">{data.pressureShift}</p>
      </Panel>
      <Panel title="Recovery guidance" className="lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2">
          {represented.slice(0, 2).map((dim) => (
            <div key={dim} className="flex flex-col gap-2">
              <span className="pres-label font-medium" style={{ color: discColor(dim) }}>
                For {dimensionMeta[dim].label} members
              </span>
              <Bullets items={insightMap[dim].stressResponse.recovery.slice(0, 2)} color={discColor(dim)} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ── 7 · Pairings ──────────────────────────────────────────────────── */

export function PairingsTab({ data }: TabContext) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Complementary pairings">
        {data.complementaryPairs.length > 0 ? (
          <div className="flex flex-col gap-3">
            {data.complementaryPairs.map((pair) => (
              <div key={`${pair.aIndex}-${pair.bIndex}`} className="flex flex-col gap-0.5">
                <span className="pres-h3 font-display font-semibold text-ink">
                  {data.profiles[pair.aIndex]?.label} + {data.profiles[pair.bIndex]?.label}
                </span>
                <span className="pres-label leading-snug text-slate">{pair.reason}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="pres-body text-ink">No strong complements detected yet.</p>
        )}
      </Panel>
      <Panel title="High-friction pairings">
        {data.frictionPairs.length > 0 ? (
          <div className="flex flex-col gap-3">
            {data.frictionPairs.map((pair) => (
              <div key={`${pair.aIndex}-${pair.bIndex}`} className="flex flex-col gap-0.5">
                <span className="pres-h3 font-display font-semibold text-ink">
                  {data.profiles[pair.aIndex]?.label} ↔ {data.profiles[pair.bIndex]?.label}
                </span>
                <span className="pres-label leading-snug text-slate">{pair.reason}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="pres-body text-ink">No high-tension pairings detected.</p>
        )}
      </Panel>

      {/* Member comparison used to live here as a two-select panel. It moved
          to the Compare tab, which does the same job for any number of
          participants — one comparison experience, not two. */}
      <Panel title="Safe collaboration guidance" className="lg:col-span-2">
        <Bullets
          items={[
            "Pair on one real deliverable, not a discussion — complementary styles reveal themselves in delivery, not in theory.",
            "Name the decision runway up front: who decides, by when, and what would change the call.",
            "Ask the quieter style first. The room hears the loudest preference by default, not the best one.",
            "These are working-style pairings, not judgements about people or performance.",
          ]}
        />
      </Panel>
    </div>
  );
}

/* ── 8 · Recommendations ───────────────────────────────────────────── */

export function RecommendationsTab({ data, profiles }: TabContext) {
  const represented = representedDimensions(profiles);
  const lead = represented[0] ?? "D";

  const teamActions = data.actions
    .filter((action) => action.audience === "team")
    .map((action) => action.action);
  const managerActions = data.actions
    .filter((action) => action.audience === "coach")
    .map((action) => action.action);
  const meetingActions = [
    `Open decisions with the ${dimensionMeta[represented[represented.length - 1] ?? "C"].label} question first — the smallest voice goes early`,
    "End every meeting with owners, dates and a definition of done",
  ];
  const communicationCommitments = represented
    .slice(0, 2)
    .map(
      (dim) =>
        `With ${dimensionMeta[dim].label} colleagues: ${insightMap[dim].communication.do[0]?.toLowerCase()}`,
    );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Five team actions">
        <ol className="flex flex-col gap-3">
          {teamActions.concat(meetingActions).slice(0, 5).map((action, index) => (
            <li key={action} className="flex items-start gap-3.5">
              <span className="pres-body flex size-[2em] shrink-0 items-center justify-center rounded-full bg-botanical font-display font-semibold text-mineral">
                {index + 1}
              </span>
              <span className="pres-body pres-measure pt-1 text-ink">{action}</span>
            </li>
          ))}
        </ol>
      </Panel>
      <div className="flex flex-col gap-5">
        <Panel title="Manager actions">
          <Bullets items={managerActions} />
        </Panel>
        <Panel title="Communication commitments">
          <Bullets
            items={communicationCommitments}
            color={`var(--color-disc-${lead.toLowerCase()})`}
          />
        </Panel>
      </div>
    </div>
  );
}
