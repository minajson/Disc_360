import { GlassPanel } from "@/components/ui/GlassPanel";
import { LinkButton } from "@/components/ui/LinkButton";

interface Audience {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  cta: { href: string; label: string };
  glow: "accent" | undefined;
}

const audiences: Audience[] = [
  {
    eyebrow: "For individuals",
    title: "Your behavioral edge, mapped",
    description:
      "Take the assessment, get your archetype, and walk away with language for strengths you've been using blind.",
    bullets: [
      "Full archetype report with intensity bands",
      "Communication do's and don'ts for your style",
      "Stress-response triggers and recovery moves",
    ],
    cta: { href: "/assessment", label: "Start free assessment" },
    glow: "accent",
  },
  {
    eyebrow: "For coaches, HR & leaders",
    title: "Team intelligence at a glance",
    description:
      "Roster your team, see composition on one quadrant map, and coach from shared vocabulary instead of anecdotes.",
    bullets: [
      "Team quadrant map across all four dimensions",
      "Composition breakdown and coverage gaps",
      "Complementary-type pairing suggestions",
    ],
    cta: { href: "/team", label: "See the team view" },
    glow: undefined,
  },
];

export function AudienceSplit() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {audiences.map((audience) => (
        <GlassPanel
          key={audience.title}
          glow={audience.glow}
          className="flex flex-col gap-5 p-7 sm:p-9"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
            {audience.eyebrow}
          </span>
          <h3 className="font-display text-2xl font-semibold tracking-tight text-balance">
            {audience.title}
          </h3>
          <p className="text-sm leading-relaxed text-ink-secondary">
            {audience.description}
          </p>
          <ul className="flex flex-col gap-2.5">
            {audience.bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex items-start gap-2.5 text-sm text-ink-secondary"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="mt-0.5 size-4 shrink-0"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 8.5 6.5 12 13 4.5" />
                </svg>
                {bullet}
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-2">
            <LinkButton
              href={audience.cta.href}
              variant={audience.glow ? "primary" : "outline"}
            >
              {audience.cta.label}
            </LinkButton>
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
