import { cn } from "@/lib/utils/cn";

interface StatProps {
  value: string;
  label: string;
  className?: string;
}

export function Stat({ value, label, className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {value}
      </span>
      <span className="text-sm text-ink-muted">{label}</span>
    </div>
  );
}
