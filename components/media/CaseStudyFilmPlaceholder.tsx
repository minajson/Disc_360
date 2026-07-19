import {
  MediaPlaceholder,
  type MediaPlaceholderProps,
} from "@/components/media/MediaPlaceholder";

type CaseStudyProps = Pick<
  MediaPlaceholderProps,
  "src" | "mp4Src" | "poster" | "focal" | "className"
> & {
  label?: string;
  children?: React.ReactNode;
};

/**
 * Case-study film slot with overlay support for quotes.
 * Replacement: 16:9 film, 1600×900, workplace documentary style, warm and
 * candid, no staged stock poses. WebM + MP4 fallback + poster; this slot does
 * NOT autoplay (registry) — it holds on the poster until played, always muted.
 * Specs: MEDIA_GUIDE.md → MEDIA-CASESTUDY-FILM-01.
 */
export function CaseStudyFilmPlaceholder({
  label = "Team retrospective conversation, documentary style",
  children,
  ...props
}: CaseStudyProps) {
  return (
    <MediaPlaceholder
      mediaId="MEDIA-CASESTUDY-FILM-01"
      label={label}
      ratio="16/9"
      kind="film"
      dimensions="1600×900"
      {...props}
    >
      {children}
    </MediaPlaceholder>
  );
}
