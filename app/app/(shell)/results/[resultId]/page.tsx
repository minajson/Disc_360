import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { requireResultReleased } from "@/lib/teams/session-guard";
import { insightMap, type ArchetypeInsight } from "@/data/insight-maps";
import { dimensionMeta } from "@/data/dimension-meta";
import { contrastingTendency } from "@/lib/scoring/archetype";
import { displayArchetypeCode } from "@/lib/utils/display";
import { buildSharedReportUrl, getPublicBaseUrl } from "@/lib/utils/site-url";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DimensionMark } from "@/components/ui/DimensionMark";
import { ExpandableSection } from "@/components/ui/ExpandableSection";
import { ReportActionBar } from "@/components/report/ReportActionBar";
import { ProfileExplanation } from "@/components/report/ProfileExplanation";
import { BehaviourCompass } from "@/components/visualisations/disc/BehaviourCompass";
import { DimensionBarChart } from "@/components/charts/DimensionBarChart";
import {
  BehavioralBalanceChart,
  CommunicationPreferenceChart,
  DevelopmentFocusChart,
  PressureResponseChart,
} from "@/components/charts/DerivedCharts";
import { DIMENSIONS, type ArchetypeCode, type Dimension, type DiscScores } from "@/lib/types";

export const metadata: Metadata = { title: "Your profile" };

function Points({ items, color = "var(--color-teal)" }: { items: string[]; color?: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate">
          <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ background: color }} />
          {item}
        </li>
      ))}
    </ul>
  );
}

const CONTRAST_CHIP: Record<Dimension, string> = {
  D: "border-disc-d/40 text-disc-d",
  I: "border-disc-i/40 text-disc-i",
  S: "border-disc-s/40 text-disc-s",
  C: "border-disc-c/40 text-disc-c",
};

/**
 * The interpretive hierarchy of the profile: primary style, the strong
 * contrasting tendency the blend code cannot express (the opposite-pair rule
 * suppressed it), the supporting dimension, and the formal blend. Values are
 * the participant's actual scores — the engine is untouched; this makes its
 * reading visible.
 */
function ProfileHierarchy({
  scores,
  primary,
  secondary,
  contrasting,
  code,
}: {
  scores: DiscScores;
  primary: Dimension;
  secondary: Dimension | null;
  contrasting: Dimension | null;
  code: ArchetypeCode;
}) {
  const score = (dim: Dimension) =>
    scores[dim.toLowerCase() as keyof DiscScores];
  const rows: { label: string; dim?: Dimension; value?: string }[] = [
    { label: "Primary behavioural style", dim: primary },
    ...(contrasting ? [{ label: "Strong contrasting tendency", dim: contrasting }] : []),
    ...(secondary ? [{ label: "Supporting profile dimension", dim: secondary }] : []),
    { label: "Formal blend", value: displayArchetypeCode(code) },
  ];
  return (
    <dl className="flex flex-col divide-y divide-hairline/70 border-y border-hairline/70">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
            {row.label}
          </dt>
          <dd className="text-sm font-medium text-ink">
            {row.dim ? (
              <>
                {dimensionMeta[row.dim].label}
                <span className="text-faint"> — </span>
                <span className="font-mono tabular-nums">{score(row.dim)}</span>
              </>
            ) : (
              <span className="font-mono">{row.value}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Section({
  title,
  chart,
  children,
}: {
  title: string;
  chart?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="paper-card flex flex-col gap-4 p-6 sm:p-7">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {children}
      {chart ? <div className="rule-t pt-4">{chart}</div> : null}
    </section>
  );
}

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ resultId: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const { resultId } = await params;
  const { autoprint } = await searchParams;
  const { supabase } = await requireOnboarded();
  // Facilitator-led release gate: held results bounce to the session card.
  await requireResultReleased("disc");

  const { data: result } = await supabase
    .from("assessment_results")
    .select(
      "id, share_token, score_d, score_i, score_s, score_c, archetype_code, primary_dimension, secondary_dimension, raw_most, raw_least, net, created_at, result_insights (insight_snapshot)",
    )
    .eq("id", resultId)
    .maybeSingle();
  if (!result) notFound();

  const scores: DiscScores = {
    d: result.score_d,
    i: result.score_i,
    s: result.score_s,
    c: result.score_c,
  };
  const code = result.archetype_code as ArchetypeCode;
  const primary = result.primary_dimension as Dimension;
  const secondary = (result.secondary_dimension as Dimension | null) ?? null;
  const contrasting = contrastingTendency(scores);
  const snapshotRow = Array.isArray(result.result_insights)
    ? result.result_insights[0]
    : result.result_insights;
  const insight: ArchetypeInsight =
    (snapshotRow?.insight_snapshot as unknown as ArchetypeInsight) ?? insightMap[code];

  const twoSentenceSummary = insight.summary.split(". ").slice(0, 2).join(". ") + ".";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-8 sm:px-8">
      <ReportActionBar
        resultId={result.id}
        shareUrl={buildSharedReportUrl(getPublicBaseUrl(), result.share_token)}
        autoprint={autoprint === "1"}
      />

      {/* top summary — Behaviour Compass hero; the radar remains available in
          the derived-charts section as the secondary quantitative view */}
      <header className="paper-card grid gap-8 p-7 sm:grid-cols-[1fr_1.05fr] sm:items-center sm:p-9">
        <BehaviourCompass
          scores={scores}
          primary={primary}
          secondary={secondary}
          balanced={code === "BAL"}
          className="mx-auto max-w-[380px]"
        />
        <div className="flex flex-col gap-4">
          <Eyebrow>Your profile · {displayArchetypeCode(code)}</Eyebrow>
          <h1 className="font-display text-h2 font-semibold">{insight.name}</h1>
          <div className="flex flex-wrap gap-2">
            <DimensionMark dimension={primary} />
            {secondary ? <DimensionMark dimension={secondary} /> : null}
            {contrasting ? (
              <span
                className={`inline-flex items-center rounded-full border bg-transparent px-3 py-1 text-xs font-medium ${CONTRAST_CHIP[contrasting]}`}
              >
                Strong {dimensionMeta[contrasting].displayCode} tendency
              </span>
            ) : null}
          </div>
          {code !== "BAL" ? (
            <ProfileHierarchy
              scores={scores}
              primary={primary}
              secondary={secondary}
              contrasting={contrasting}
              code={code}
            />
          ) : null}
          <p className="text-sm leading-relaxed text-slate">{twoSentenceSummary}</p>
          <DimensionBarChart scores={scores} />
        </div>
      </header>

      {/* balance charts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="paper-card flex flex-col gap-4 p-6">
          <h2 className="font-display text-base font-semibold">Behavioral balance</h2>
          <BehavioralBalanceChart scores={scores} />
        </div>
        <div className="paper-card flex flex-col gap-4 p-6">
          <h2 className="font-display text-base font-semibold">Communication mix</h2>
          <CommunicationPreferenceChart scores={scores} />
        </div>
      </div>

      {/* full scoring transparency — the WHY behind the profile */}
      <Section title="Why this profile">
        <ProfileExplanation
          rawMost={result.raw_most as unknown as DiscScores}
          rawLeast={result.raw_least as unknown as DiscScores}
          net={result.net as unknown as DiscScores}
          normalized={scores}
          primary={primary}
          secondary={secondary}
          archetypeCode={code}
        />
      </Section>

      <div id="report-sections" className="flex scroll-mt-28 flex-col gap-4">
        <Section title="Strengths">
          <Points
            items={insight.strengths.slice(0, 4).map((s) => s.title)}
            color="var(--color-disc-s)"
          />
          <ExpandableSection>
            <div className="flex flex-col gap-3">
              {insight.strengths.map((s) => (
                <p key={s.title} className="text-sm leading-relaxed text-slate">
                  <span className="font-medium text-ink">{s.title}.</span> {s.detail}
                </p>
              ))}
            </div>
          </ExpandableSection>
        </Section>

        <Section title="Communication">
          <Points items={insight.communicationStyle.slice(0, 3)} />
          <ExpandableSection label="How others should work with you">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-disc-s">Do</span>
                <Points items={insight.communication.do} color="var(--color-disc-s)" />
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-disc-d">Avoid</span>
                <Points items={insight.communication.dont} color="var(--color-disc-d)" />
              </div>
            </div>
          </ExpandableSection>
        </Section>

        <Section title="Leadership">
          <p className="text-sm font-medium text-ink">{insight.leadershipStyle.headline}</p>
          <Points items={insight.leadershipStyle.bullets} />
          <ExpandableSection>
            <p className="text-sm leading-relaxed text-slate">
              {insight.leadershipStyle.description}
            </p>
          </ExpandableSection>
        </Section>

        <Section title="Conflict">
          <p className="text-sm font-medium text-ink">{insight.conflictResponse.headline}</p>
          <Points items={insight.conflictResponse.tips} />
          <ExpandableSection>
            <p className="text-sm leading-relaxed text-slate">
              {insight.conflictResponse.description}
            </p>
          </ExpandableSection>
        </Section>

        <Section
          title="Under pressure"
          chart={<PressureResponseChart scores={scores} />}
        >
          <Points
            items={insight.stressResponse.triggers.slice(0, 3)}
            color="var(--color-disc-d)"
          />
          <ExpandableSection label="Behaviors and recovery">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Under pressure</span>
                <Points items={insight.stressResponse.behaviors} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Recovery</span>
                <Points items={insight.stressResponse.recovery} color="var(--color-disc-s)" />
              </div>
            </div>
          </ExpandableSection>
        </Section>

        <Section title="Growth" chart={<DevelopmentFocusChart scores={scores} />}>
          <p className="text-sm leading-relaxed text-slate">{insight.coaching}</p>
          <ExpandableSection label="Motivators and stressors">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-disc-s">Fuels you</span>
                <Points items={insight.motivators} color="var(--color-disc-s)" />
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-disc-d">Drains you</span>
                <Points items={insight.drainers} color="var(--color-disc-d)" />
              </div>
            </div>
          </ExpandableSection>
        </Section>

        <Section title="Working with others">
          <div className="grid gap-4 sm:grid-cols-2">
            {DIMENSIONS.map((dim) => {
              const guide = insightMap[dim];
              return (
                <div key={dim} className="flex flex-col gap-2.5 rounded-2xl border border-hairline p-4">
                  <div className="flex items-center justify-between">
                    <DimensionMark dimension={dim} />
                    {dim === primary ? (
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
                        Your style
                      </span>
                    ) : null}
                  </div>
                  <Points items={guide.communication.do.slice(0, 2)} />
                </div>
              );
            })}
          </div>
          <ExpandableSection label="Under-pressure signals per style">
            <div className="flex flex-col gap-2">
              {DIMENSIONS.map((dim) => (
                <p key={dim} className="text-sm leading-relaxed text-slate">
                  <span className="font-medium text-ink">{dimensionMeta[dim].label}:</span>{" "}
                  {dimensionMeta[dim].underPressure}
                </p>
              ))}
            </div>
          </ExpandableSection>
        </Section>
      </div>

      <footer className="flex flex-col items-center gap-2 pb-6 text-center">
        <span className="font-mono text-xs text-faint">
          Completed{" "}
          {new Date(result.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
        <p className="max-w-md text-xs leading-relaxed text-faint">
          A development tool — not a medical, clinical or employment-selection
          instrument.
        </p>
      </footer>
    </div>
  );
}
