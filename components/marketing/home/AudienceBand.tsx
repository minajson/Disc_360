import { LinkButton } from "@/components/ui/LinkButton";
import { LeadershipPortraitPlaceholder } from "@/components/media/LeadershipPortraitPlaceholder";

const capabilities = [
  "Client and team workspaces with role-based access",
  "Campaigns with deadlines, reminders and completion tracking",
  "Anonymized or named reporting, decided per team",
  "A presentation mode built for the conference-room screen",
];

export function AudienceBand() {
  return (
    <section className="botanical-band">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-24">
        <LeadershipPortraitPlaceholder className="mx-auto w-full max-w-xs" />
        <div className="flex flex-col items-start gap-7">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-sage">
            For coaches and organizations
          </span>
          <h2 className="max-w-2xl font-display text-h2 font-semibold text-balance text-mineral">
            Run DISC debriefs that executives take seriously.
          </h2>
          <ul className="flex flex-col gap-3">
            {capabilities.map((capability) => (
              <li key={capability} className="flex items-start gap-3 text-sm leading-relaxed text-sage">
                <svg
                  viewBox="0 0 16 16"
                  className="mt-0.5 size-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M3 8.5 6.5 12 13 4.5" />
                </svg>
                {capability}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-4 pt-2">
            <LinkButton href="/coaches" className="bg-mineral text-botanical hover:bg-paper">
              For coaches
            </LinkButton>
            <LinkButton
              href="/organizations"
              variant="outline"
              className="border-sage/40 bg-transparent text-mineral hover:border-mineral hover:text-mineral"
            >
              For organizations
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}
