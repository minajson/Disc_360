import { PageContainer } from "@/components/layout/PageContainer";
import { DimensionalHero } from "@/components/motion/DimensionalHero";
import { CognitiveOrbit } from "@/components/motion/CognitiveOrbit";
import { Badge } from "@/components/ui/Badge";
import { GradientText } from "@/components/ui/GradientText";
import { LinkButton } from "@/components/ui/LinkButton";

export function HeroSection() {
  return (
    <DimensionalHero glow="hero">
      <PageContainer className="relative grid items-center gap-14 py-20 sm:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:py-32">
        <div className="flex flex-col items-start gap-7">
          <Badge tone="accent">Personality intelligence platform</Badge>

          <h1 className="font-display text-4xl font-bold leading-[1.06] tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Decode how people <GradientText>lead</GradientText>,{" "}
            <GradientText>communicate</GradientText>, decide, and respond
            under pressure.
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-ink-secondary text-pretty">
            Disc360 maps behavior across four dimensions — Dominant, Influence,
            Stable, and Analytical — and turns a seven-minute assessment into
            an executive-grade profile you can act on.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <LinkButton href="/assessment" size="lg">
              Start your assessment
            </LinkButton>
            <LinkButton href="/team" size="lg" variant="outline">
              Explore team intelligence
            </LinkButton>
          </div>

          <p className="font-mono text-xs tracking-wide text-ink-muted">
            24 forced-choice decisions · ~7 minutes · instant profile
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[440px] lg:max-w-none">
          <CognitiveOrbit className="mx-auto max-w-[460px]" />
        </div>
      </PageContainer>
    </DimensionalHero>
  );
}
