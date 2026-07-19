"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";

/**
 * The real <video> element behind every film slot.
 *
 * Contract (MEDIA_GUIDE.md): WebM source + MP4 fallback + poster, always
 * muted + playsInline, autoplay only where the slot specifies it, and a
 * static poster under reduced motion (playback stays available on demand —
 * user-initiated motion is fine). If every source fails, `fallback` (the
 * editorial placeholder artwork) is rendered so a missing file never leaves
 * a broken frame.
 */
export interface FilmSource {
  /** WebM (VP9) — primary. */
  webm?: string;
  /** MP4 (H.264) — fallback for browsers without WebM. */
  mp4?: string;
  poster?: string;
}

export function FilmMedia({
  source,
  mobile,
  label,
  autoplay,
  autoplayInView = false,
  focal = "50% 50%",
  fallback,
}: {
  source: FilmSource;
  /**
   * Distinct small-viewport sources (e.g. the hero's 4:5 crop). Selected via
   * `<source media>` so only the matching files load — one video element,
   * no hidden duplicate downloads.
   */
  mobile?: FilmSource;
  label: string;
  /** From the slot's registry entry — never assumed. */
  autoplay: boolean;
  /**
   * Ambient in-view mode: autoplays muted when the section is on screen,
   * pauses off screen, never shows a play control. Reduced motion or a
   * blocked autoplay silently show the poster instead.
   */
  autoplayInView?: boolean;
  /** CSS object-position for safe cropping, e.g. "50% 30%". */
  focal?: string;
  /** Rendered when no source can be played. */
  fallback: React.ReactNode;
}) {
  const reduced = useReducedMotion() ?? false;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [posterOnly, setPosterOnly] = useState(false);
  // Under reduced motion (or a non-autoplay slot) we hold on the poster until
  // the viewer asks for playback.
  const [playing, setPlaying] = useState((autoplay || autoplayInView) && !reduced);

  // In-view ambience: play while visible, pause when scrolled away. A
  // rejected play() (autoplay policy) downgrades silently to the poster.
  useEffect(() => {
    if (!autoplayInView || reduced) return;
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          video.play().catch(() => setPosterOnly(true));
        } else {
          video.pause();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [autoplayInView, reduced, playing]);

  if (failed || (!source.webm && !source.mp4)) return <>{fallback}</>;

  // Ambient slots never show a control: reduced motion or blocked autoplay
  // render the still poster frame, full stop.
  if (autoplayInView && (reduced || posterOnly)) {
    return source.poster ? (
      <Image
        src={source.poster}
        alt={label}
        fill
        className="object-cover"
        style={{ objectPosition: focal }}
        onError={() => setFailed(true)}
      />
    ) : (
      <>{fallback}</>
    );
  }

  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => {
          setPlaying(true);
          requestAnimationFrame(() => videoRef.current?.play().catch(() => setFailed(true)));
        }}
        aria-label={`Play: ${label}`}
        className="group absolute inset-0 size-full cursor-pointer"
      >
        {source.poster ? (
          <Image
            src={source.poster}
            alt=""
            fill
            className="object-cover"
            style={{ objectPosition: focal }}
            onError={() => setFailed(true)}
          />
        ) : (
          fallback
        )}
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ink/15 bg-paper/80 backdrop-blur-sm transition-transform group-hover:scale-105"
        >
          <svg viewBox="0 0 16 16" className="ml-0.5 size-4" fill="var(--color-ink)">
            <path d="M4 2.5v11l9-5.5-9-5.5Z" />
          </svg>
        </span>
      </button>
    );
  }

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 size-full object-cover"
      style={{ objectPosition: focal }}
      poster={source.poster}
      muted
      loop
      playsInline
      autoPlay={!autoplayInView}
      aria-label={label}
      onError={() => setFailed(true)}
    >
      {mobile?.webm ? (
        <source src={mobile.webm} type="video/webm" media="(max-width: 639px)" />
      ) : null}
      {mobile?.mp4 ? (
        <source src={mobile.mp4} type="video/mp4" media="(max-width: 639px)" />
      ) : null}
      {source.webm ? <source src={source.webm} type="video/webm" /> : null}
      {source.mp4 ? <source src={source.mp4} type="video/mp4" /> : null}
    </video>
  );
}

/** Image twin: graceful failure + focal cropping for photo slots. */
export function PhotoMedia({
  src,
  label,
  focal = "50% 50%",
  sizes,
  fallback,
}: {
  src: string;
  label: string;
  focal?: string;
  sizes?: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <Image
      src={src}
      alt={label}
      fill
      sizes={sizes ?? "(max-width: 768px) 100vw, 50vw"}
      className="object-cover"
      style={{ objectPosition: focal }}
      onError={() => setFailed(true)}
    />
  );
}
