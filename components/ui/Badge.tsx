import { cn } from "@/lib/utils/cn";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "accent";
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em]",
        tone === "neutral" && "border-line text-ink-secondary",
        tone === "accent" && "border-accent/30 bg-accent/8 text-accent",
        className,
      )}
      {...props}
    />
  );
}
