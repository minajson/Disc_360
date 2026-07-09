import { GlassPanel } from "@/components/ui/GlassPanel";
import { Badge } from "@/components/ui/Badge";
import { GradientText } from "@/components/ui/GradientText";
import { DimensionPill } from "@/components/ui/DimensionPill";
import { StartAssessmentButton } from "@/components/assessment/StartAssessmentButton";
import { TOTAL_QUESTIONS } from "@/data/disc-questions";
import { DIMENSIONS } from "@/lib/types";

const steps = [
  {
    title: "Read each scenario",
    detail: `${TOTAL_QUESTIONS} short scenarios, four behaviors each.`,
  },
  {
    title: "Pick MOST and LEAST",
    detail: "Choose the behavior most like you — and the one least like you.",
  },
  {
    title: "Get your profile",
    detail: "Scores across all four dimensions, your archetype, and a full report.",
  },
];

export function AssessmentIntro() {
  return (
    <div className="flex flex-col items-center gap-10 text-center">
      <div className="flex flex-col items-center gap-5">
        <Badge tone="accent">The Disc360 assessment</Badge>
        <h1 className="max-w-2xl font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          There are no right answers — only <GradientText>your answers</GradientText>.
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-ink-secondary">
          Go with your first instinct. The assessment measures how you actually
          operate, not how you&rsquo;d like to. It takes about seven minutes.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {DIMENSIONS.map((dim) => (
            <DimensionPill key={dim} dimension={dim} />
          ))}
        </div>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <GlassPanel key={step.title} className="flex flex-col gap-3 p-6 text-left">
            <span className="font-mono text-xs text-accent">0{index + 1}</span>
            <h2 className="font-display text-base font-semibold text-ink">
              {step.title}
            </h2>
            <p className="text-sm leading-relaxed text-ink-secondary">
              {step.detail}
            </p>
          </GlassPanel>
        ))}
      </div>

      <StartAssessmentButton />
    </div>
  );
}
