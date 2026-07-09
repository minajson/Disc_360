import { GlassPanel } from "@/components/ui/GlassPanel";
import { LinkButton } from "@/components/ui/LinkButton";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { href: string; label: string };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <GlassPanel className="flex flex-col items-center gap-4 px-8 py-14 text-center">
      <svg
        viewBox="0 0 48 48"
        className="size-10"
        fill="none"
        stroke="var(--color-ink-muted)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        aria-hidden
      >
        <polygon points="24,8 40,24 24,34 10,24" opacity="0.6" />
        <circle cx="24" cy="8" r="2.5" fill="var(--color-disc-d)" stroke="none" />
        <circle cx="40" cy="24" r="2.5" fill="var(--color-disc-i)" stroke="none" />
        <circle cx="24" cy="34" r="2.5" fill="var(--color-disc-s)" stroke="none" />
        <circle cx="10" cy="24" r="2.5" fill="var(--color-disc-c)" stroke="none" />
      </svg>
      <div className="flex flex-col gap-1.5">
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        <p className="max-w-sm text-sm leading-relaxed text-ink-secondary">
          {description}
        </p>
      </div>
      {action ? (
        <LinkButton href={action.href} className="mt-2">
          {action.label}
        </LinkButton>
      ) : null}
    </GlassPanel>
  );
}
