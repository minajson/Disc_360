import { BrandLogo } from "@/components/brand/BrandLogo";

/** Back-compat wrapper — all identity now routes through BrandLogo. */
export function BrandMark({ className }: { className?: string }) {
  return <BrandLogo className={className} />;
}
