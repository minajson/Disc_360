import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <polygon
          points="12,3 21,12 12,21 3,12"
          fill="var(--color-sage)"
          stroke="var(--color-botanical)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2.4" fill="var(--color-botanical)" />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight text-ink">
        DISC<span className="text-botanical">360</span>
      </span>
    </Link>
  );
}
