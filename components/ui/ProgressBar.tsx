import { cn } from "@/lib/utils/cn";

interface ProgressBarProps {
  /** 0–100 */
  value: number;
  label?: string;
  className?: string;
}

export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/8", className)}
    >
      <div
        className="h-full rounded-full accent-gradient transition-[width] duration-450 ease-[var(--ease-atlas)]"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
