import { SectionHeading } from "@/components/ui/SectionHeading";
import { DimensionMark } from "@/components/ui/DimensionMark";
import { ResultsRevealScene } from "@/components/media/ResultsRevealScene";
import { DimensionBarChart } from "@/components/charts/DimensionBarChart";
import type { DiscScores } from "@/lib/types";

const sampleScores: DiscScores = { d: 74, i: 62, s: 34, c: 48 };

const reportSections = [
  "Behavioral overview and hybrid blend",
  "Natural communication style — and how to adapt it",
  "Decision-making, leadership and teamwork",
  "Conflict response and behavior under pressure",
  "Motivators, stressors and possible blind spots",
  "Growth recommendations and ideal working conditions",
];

export function ReportPreviewSection() {
  return (
    <section className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
      <div className="relative order-2 mx-auto w-full max-w-md lg:order-1">
        <ResultsRevealScene scores={sampleScores} />
        <div className="paper-card absolute -right-2 bottom-2 w-56 rotate-[2.5deg] p-5 sm:-right-8">
          <div className="mb-3 flex items-center gap-1.5">
            <DimensionMark dimension="D" compact />
            <DimensionMark dimension="I" compact />
            <span className="ml-1 font-display text-sm font-semibold text-ink">
              The Catalyst
            </span>
          </div>
          <DimensionBarChart scores={sampleScores} />
        </div>
      </div>

      <div className="order-1 flex flex-col gap-8 lg:order-2">
        <SectionHeading
          index="03"
          eyebrow="The report"
          title="A working document, not a certificate"
          description="Every profile reads like guidance from a good coach — specific, humane, and immediately usable in your next difficult conversation."
        />
        <ul className="flex flex-col gap-3">
          {reportSections.map((section) => (
            <li key={section} className="flex items-start gap-3 text-sm leading-relaxed text-slate">
              <svg
                viewBox="0 0 16 16"
                className="mt-0.5 size-4 shrink-0"
                fill="none"
                stroke="var(--color-botanical)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M3 8.5 6.5 12 13 4.5" />
              </svg>
              {section}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
