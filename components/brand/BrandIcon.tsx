import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export type BrandTone = "default" | "light" | "dark" | "mono";

/**
 * DISC360 brand mark (registry: MEDIA-BRAND-ICON-01) — the production
 * raster mark with a transparent background (/brand/mark-192.png; scalable
 * derivatives live in /brand/icon.svg and /brand/favicon.svg). The tone API
 * is unchanged: the full-colour mark reads on light and dark surfaces alike,
 * and mono contexts get a grayscale rendering.
 */
export function BrandIcon({
  tone = "default",
  className,
}: {
  tone?: BrandTone;
  className?: string;
}) {
  return (
    <Image
      src="/brand/mark-192.png"
      alt=""
      width={192}
      height={192}
      className={cn("size-6 object-contain", tone === "mono" && "grayscale", className)}
      priority={false}
    />
  );
}
