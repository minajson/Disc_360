import { cn } from "@/lib/utils/cn";
import { getMediaEntry } from "@/data/media-registry";
import { FilmMedia, PhotoMedia } from "@/components/media/FilmMedia";

export type MediaRatio = "16/9" | "3/2" | "4/5" | "9/16" | "1/1";

const ratioClass: Record<MediaRatio, string> = {
  "16/9": "aspect-video",
  "3/2": "aspect-[3/2]",
  "4/5": "aspect-[4/5]",
  "9/16": "aspect-[9/16]",
  "1/1": "aspect-square",
};

export interface MediaPlaceholderProps {
  /** Registry id (data/media-registry.ts) — enables the dev spec overlay. */
  mediaId?: string;
  /** What this media depicts — also the accessible label. */
  label: string;
  ratio: MediaRatio;
  kind: "photo" | "film";
  /** Recommended replacement dimensions, e.g. "1920×1080". */
  dimensions: string;
  /**
   * When final assets exist, pass them here and the placeholder becomes the
   * real media element — no call-site changes beyond these props.
   * For film, `src` is the WebM source and `mp4Src` the H.264 fallback.
   */
  src?: string;
  /** MP4 fallback for film slots (browsers without WebM). */
  mp4Src?: string;
  /** Poster frame for film assets (required when src is a video). */
  poster?: string;
  /**
   * Autoplay for film slots. Defaults to the slot's registry entry; only pass
   * to override deliberately. Always muted + playsInline either way, and
   * reduced-motion viewers get the poster with on-demand playback.
   */
  autoplay?: boolean;
  /** CSS object-position for safe cropping, e.g. "50% 30%". */
  focal?: string;
  /** Distinct small-viewport film sources (see FilmMedia.mobile). */
  mobileSrc?: string;
  mobileMp4Src?: string;
  mobilePoster?: string;
  /**
   * Responsive aspect override (e.g. "aspect-[4/5] sm:aspect-[3/2]") for
   * slots whose desktop and mobile crops differ. Replaces the static ratio
   * class; `ratio` stays the documented shape.
   */
  ratioClassName?: string;
  mask?: "none" | "organic" | "arch";
  className?: string;
  /** Overlay content (captions, quotes) rendered above the media. */
  children?: React.ReactNode;
}

/**
 * Editorial media slot. Ships as a composed, finished-looking placeholder;
 * accepts real photo/film sources without restructuring, and returns to the
 * placeholder if a passed source fails to load. Full replacement specs are
 * generated into MEDIA_GUIDE.md from the registry.
 */
const typeLabel: Record<string, string> = {
  image: "IMAGE PLACEHOLDER",
  video: "VIDEO PLACEHOLDER",
  logo: "BRAND ASSET",
  icon: "BRAND ASSET",
  avatar: "PORTRAIT PLACEHOLDER",
};

export function MediaPlaceholder({
  mediaId,
  label,
  ratio,
  kind,
  dimensions,
  src,
  mp4Src,
  poster,
  autoplay,
  focal,
  mobileSrc,
  mobileMp4Src,
  mobilePoster,
  ratioClassName,
  mask = "none",
  className,
  children,
}: MediaPlaceholderProps) {
  const entry = mediaId ? getMediaEntry(mediaId) : undefined;
  const showSpecs = process.env.NODE_ENV === "development" && entry;
  // Autoplay is a slot property (registry), not a caller guess.
  const slotAutoplay = autoplay ?? entry?.video?.autoplay ?? false;

  // The editorial placeholder — also the graceful fallback when a passed
  // source is missing or fails to load.
  const artwork = (
    <div
      role="img"
      aria-label={`${label} (placeholder artwork)`}
      className="absolute inset-0"
    >
      {/* layered warm composition — deliberate, not unfinished */}
      <div className="absolute inset-0 bg-sand" />
      <div className="absolute -left-1/4 top-0 h-full w-3/4 rounded-full bg-sage opacity-70 blur-3xl" />
      <div className="absolute -right-1/5 bottom-0 h-2/3 w-2/3 rounded-full bg-teal/30 blur-3xl" />
      <div className="absolute inset-0 paper-grain" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-ink/10" />

      {/* film affordance */}
      {kind === "film" ? (
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ink/15 bg-paper/70 backdrop-blur-sm"
        >
          <svg viewBox="0 0 16 16" className="ml-0.5 size-4" fill="var(--color-ink)">
            <path d="M4 2.5v11l9-5.5-9-5.5Z" />
          </svg>
        </span>
      ) : null}

      {/* spec overlay: full registry card in development, quiet chip otherwise */}
      {showSpecs ? (
        <div
          aria-hidden
          className="absolute bottom-3 left-3 right-3 rounded-xl border border-ink/10 bg-paper/90 px-4 py-3 font-mono text-[10px] leading-relaxed text-slate backdrop-blur-sm"
        >
          <span className="block font-semibold tracking-wide text-ink">
            {entry.id} · {typeLabel[entry.type]}
          </span>
          <span className="block">{entry.purpose}</span>
          <span className="block text-faint">
            {entry.dimensions} · {entry.ratio} · {entry.formats} · {entry.sizeTarget}
            {entry.transparent ? " · transparent bg" : ""}
            {entry.video
              ? ` · ${entry.video.duration} · autoplay ${entry.video.autoplay ? "yes" : "no"} · audio ${entry.video.audio ? "yes" : "no"}`
              : ""}
          </span>
          <span className="block text-faint">→ {entry.suggestedContent}</span>
        </div>
      ) : (
        <span
          aria-hidden
          className="absolute bottom-4 left-4 rounded-full border border-ink/10 bg-paper/80 px-3 py-1 font-mono text-[10px] tracking-wide text-slate backdrop-blur-sm"
        >
          {kind} · {ratio} · {dimensions}
        </span>
      )}
    </div>
  );

  return (
    <figure
      className={cn(
        "relative w-full overflow-hidden",
        ratioClassName ?? ratioClass[ratio],
        mask === "organic" && "mask-organic",
        mask === "arch" && "mask-arch",
        mask === "none" && "rounded-editorial",
        className,
      )}
    >
      {src || mp4Src ? (
        kind === "film" ? (
          <FilmMedia
            source={{ webm: src, mp4: mp4Src, poster }}
            mobile={
              mobileSrc || mobileMp4Src
                ? { webm: mobileSrc, mp4: mobileMp4Src, poster: mobilePoster }
                : undefined
            }
            label={label}
            autoplay={slotAutoplay}
            focal={focal}
            fallback={artwork}
          />
        ) : (
          <PhotoMedia src={src!} label={label} focal={focal} fallback={artwork} />
        )
      ) : (
        artwork
      )}
      {children ? <div className="absolute inset-0">{children}</div> : null}
    </figure>
  );
}
