import { Eyebrow } from "@/components/ui/Eyebrow";
import { LinkButton } from "@/components/ui/LinkButton";
import { KineticHeadline } from "@/components/motion/KineticHeadline";
import { HeroFilmPlaceholder } from "@/components/media/HeroFilmPlaceholder";
import { DiscSpectrumScene } from "@/components/media/DiscSpectrumScene";
import { DiscRadarChart } from "@/components/charts/DiscRadarChart";

export function HomeHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid w-full max-w-7xl gap-14 px-5 pb-10 pt-16 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-8">
        {/* editorial statement */}
        <div className="relative z-10 flex flex-col items-start gap-8">
          <Eyebrow>Personality intelligence platform</Eyebrow>
          <KineticHeadline
            text="Understand how people lead, communicate and respond when it matters."
            accents={["lead", "communicate", "respond"]}
            className="text-display"
          />
          <p className="max-w-xl text-lead text-slate text-pretty">
            Seven honest minutes. Practical guidance in the language of
            Dominant, Influence, Stable and Analytical.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <LinkButton href="/sign-up" size="lg">
              Take the individual assessment
            </LinkButton>
            <LinkButton href="/sign-up?intent=team" size="lg" variant="outline">
              Create a team
            </LinkButton>
          </div>
        </div>

        {/* layered editorial composition */}
        <div className="relative mx-auto w-full max-w-[520px] lg:max-w-none">
          <HeroFilmPlaceholder
            className="lg:translate-x-6"
            src="/media/hero.webm"
            mp4Src="/media/hero.mp4"
            poster="/media/hero-poster.jpg"
            mobileSrc="/media/hero-mobile.webm"
            mobileMp4Src="/media/hero-mobile.mp4"
            mobilePoster="/media/hero-mobile-poster.jpg"
          />
          {/* overlapping report fragment */}
          <div className="paper-card absolute -bottom-10 -left-3 w-44 rotate-[-3deg] p-4 sm:w-52 sm:-left-8">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              Live profile
            </span>
            <DiscRadarChart
              scores={{ d: 74, i: 62, s: 34, c: 48 }}
              showScores={false}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* dimensional spectrum */}
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="rule-t grid gap-6 pb-4 pt-10 lg:grid-cols-[0.55fr_1.45fr] lg:items-center">
          <p className="max-w-xs text-sm leading-relaxed text-slate">
            Four dimensions, one continuous spectrum. Every profile is a blend
            — move across it to see how the energies connect.
          </p>
          <DiscSpectrumScene className="max-h-[420px]" />
        </div>
      </div>
    </section>
  );
}
