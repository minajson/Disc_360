import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export type MediaRatio = "16/9" | "3/2" | "4/5" | "9/16" | "1/1";

const ratioClass: Record<MediaRatio, string> = {
  "16/9": "aspect-video",
  "3/2": "aspect-[3/2]",
  "4/5": "aspect-[4/5]",
  "9/16": "aspect-[9/16]",
  "1/1": "aspect-square",
};

export interface MediaPlaceholderProps {
  /** What this media depicts — also the accessible label. */
  label: string;
  ratio: MediaRatio;
  kind: "photo" | "film";
  /** Recommended replacement dimensions, e.g. "1920×1080". */
  dimensions: string;
  /**
   * When final assets exist, pass them here and the placeholder becomes the
   * real media element — no call-site changes beyond these props.
   */
  src?: string;
  /** Poster frame for film assets (required when src is a video). */
  poster?: string;
  mask?: "none" | "organic" | "arch";
  className?: string;
  /** Overlay content (captions, quotes) rendered above the media. */
  children?: React.ReactNode;
}

/**
 * Editorial media slot. Ships as a composed, finished-looking placeholder;
 * accepts real photo/film sources without restructuring. Full replacement
 * specs live in MEDIA_GUIDE.md.
 */
export function MediaPlaceholder({
  label,
  ratio,
  kind,
  dimensions,
  src,
  poster,
  mask = "none",
  className,
  children,
}: MediaPlaceholderProps) {
  return (
    <figure
      className={cn(
        "relative w-full overflow-hidden",
        ratioClass[ratio],
        mask === "organic" && "mask-organic",
        mask === "arch" && "mask-arch",
        mask === "none" && "rounded-editorial",
        className,
      )}
    >
      {src ? (
        kind === "film" ? (
          <video
            className="absolute inset-0 size-full object-cover"
            src={src}
            poster={poster}
            muted
            loop
            playsInline
            autoPlay
            aria-label={label}
          />
        ) : (
          <Image
            src={src}
            alt={label}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        )
      ) : (
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

          {/* spec chip */}
          <span
            aria-hidden
            className="absolute bottom-4 left-4 rounded-full border border-ink/10 bg-paper/80 px-3 py-1 font-mono text-[10px] tracking-wide text-slate backdrop-blur-sm"
          >
            {kind} · {ratio} · {dimensions}
          </span>
        </div>
      )}
      {children ? <div className="absolute inset-0">{children}</div> : null}
    </figure>
  );
}
