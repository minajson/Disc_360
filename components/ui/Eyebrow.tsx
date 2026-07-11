import { cn } from "@/lib/utils/cn";

interface EyebrowProps {
  children: React.ReactNode;
  /** Optional editorial section number, e.g. "01". */
  index?: string;
  className?: string;
}

/** Editorial section label — mono, spaced, quiet. */
export function Eyebrow({ children, index, className }: EyebrowProps) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-teal",
        className,
      )}
    >
      {index ? <span className="text-faint">{index}</span> : null}
      {children}
    </span>
  );
}
