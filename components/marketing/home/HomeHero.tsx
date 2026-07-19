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
          {/* Live Profile — an authentic result resting over the desk area,
              never the faces. Sizes step down on smaller viewports; the
              gentle float lives in .live-profile-card (reduced-motion: static). */}
          <div className="relative z-10 -mt-12 ml-3 w-40 rotate-[-2.5deg] sm:absolute sm:-bottom-10 sm:-left-6 sm:ml-0 sm:mt-0 sm:w-40 lg:-bottom-11 lg:-left-9 lg:w-44">
            <div className="live-profile-card p-3.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-teal">
                Live profile
              </span>
              <p className="mt-0.5 font-display text-[15px] font-semibold leading-tight text-ink">
                Stable + Analytical
              </p>
              <dl className="mt-1.5 flex flex-col gap-0.5 border-y border-hairline/60 py-1.5">
                {[
                  ["Primary", "Stable"],
                  ["Contrast", "Dominant"],
                  ["Supporting", "Analytical"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3">
                    <dt className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-faint">
                      {label}
                    </dt>
                    <dd className="text-[11px] font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              <DiscRadarChart
                scores={{ d: 54, i: 42, s: 56, c: 48 }}
                showScores
                className="mt-1.5"
              />
            </div>
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
