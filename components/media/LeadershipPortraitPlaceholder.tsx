import {
  MediaPlaceholder,
  type MediaPlaceholderProps,
} from "@/components/media/MediaPlaceholder";

type PortraitProps = Pick<
  MediaPlaceholderProps,
  "src" | "mp4Src" | "poster" | "focal" | "className"
> & {
  label?: string;
};

/**
 * Editorial portrait slot (coach pages, about, testimonials). Accepts either
 * a 4:5 photo or a living-portrait film (WebM + MP4 + poster — the coach
 * loop). Film autoplay follows the registry entry; reduced-motion viewers
 * get the poster. Specs: MEDIA_GUIDE.md → MEDIA-COACH-PORTRAIT-01.
 */
export function LeadershipPortraitPlaceholder({
  label = "Portrait of a coach in warm natural light",
  src,
  mp4Src,
  poster,
  ...props
}: PortraitProps) {
  const isFilm = Boolean(mp4Src || src?.endsWith(".webm") || src?.endsWith(".mp4"));
  return (
    <MediaPlaceholder
      mediaId="MEDIA-COACH-PORTRAIT-01"
      label={label}
      ratio="4/5"
      kind={isFilm ? "film" : "photo"}
      dimensions="1200×1500"
      mask="arch"
      src={src}
      mp4Src={mp4Src}
      poster={poster}
      {...props}
    />
  );
}
