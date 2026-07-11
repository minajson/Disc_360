import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { insightMap, type ArchetypeInsight } from "@/data/insight-maps";
import { displayArchetypeCode } from "@/lib/utils/display";
import { DimensionMark } from "@/components/ui/DimensionMark";
import { ResultsRevealScene } from "@/components/media/ResultsRevealScene";
import { MotionSection } from "@/components/motion/MotionSection";
import { ReportActions } from "@/components/report/ReportActions";
import {
  AdaptationGrid,
  BulletPanel,
  DoDontPanel,
  ReportSection,
  ScorePanel,
  TitledCards,
  TriColumnPanel,
} from "@/components/report/ReportSections";
import type {
  ArchetypeCode,
  Dimension,
  DiscScores,
  IntensityBand,
} from "@/lib/types";

export const metadata: Metadata = { title: "Your profile" };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export default async function ResultPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const { resultId } = await params;
  const { supabase } = await requireOnboarded();

  // RLS: readable only by the owner.
  const { data: result } = await supabase
    .from("assessment_results")
    .select(
      "id, score_d, score_i, score_s, score_c, archetype_code, primary_dimension, secondary_dimension, intensity, created_at, result_insights (insight_snapshot)",
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
  const archetypeCode = result.archetype_code as ArchetypeCode;
  const primary = result.primary_dimension as Dimension;
  const secondary = (result.secondary_dimension as Dimension | null) ?? null;
  const intensity = result.intensity as Record<Dimension, IntensityBand>;

  const snapshotRow = Array.isArray(result.result_insights)
    ? result.result_insights[0]
    : result.result_insights;
  const insight: ArchetypeInsight =
    (snapshotRow?.insight_snapshot as unknown as ArchetypeInsight) ??
    insightMap[archetypeCode];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-16 px-5 py-12 sm:px-8 sm:py-16">
      {/* reveal */}
      <header className="flex flex-col items-center gap-7 text-center">
        <ResultsRevealScene scores={scores} className="max-w-[300px]" />
        <div className="flex flex-col items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
            Your DISC360 profile · {displayArchetypeCode(archetypeCode)}
          </span>
          <h1 className="font-display text-h1 font-semibold text-balance">
            {insight.name}
          </h1>
          <p className="text-lead text-slate">{insight.tagline}</p>
          <div className="flex items-center gap-2 pt-1">
            <DimensionMark dimension={primary} />
            {secondary ? <DimensionMark dimension={secondary} /> : null}
          </div>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-slate text-pretty">
          {insight.summary}
        </p>
        <span className="font-mono text-xs text-faint">
          Completed {formatDate(result.created_at)}
        </span>
        <ReportActions resultId={result.id} />
      </header>

      <MotionSection as="div">
        <ReportSection
          eyebrow="Distribution"
          title="Your four dimensions"
          description="Normalized scores from your forced choices. 50 is neutral — distance from the midline shows how strongly a dimension shapes your behavior."
        >
          <ScorePanel
            scores={scores}
            intensity={intensity}
            archetypeCode={archetypeCode}
            primary={primary}
            secondary={secondary}
          />
        </ReportSection>
      </MotionSection>

      <MotionSection>
        <ReportSection eyebrow="Your voice" title="How you naturally communicate">
          <BulletPanel items={insight.communicationStyle} />
        </ReportSection>
      </MotionSection>

      <MotionSection>
        <ReportSection
          eyebrow="Working with you"
          title="How others should communicate with you"
          description="Share this section — it turns your style from a surprise into an instruction manual."
        >
          <DoDontPanel communication={insight.communication} />
        </ReportSection>
      </MotionSection>

      <MotionSection>
        <ReportSection eyebrow="Decisions & leadership" title={insight.leadershipStyle.headline}>
          <div className="paper-card flex flex-col gap-5 p-7 sm:p-9">
            <p className="max-w-2xl text-sm leading-relaxed text-slate">
              {insight.leadershipStyle.description}
            </p>
            <ul className="flex flex-col gap-2.5">
              {insight.leadershipStyle.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3 text-sm leading-relaxed text-slate">
                  <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-botanical" />
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        </ReportSection>
      </MotionSection>

      <MotionSection>
        <ReportSection eyebrow="Conflict" title={insight.conflictResponse.headline}>
          <div className="paper-card flex flex-col gap-5 p-7 sm:p-9">
            <p className="max-w-2xl text-sm leading-relaxed text-slate">
              {insight.conflictResponse.description}
            </p>
            <div className="flex flex-col gap-2.5 rule-t pt-5">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                Handling it better
              </span>
              <ul className="flex flex-col gap-2.5">
                {insight.conflictResponse.tips.map((tip) => (
                  <li key={tip} className="flex items-start gap-3 text-sm leading-relaxed text-slate">
                    <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-teal" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ReportSection>
      </MotionSection>

      <MotionSection>
        <ReportSection
          eyebrow="Under pressure"
          title="Your stress response"
          description="Pressure concentrates who you are. Know the triggers, name the behaviors, use the recovery."
        >
          <TriColumnPanel stressResponse={insight.stressResponse} />
        </ReportSection>
      </MotionSection>

      <MotionSection>
        <ReportSection eyebrow="Motivation" title="What fuels you — and what drains you">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="paper-card flex flex-col gap-4 p-7">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-disc-s">
                Motivators
              </h3>
              <ul className="flex flex-col gap-2.5">
                {insight.motivators.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-slate">
                    <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-disc-s" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="paper-card flex flex-col gap-4 p-7">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-disc-d">
                Stressors
              </h3>
              <ul className="flex flex-col gap-2.5">
                {insight.drainers.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-slate">
                    <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-disc-d" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ReportSection>
      </MotionSection>

      <MotionSection>
        <ReportSection
          eyebrow="Blind spots"
          title="Where your strengths overreach"
          description="Not flaws — strengths applied at the wrong dose or the wrong moment."
        >
          <TitledCards entries={insight.blindSpots} accent="caution" />
        </ReportSection>
      </MotionSection>

      <MotionSection>
        <ReportSection eyebrow="Strengths" title="Where you create outsized value">
          <TitledCards entries={insight.strengths} />
        </ReportSection>
      </MotionSection>

      <MotionSection>
        <ReportSection eyebrow="Growth" title="Your coaching recommendation">
          <div className="paper-card border-botanical/30 p-7 sm:p-9">
            <p className="max-w-3xl font-display text-lg font-medium leading-relaxed text-ink">
              {insight.coaching}
            </p>
          </div>
        </ReportSection>
      </MotionSection>

      <MotionSection>
        <ReportSection eyebrow="Environment" title="Your ideal working conditions">
          <BulletPanel items={insight.idealEnvironment} />
        </ReportSection>
      </MotionSection>

      <MotionSection>
        <ReportSection
          eyebrow="Collaboration"
          title="Working with every style"
          description="Quick guidance for adapting to each of the four styles — including your own."
        >
          <AdaptationGrid ownPrimary={primary} />
        </ReportSection>
      </MotionSection>

      <footer className="flex flex-col items-center gap-6 rule-t pt-10 text-center">
        <ReportActions resultId={result.id} />
        <p className="max-w-md text-xs leading-relaxed text-faint">
          This report describes behavioral preferences based on your own
          answers. It is a development tool — not a medical, clinical or
          employment-selection instrument.
        </p>
      </footer>
    </div>
  );
}
