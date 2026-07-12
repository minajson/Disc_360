import { SectionHeading } from "@/components/ui/SectionHeading";

const previewOptions = [
  "Take charge and push decisions forward",
  "Energize people and keep morale high",
  "Keep the group calm and steady",
  "Analyze the details before committing",
];

/** Faithful, styled still of the two-stage assessment interaction. */
export function AssessmentPreviewSection() {
  return (
    <section className="bg-mineral rule-t">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
        <SectionHeading
          index="02"
          eyebrow="The assessment"
          title="Two calm decisions per scenario. Nothing else on screen."
          description="Pick MOST, then LEAST. Autosaved, resumable, ~7 minutes."
        />

        <div aria-hidden className="relative mx-auto w-full max-w-lg">
          <div className="paper-card flex flex-col gap-6 p-7 sm:p-9">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
                Scenario 7 of 24
              </span>
              <span className="font-mono text-[11px] text-teal">Saved</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-ink/8">
              <div className="h-full w-[29%] rounded-full bg-botanical" />
            </div>
            <p className="font-display text-h3 font-semibold text-balance">
              When a team is under pressure, which is most like you?
            </p>
            <div className="flex flex-col gap-2.5">
              {previewOptions.map((option, index) => (
                <div
                  key={option}
                  className={
                    index === 0
                      ? "flex items-center justify-between rounded-2xl border-2 border-botanical bg-sage/25 px-5 py-4 text-sm font-medium text-ink"
                      : "flex items-center justify-between rounded-2xl border border-hairline bg-paper px-5 py-4 text-sm text-slate"
                  }
                >
                  {option}
                  {index === 0 ? (
                    <span className="rounded-full bg-botanical px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-mineral">
                      Most
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
              Next: which is least like you?
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
