import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/marketing/PageIntro";
import { CtaBand } from "@/components/marketing/CtaBand";
import { DimensionMark } from "@/components/ui/DimensionMark";
import { insightMap } from "@/data/insight-maps";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSIONS, type Dimension } from "@/lib/types";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "Practical guides to working with each DISC style — drawn from the same insight engine that writes DISC360 reports.",
};

/** Pure-archetype guidance doubles as style guidance for the dimension. */
const guideFor = (dim: Dimension) => insightMap[dim];

const practiceGuides = [
  {
    id: "reading-your-report",
    title: "How to read your DISC360 report",
    paragraphs: [
      "Start with the summary and resist the urge to argue with it — the profile describes tendencies, not verdicts. Highlight the two sentences that feel most accurate and the one that stings; the stinging one is usually the working edge.",
      "Then read the blind spots as costs of strengths, not flaws. Every blind spot in your report is a strength applied at the wrong dose or moment. The growth recommendation at the end gives you one deliberate practice — pick it up for two weeks before reading anything else.",
      "Finally, share the 'communicating with you' section with one colleague. The report earns its keep the first time someone adapts to you — or you to them — on purpose.",
    ],
  },
  {
    id: "running-a-team-debrief",
    title: "Running your first team debrief",
    paragraphs: [
      "Book sixty minutes and open the presentation mode on the room's screen. Start with the culture map, not individual profiles — the team should meet itself as a shape before anyone looks for their own dot.",
      "Ask three questions in order: What do we have a lot of? What are we missing? Where would the missing voice have changed a recent decision? Let the room answer before showing the friction and pairing sections.",
      "Close with one working agreement per gap — concrete, dated, owned. Anonymized mode is available if the team is new to this; named maps work better once trust exists.",
    ],
  },
];

export default function ResourcesPage() {
  return (
    <>
      <PageIntro
        eyebrow="Resources"
        title="Field guides for the four styles."
        lead="Short, practical reads drawn from the same insight engine that writes DISC360 reports. Free to use inside your team."
      >
        <nav aria-label="Guides" className="flex flex-wrap gap-2 pt-2">
          {DIMENSIONS.map((dim) => (
            <Link
              key={dim}
              href={`#working-with-${dimensionMeta[dim].label.toLowerCase()}`}
              className="rounded-full border border-hairline bg-paper px-4 py-2 text-xs font-medium text-slate transition-colors hover:border-botanical hover:text-botanical"
            >
              Working with {dimensionMeta[dim].label}
            </Link>
          ))}
          {practiceGuides.map((guide) => (
            <Link
              key={guide.id}
              href={`#${guide.id}`}
              className="rounded-full border border-hairline bg-paper px-4 py-2 text-xs font-medium text-slate transition-colors hover:border-botanical hover:text-botanical"
            >
              {guide.title}
            </Link>
          ))}
        </nav>
      </PageIntro>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-5 pb-20 sm:px-8">
        {DIMENSIONS.map((dim) => {
          const meta = dimensionMeta[dim];
          const guide = guideFor(dim);
          return (
            <article
              key={dim}
              id={`working-with-${meta.label.toLowerCase()}`}
              className="paper-card scroll-mt-24 p-8 sm:p-10"
            >
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-3">
                  <DimensionMark dimension={dim} />
                  <h2 className="font-display text-h3 font-semibold">
                    Working with {meta.label} colleagues
                  </h2>
                </div>
                <p className="max-w-3xl text-sm leading-relaxed text-slate">
                  {meta.essence} At their best: {guide.tagline.toLowerCase()}{" "}
                  Under pressure: {meta.underPressure.toLowerCase()}
                </p>
                <div className="grid gap-8 lg:grid-cols-2">
                  <div className="flex flex-col gap-3">
                    <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-botanical">
                      Do
                    </h3>
                    <ul className="flex flex-col gap-2.5">
                      {guide.communication.do.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate">
                          <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" fill="none" stroke="var(--color-disc-s)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M3 8.5 6.5 12 13 4.5" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-col gap-3">
                    <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-disc-d">
                      Avoid
                    </h3>
                    <ul className="flex flex-col gap-2.5">
                      {guide.communication.dont.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate">
                          <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" fill="none" stroke="var(--color-disc-d)" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                            <path d="M4 4l8 8M12 4l-8 8" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </article>
          );
        })}

        {practiceGuides.map((guide) => (
          <article key={guide.id} id={guide.id} className="paper-card scroll-mt-24 p-8 sm:p-10">
            <div className="flex max-w-3xl flex-col gap-5">
              <h2 className="font-display text-h3 font-semibold">{guide.title}</h2>
              {guide.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 24)} className="text-sm leading-relaxed text-slate">
                  {paragraph}
                </p>
              ))}
            </div>
          </article>
        ))}
      </div>

      <CtaBand
        title="The guides work better with a profile in hand."
        primary={{ href: "/sign-up", label: "Take the assessment" }}
      />
    </>
  );
}
