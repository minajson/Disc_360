import { PageContainer } from "@/components/layout/PageContainer";
import { GlowPulse } from "@/components/motion/GlowPulse";
import { GradientText } from "@/components/ui/GradientText";
import { LinkButton } from "@/components/ui/LinkButton";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-t border-line">
      <div aria-hidden className="atlas-grid absolute inset-0" />
      <GlowPulse className="-bottom-56 left-1/2 -translate-x-1/2" size={800} />

      <PageContainer className="relative flex flex-col items-center gap-7 py-24 text-center sm:py-32">
        <h2 className="max-w-3xl font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl">
          Seven minutes from now, you&rsquo;ll have{" "}
          <GradientText>language for how you operate</GradientText>.
        </h2>
        <p className="max-w-xl text-base leading-relaxed text-ink-secondary">
          24 forced-choice decisions. No right answers. One precise behavioral
          profile — yours to keep, compare, and build on.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <LinkButton href="/assessment" size="lg">
            Start your assessment
          </LinkButton>
          <LinkButton href="/dashboard" size="lg" variant="ghost">
            View your dashboard
          </LinkButton>
        </div>
      </PageContainer>
    </section>
  );
}
