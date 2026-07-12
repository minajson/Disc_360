import {
  MediaPlaceholder,
  type MediaPlaceholderProps,
} from "@/components/media/MediaPlaceholder";

type CaseStudyProps = Pick<MediaPlaceholderProps, "src" | "poster" | "className"> & {
  label?: string;
  children?: React.ReactNode;
};

/**
 * Case-study film slot with overlay support for quotes.
 * Replacement: 16:9 film, 1600×900, workplace documentary style, warm and
 * candid, no staged stock poses. WebM + MP4 fallback, poster required.
 * See MEDIA_GUIDE.md → case-study-film.
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
