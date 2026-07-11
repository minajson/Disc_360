import {
  MediaPlaceholder,
  type MediaPlaceholderProps,
} from "@/components/media/MediaPlaceholder";

type HeroFilmProps = Pick<MediaPlaceholderProps, "src" | "poster" | "className"> & {
  /** Mobile crops use 4:5; desktop uses 3:2. */
  variant?: "desktop" | "mobile";
};

/**
 * Homepage hero film slot.
 * Replacement: 3:2 (desktop) or 4:5 (mobile) film of a diverse professional
 * leadership team in warm natural light, subtle movement, no visible brand
 * logos, premium editorial composition. WebM + MP4 fallback, poster required,
 * no audio. See MEDIA_GUIDE.md → hero-film.
 */
export function HeroFilmPlaceholder({
  variant = "desktop",
  ...props
}: HeroFilmProps) {
  return (
    <MediaPlaceholder
      label="Leadership team collaborating in warm natural light"
      ratio={variant === "desktop" ? "3/2" : "4/5"}
      kind="film"
      dimensions={variant === "desktop" ? "1920×1280" : "1080×1350"}
      mask="organic"
      {...props}
    />
  );
}
