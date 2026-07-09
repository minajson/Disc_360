import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  MotionStagger,
  MotionStaggerItem,
} from "@/components/motion/MotionStagger";

interface ValueProp {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const iconProps = {
  className: "size-5",
  fill: "none",
  stroke: "var(--color-accent)",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const valueProps: ValueProp[] = [
  {
    title: "Know your operating style",
    description:
      "A precise map of how you push, persuade, steady, and scrutinize — with the blind spots that show up when stakes rise.",
    icon: (
      <svg viewBox="0 0 24 24" {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 3v3M21 12h-3M12 21v-3M3 12h3" />
      </svg>
    ),
  },
  {
    title: "Communicate to be heard",
    description:
      "Per-archetype do-and-don't guidance for pitching, giving feedback, and de-escalating — tuned to the person in front of you.",
    icon: (
      <svg viewBox="0 0 24 24" {...iconProps}>
        <path d="M20 12a8 8 0 1 0-3.2 6.4L21 20l-1.3-3.5A7.9 7.9 0 0 0 20 12Z" />
        <path d="M8.5 11h7M8.5 14h4" />
      </svg>
    ),
  },
  {
    title: "Build complementary teams",
    description:
      "See your team on one quadrant map — where drive concentrates, where stability is missing, and which hires rebalance it.",
    icon: (
      <svg viewBox="0 0 24 24" {...iconProps}>
        <circle cx="8" cy="8.5" r="3" />
        <circle cx="16.5" cy="15.5" r="3" />
        <path d="M3.5 20a4.5 4.5 0 0 1 9 0M12 9.5a4.5 4.5 0 0 1 9 0" opacity="0.7" />
      </svg>
    ),
  },
  {
    title: "Coach with evidence",
    description:
      "Replace gut-feel debriefs with normalized scores, intensity bands, and stress-response patterns you can track over time.",
    icon: (
      <svg viewBox="0 0 24 24" {...iconProps}>
        <path d="M4 20V9M10 20V4M16 20v-8M22 20H2" />
      </svg>
    ),
  },
  {
    title: "Decide under pressure",
    description:
      "Pressure changes behavior. Disc360 profiles the shift — who goes silent, who takes over, who over-analyzes — before it costs you.",
    icon: (
      <svg viewBox="0 0 24 24" {...iconProps}>
        <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />
      </svg>
    ),
  },
  {
    title: "Enterprise-ready by design",
    description:
      "Session history, team rollups, and an API-first architecture built to plug into your HR stack when you are.",
    icon: (
      <svg viewBox="0 0 24 24" {...iconProps}>
        <rect x="3" y="4" width="18" height="7" rx="2" />
        <rect x="3" y="14" width="18" height="7" rx="2" />
        <path d="M7 7.5h.01M7 17.5h.01" />
      </svg>
    ),
  },
];

export function ValuePropsGrid() {
  return (
    <MotionStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {valueProps.map((prop) => (
        <MotionStaggerItem key={prop.title} className="h-full">
          <GlassPanel className="flex h-full flex-col gap-4 p-6 transition-colors duration-200 hover:border-line-strong">
            <span className="flex size-10 items-center justify-center rounded-xl border border-accent/20 bg-accent/8">
              {prop.icon}
            </span>
            <h3 className="font-display text-base font-semibold tracking-tight text-ink">
              {prop.title}
            </h3>
            <p className="text-sm leading-relaxed text-ink-secondary">
              {prop.description}
            </p>
          </GlassPanel>
        </MotionStaggerItem>
      ))}
    </MotionStagger>
  );
}
