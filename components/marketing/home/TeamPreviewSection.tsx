import { SectionHeading } from "@/components/ui/SectionHeading";
import { TeamCultureMapScene } from "@/components/media/TeamCultureMapScene";

const teamAnswers = [
  "Which styles dominate — and which voice is missing",
  "Where communication friction is most likely",
  "Complementary pairings worth putting on one problem",
  "How the culture shifts when pressure arrives",
];

export function TeamPreviewSection() {
  return (
    <section className="bg-mineral rule-t rule-b">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
        <div className="flex flex-col gap-8">
          <SectionHeading
            index="04"
            eyebrow="Team intelligence"
            title="Your team, on one honest map"
            description="Completed profiles become a culture read — named or anonymized, your call."
          />
          <ul className="flex flex-col gap-3">
            {teamAnswers.map((answer) => (
              <li key={answer} className="flex items-start gap-3 text-sm leading-relaxed text-slate">
                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-teal" />
                {answer}
              </li>
            ))}
          </ul>
        </div>
        <TeamCultureMapScene className="mx-auto w-full max-w-xl" />
      </div>
    </section>
  );
}
