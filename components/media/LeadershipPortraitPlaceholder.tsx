import {
  MediaPlaceholder,
  type MediaPlaceholderProps,
} from "@/components/media/MediaPlaceholder";

type PortraitProps = Pick<MediaPlaceholderProps, "src" | "className"> & {
  label?: string;
};

/**
 * Editorial portrait slot (coach pages, about, testimonials).
 * Replacement: 4:5 photo, 1200×1500, warm natural light, honest expression,
 * uncluttered background. See MEDIA_GUIDE.md → leadership-portrait.
 */
export function LeadershipPortraitPlaceholder({
  label = "Portrait of a coach in warm natural light",
  ...props
}: PortraitProps) {
  return (
    <MediaPlaceholder
      mediaId="MEDIA-COACH-PORTRAIT-01"
      label={label}
      ratio="4/5"
      kind="photo"
      dimensions="1200×1500"
      mask="arch"
      {...props}
    />
  );
}
