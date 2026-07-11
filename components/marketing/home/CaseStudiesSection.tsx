import { SectionHeading } from "@/components/ui/SectionHeading";
import { CaseStudyFilmPlaceholder } from "@/components/media/CaseStudyFilmPlaceholder";

const scenarios = [
  {
    quote:
      "The quadrant map ended a year-long argument in twenty minutes. Our 'communication problem' was two high-Dominant leads and a silent Stable majority.",
    attribution: "Engineering director, 40-person org",
  },
  {
    quote:
      "I run every leadership offsite on the presentation mode now. Teams see themselves on the screen and the conversation starts itself.",
    attribution: "Independent leadership coach",
  },
];

export function CaseStudiesSection() {
  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-5 py-20 sm:px-8 lg:py-24">
      <SectionHeading
        index="06"
        eyebrow="In practice"
        title="What teams do with it"
        description="Illustrative scenarios drawn from how DISC-based debriefs typically play out — your case studies will live here."
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <CaseStudyFilmPlaceholder />
        <div className="flex flex-col gap-5">
          {scenarios.map((scenario) => (
            <figure key={scenario.attribution} className="paper-card flex flex-1 flex-col gap-4 p-7">
              <svg viewBox="0 0 24 24" className="size-6" fill="var(--color-sage)" aria-hidden>
                <path d="M4 12c0-4 2.5-7 6-8v3c-1.8.7-3 2.3-3 4.2V12h3v8H4v-8Zm10 0c0-4 2.5-7 6-8v3c-1.8.7-3 2.3-3 4.2V12h3v8h-6v-8Z" />
              </svg>
              <blockquote className="font-display text-lg leading-snug text-ink">
                {scenario.quote}
              </blockquote>
              <figcaption className="mt-auto font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                {scenario.attribution} · illustrative
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
