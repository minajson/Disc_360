import { cn } from "@/lib/utils/cn";

interface InsightSectionProps {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/** Titled report section — shared chrome for all insight blocks. */
export function InsightSection({
  eyebrow,
  title,
  description,
  children,
  className,
}: InsightSectionProps) {
  return (
    <section className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
          {eyebrow}
        </span>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-ink-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
