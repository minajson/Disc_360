"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DimensionBarChart } from "@/components/charts/DimensionBarChart";
import { TeamQuadrantMap } from "@/components/teams/TeamQuadrantMap";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSIONS } from "@/lib/types";
import type { TeamIntelligence } from "@/lib/insights/team";

const narrativeStyles = {
  strength: { label: "Strength", className: "text-disc-s" },
  gap: { label: "Watch out", className: "text-disc-d" },
  balance: { label: "Balance", className: "text-disc-c" },
} as const;

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="font-display text-h3 font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function TeamIntelligenceView({ data }: { data: TeamIntelligence }) {
  const [density, setDensity] = useState<"executive" | "analytical">("executive");
  const [department, setDepartment] = useState<string | null>(null);

  const filteredProfiles = useMemo(
    () =>
      department === null
        ? data.profiles
        : data.profiles.filter((profile) => profile.department === department),
    [data.profiles, department],
  );

  const analytical = density === "analytical";

  if (data.completedCount === 0) {
    return (
      <div className="paper-card flex flex-col items-start gap-3 p-8">
        <p className="max-w-md text-sm leading-relaxed text-slate">
          No completed profiles yet. The team intelligence report appears once
          members finish their assessments — track progress from the Campaigns
          tab.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div role="group" aria-label="Information density" className="flex rounded-full border border-hairline bg-paper p-1">
          {(["executive", "analytical"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={density === mode}
              onClick={() => setDensity(mode)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors",
                density === mode ? "bg-botanical text-mineral" : "text-slate hover:text-ink",
              )}
            >
              {mode} view
            </button>
          ))}
        </div>

        {data.departments.length > 1 ? (
          <div role="group" aria-label="Filter map by department" className="flex flex-wrap gap-1.5">
            <button
              type="button"
              aria-pressed={department === null}
              onClick={() => setDepartment(null)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                department === null
                  ? "border-botanical text-botanical"
                  : "border-hairline text-slate hover:text-ink",
              )}
            >
              All departments
            </button>
            {data.departments.map((dept) => (
              <button
                key={dept}
                type="button"
                aria-pressed={department === dept}
                onClick={() => setDepartment(dept)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                  department === dept
                    ? "border-botanical text-botanical"
                    : "border-hairline text-slate hover:text-ink",
                )}
              >
                {dept}
              </button>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto rounded-full border border-hairline px-4 py-1.5 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
        >
          Export PDF
        </button>
      </div>

      {!data.named ? (
        <p className="rounded-2xl border border-sage bg-sage/20 px-5 py-3 text-sm text-slate">
          This team reports anonymously — members appear as letters, never
          names. The setting is controlled in Team settings.
        </p>
      ) : null}

      {/* culture */}
      <Section eyebrow="Culture" title="What this team is like">
        <p className="max-w-3xl font-display text-lg leading-relaxed text-ink">
          {data.cultureSummary}
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          {data.narrative.map((item) => {
            const style = narrativeStyles[item.kind];
            return (
              <div key={item.title} className="paper-card flex flex-col gap-2.5 p-6">
                <span className={cn("font-mono text-[11px] uppercase tracking-[0.16em]", style.className)}>
                  {style.label}
                </span>
                <h3 className="font-display text-base font-semibold text-ink">{item.title}</h3>
                <p className="text-sm leading-relaxed text-slate">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* composition + map */}
      <Section eyebrow="Composition" title="Who carries which energy">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <TeamQuadrantMap profiles={filteredProfiles} className="paper-card p-4" />
          <div className="paper-card flex flex-col gap-7 p-7">
            <div className="flex flex-col gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                Primary styles · {data.completedCount} of {data.memberCount} completed
              </span>
              <div className="flex h-3 w-full overflow-hidden rounded-full" role="img"
                aria-label={DIMENSIONS.map((dim) => `${dimensionMeta[dim].label}: ${data.composition[dim]}`).join(", ")}>
                {DIMENSIONS.map((dim) =>
                  data.composition[dim] > 0 ? (
                    <div
                      key={dim}
                      className="h-full border-r-2 border-paper last:border-r-0"
                      style={{
                        width: `${(data.composition[dim] / data.completedCount) * 100}%`,
                        background: `var(--color-${dimensionMeta[dim].colorVar})`,
                      }}
                    />
                  ) : null,
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {DIMENSIONS.map((dim) => (
                  <span key={dim} className="flex items-center gap-1.5 text-xs text-slate">
                    <span aria-hidden className="size-2 rounded-full" style={{ background: `var(--color-${dimensionMeta[dim].colorVar})` }} />
                    {dimensionMeta[dim].label}
                    <span className="font-mono text-faint">{data.composition[dim]}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                Team averages
              </span>
              <DimensionBarChart scores={data.averages} />
            </div>
          </div>
        </div>
      </Section>

      {/* pressure */}
      <Section eyebrow="Under pressure" title="What changes when it matters">
        <p className="max-w-3xl text-sm leading-relaxed text-slate">{data.pressureShift}</p>
      </Section>

      {/* gaps + risks */}
      <Section eyebrow="Friction" title="Where communication can break">
        <div className="grid gap-4 lg:grid-cols-2">
          {data.communicationGaps.map((gap) => (
            <div key={gap.between.join("-")} className="paper-card flex flex-col gap-3.5 p-6">
              <span className="font-display text-sm font-semibold text-ink">
                {gap.between[0]} ↔ {gap.between[1]}
              </span>
              <p className="text-sm leading-relaxed text-slate">{gap.friction}</p>
              <div className="rule-t pt-3.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-teal">
                  The bridge
                </span>
                <p className="pt-1 text-sm leading-relaxed text-slate">{gap.bridge}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {data.riskZones.map((zone) => (
            <div
              key={zone.title}
              className={cn(
                "paper-card flex flex-col gap-2.5 p-6",
                zone.severity === "high" && "border-disc-d/40",
              )}
            >
              <span
                className={cn(
                  "self-start rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em]",
                  zone.severity === "high" ? "bg-disc-d-soft text-disc-d" : "bg-disc-i-soft text-disc-i",
                )}
              >
                {zone.severity === "high" ? "High attention" : "Watch"}
              </span>
              <h3 className="font-display text-base font-semibold text-ink">{zone.title}</h3>
              <p className="text-sm leading-relaxed text-slate">{zone.detail}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* analytical extras */}
      {analytical ? (
        <>
          <Section eyebrow="Pairings" title="Who complements — and who collides">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="paper-card flex flex-col gap-4 p-6">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-disc-s">
                  Complementary pairings
                </span>
                {data.complementaryPairs.length > 0 ? (
                  <ul className="flex flex-col gap-3.5">
                    {data.complementaryPairs.map((pair) => (
                      <li key={`${pair.aIndex}-${pair.bIndex}`} className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-ink">
                          {data.profiles[pair.aIndex]?.label} + {data.profiles[pair.bIndex]?.label}
                        </span>
                        <span className="text-sm leading-relaxed text-slate">{pair.reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate">No strong complementary pairs detected yet.</p>
                )}
              </div>
              <div className="paper-card flex flex-col gap-4 p-6">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-disc-d">
                  Friction-risk pairings
                </span>
                {data.frictionPairs.length > 0 ? (
                  <ul className="flex flex-col gap-3.5">
                    {data.frictionPairs.map((pair) => (
                      <li key={`${pair.aIndex}-${pair.bIndex}`} className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-ink">
                          {data.profiles[pair.aIndex]?.label} ↔ {data.profiles[pair.bIndex]?.label}
                        </span>
                        <span className="text-sm leading-relaxed text-slate">{pair.reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate">No high-tension pairs detected.</p>
                )}
              </div>
            </div>
          </Section>

          <Section eyebrow="Profiles" title="Completed profiles">
            <div className="paper-card divide-y divide-hairline p-0">
              {filteredProfiles.map((profile) => (
                <div key={profile.label} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3.5">
                  <span className="min-w-32 text-sm font-medium text-ink">{profile.label}</span>
                  <span className="text-xs text-slate">{profile.department ?? "—"}</span>
                  <span className="font-mono text-xs text-teal">{profile.archetypeName}</span>
                  <span className="ml-auto font-mono text-[11px] text-faint">
                    D {profile.scores.d} · I {profile.scores.i} · S {profile.scores.s} · A {profile.scores.c}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </>
      ) : null}

      {/* actions */}
      <Section eyebrow="Next moves" title="Recommended actions">
        <div className="grid gap-4 lg:grid-cols-2">
          {(["team", "coach"] as const).map((audience) => (
            <div key={audience} className="paper-card flex flex-col gap-4 p-6">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal">
                {audience === "team" ? "For the team" : "For the coach or manager"}
              </span>
              <ol className="flex flex-col gap-3">
                {data.actions
                  .filter((action) => action.audience === audience)
                  .map((action, index) => (
                    <li key={action.action} className="flex items-start gap-3 text-sm leading-relaxed text-slate">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-hairline font-mono text-[11px] text-faint">
                        {index + 1}
                      </span>
                      {action.action}
                    </li>
                  ))}
              </ol>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
