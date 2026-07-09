import Link from "next/link";
import { GlassPanel } from "@/components/ui/GlassPanel";

const actions = [
  {
    href: "/assessment",
    title: "Retake the assessment",
    detail: "Profiles drift with roles and seasons — remeasure quarterly.",
  },
  {
    href: "/dashboard/history",
    title: "Review your history",
    detail: "Every profile you've completed, newest first.",
  },
  {
    href: "/team",
    title: "See team intelligence",
    detail: "Composition, coverage gaps, and complementary pairings.",
  },
];

export function QuickActions() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {actions.map((action) => (
        <Link key={action.href} href={action.href} className="group">
          <GlassPanel className="flex h-full flex-col gap-2 p-5 transition-all duration-200 group-hover:glass-panel-raised">
            <h3 className="flex items-center justify-between gap-2 font-display text-sm font-semibold text-ink">
              {action.title}
              <svg
                viewBox="0 0 16 16"
                className="size-3.5 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </h3>
            <p className="text-sm leading-relaxed text-ink-secondary">
              {action.detail}
            </p>
          </GlassPanel>
        </Link>
      ))}
    </div>
  );
}
