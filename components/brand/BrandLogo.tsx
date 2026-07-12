import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { BrandIcon, type BrandTone } from "@/components/brand/BrandIcon";

/**
 * TEMPORARY horizontal logo (registry: MEDIA-BRAND-LOGO-01). The final
 * wordmark replaces this component's internals — call sites stay stable.
 */
export function BrandLogo({
  tone = "default",
  href = "/",
  className,
}: {
  tone?: BrandTone;
  href?: string | null;
  className?: string;
}) {
  const wordmark = (
    <span
      className={cn(
        "flex items-center gap-2.5",
        tone === "light" && "text-mineral",
        className,
      )}
    >
      <BrandIcon tone={tone} />
      <span className="font-display text-xl font-semibold tracking-tight">
        DISC
        <span className={tone === "light" ? "text-sage" : "text-botanical"}>360</span>
      </span>
    </span>
  );
  if (!href) return wordmark;
  return <Link href={href}>{wordmark}</Link>;
}
