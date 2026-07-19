import {
  MediaPlaceholder,
  type MediaPlaceholderProps,
} from "@/components/media/MediaPlaceholder";

type HeroFilmProps = Pick<
  MediaPlaceholderProps,
  "src" | "mp4Src" | "poster" | "focal" | "className"
> & {
  /** Mobile crops use 4:5; desktop uses 3:2. */
  variant?: "desktop" | "mobile";
  /** Distinct 4:5 mobile sources — the mobile variant prefers these. */
  mobileSrc?: string;
  mobileMp4Src?: string;
  mobilePoster?: string;
};

/**
 * Homepage hero film slot.
 * Replacement: 3:2 (desktop) or 4:5 (mobile) film of a diverse professional
 * leadership team in warm natural light, subtle movement, no visible brand
 * logos, premium editorial composition. WebM + MP4 fallback + poster, muted,
 * playsInline, autoplay per registry, poster-only under reduced motion.
 * Because the two crops differ (3:2 vs 4:5), the mobile variant takes its own
 * sources and falls back to the desktop files when none are provided.
 * Specs: MEDIA_GUIDE.md → MEDIA-HOME-HERO-01.
 */
export function HeroFilmPlaceholder({
  variant = "desktop",
  src,
  mp4Src,
  poster,
  mobileSrc,
  mobileMp4Src,
  mobilePoster,
  ...props
}: HeroFilmProps) {
  const mobile = variant === "mobile";
  // With both source sets, one instance serves every viewport: the browser
  // picks per `<source media>`, and the frame's aspect follows suit.
  const responsive = Boolean(!mobile && (mobileSrc || mobileMp4Src));
  return (
    <MediaPlaceholder
      mediaId="MEDIA-HOME-HERO-01"
      label="Leadership team collaborating in warm natural light"
      ratio={mobile ? "4/5" : "3/2"}
      ratioClassName={responsive ? "aspect-[4/5] sm:aspect-[3/2]" : undefined}
      kind="film"
      dimensions={mobile ? "1080×1350" : "1920×1280"}
      mask="organic"
      src={mobile ? (mobileSrc ?? src) : src}
      mp4Src={mobile ? (mobileMp4Src ?? mp4Src) : mp4Src}
      poster={mobile ? (mobilePoster ?? poster) : poster}
      mobileSrc={responsive ? mobileSrc : undefined}
      mobileMp4Src={responsive ? mobileMp4Src : undefined}
      mobilePoster={responsive ? mobilePoster : undefined}
      {...props}
    />
  );
}
