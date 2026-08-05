"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

/**
 * The opening slide: the DISC wheel, alone on white.
 *
 * It carries no headline, no eyebrow and no chrome, because the point of an
 * opening slide is that the room looks at one thing. The player suppresses its
 * own navigation while this slide is showing and lets the whole surface
 * advance, so what the audience sees is a projected image rather than an
 * application with an image inside it.
 *
 * The asset is served unoptimised and preloaded. Unoptimised because a
 * re-encode would shift the DISC colours, which is the one thing this image
 * cannot afford; preloaded because it is the first thing the room sees, and a
 * fade-in that starts on a blank frame is not an entrance.
 */

export const OVERTURE_IMAGE = "/media/DiscWheel.png";

/** Intrinsic size of the asset. Square, so it fills the height of any stage. */
export const OVERTURE_SIZE = 1254;

/** Slow enough to read as an entrance, short enough not to be a wait. */
export const OVERTURE_FADE_SECONDS = 0.7;

/**
 * Described in the platform's own language — Dominant, Influence, Stable,
 * Analytical — rather than by the letters printed on the artwork, so a
 * screen-reader user hears the vocabulary the rest of the product uses.
 */
export const OVERTURE_ALT =
  "The DISC wheel: four behavioural preferences — Dominant, Influence, Stable and Analytical — arranged between task focus and people focus, active and reflective.";

export function OvertureSlide({
  alt,
  className,
  priority = true,
  /**
   * Hero treatment: the wheel sits at keynote scale with depth behind it
   * instead of filling the frame edge to edge. Off for the follower's phone
   * and any surface where the image is already inside a card.
   */
  hero = false,
}: {
  alt: string;
  className?: string;
  priority?: boolean;
  hero?: boolean;
}) {
  const reduced = useReducedMotion() ?? false;
  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <motion.div
      data-testid="overture"
      className={cn("absolute inset-0 flex items-center justify-center bg-paper", className)}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : OVERTURE_FADE_SECONDS, ease }}
    >
      {/*
       * No radial wash and no drop shadow behind the wheel, deliberately.
       *
       * Both were tried. The asset is an opaque square with a near-white
       * background (#FCFCFD), so anything drawn behind it — a tint, a shadow —
       * stops at the square and turns the wheel into a visible pasted box,
       * which is the exact impression the hero treatment exists to remove. On
       * pure white the square edge is imperceptible, so the depth here comes
       * from scale and restraint instead: the wheel is given the middle 65% of
       * the slide and nothing competes with it.
       *
       * Depth and a per-quadrant reveal both need an asset with transparency
       * (or four layers). See MEDIA-DECK-WHEEL-01.
       */}
      <motion.div
        className={cn(
          "relative flex items-center justify-center",
          // ~65% of the slide's short edge, so the wheel is the centrepiece
          // with room to breathe rather than a full-bleed image.
          hero ? "h-[65%] w-[65%] max-h-[65cqh] max-w-[65cqw]" : "h-full w-full",
        )}
        initial={reduced || !hero ? false : { opacity: 0, scale: 0.965 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduced ? 0 : 0.9, ease, delay: reduced ? 0 : 0.12 }}
      >
        <Image
          src={OVERTURE_IMAGE}
          alt={alt}
          width={OVERTURE_SIZE}
          height={OVERTURE_SIZE}
          sizes="100vw"
          priority={priority}
          unoptimized
          className="h-full w-full object-contain"
        />
      </motion.div>
    </motion.div>
  );
}
