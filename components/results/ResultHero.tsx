import { Badge } from "@/components/ui/Badge";
import { DimensionPill } from "@/components/ui/DimensionPill";
import { ArchetypeBadge } from "@/components/results/ArchetypeBadge";
import { TraitConstellation } from "@/components/motion/TraitConstellation";
import type { ArchetypeInsight } from "@/data/insight-maps";
import type { Result } from "@/lib/types";

interface ResultHeroProps {
  result: Result;
  insight: ArchetypeInsight;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export function ResultHero({ result, insight }: ResultHeroProps) {
  return (
    <div className="relative flex flex-col items-center gap-6 text-center">
      <TraitConstellation
        scores={result.normalized}
        className="absolute -top-24 left-1/2 w-[420px] max-w-none -translate-x-1/2 opacity-60 print:hidden"
      />
      <Badge tone="accent">Your Disc360 profile</Badge>
      <ArchetypeBadge code={result.archetypeCode} />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          {insight.name}
        </h1>
        <p className="text-lg text-ink-secondary">{insight.tagline}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <DimensionPill dimension={result.primaryDimension} />
        {result.secondaryDimension ? (
          <DimensionPill dimension={result.secondaryDimension} />
        ) : null}
      </div>

      <p className="max-w-2xl text-base leading-relaxed text-ink-secondary text-pretty">
        {insight.summary}
      </p>

      <span className="font-mono text-xs tracking-wide text-ink-muted">
        Completed {formatDate(result.createdAt)}
      </span>
    </div>
  );
}
