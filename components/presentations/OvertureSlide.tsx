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
       * The square is owned rather than hidden.
       *
       * Depth behind a bare opaque image reveals its rectangular background and
       * reads as a pasted box — that is why an earlier attempt at a wash and a
       * drop shadow was removed. So the wheel now sits in a card: the card's
       * rounded edge and soft shadow ARE the square, deliberately, and the
       * asset's near-white ground (#FCFCFD) blends into the card's paper. That
       * gives the floating depth a keynote wants while staying honest about the
       * artwork we have.
       *
       * It also fixes the real ultrawide problem. At 65% of height the wheel is
       * correctly sized, but on a 3440 panel it covers only ~27% of the width,
       * so the eye read a small object in a wide void. A card turns that void
       * into margin around a deliberate object.
       */}
      {hero ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 55% at 50% 46%, rgba(191,210,200,0.16), rgba(255,255,255,0) 72%)",
          }}
        />
      ) : null}

      <motion.div
        className={cn(
          "relative flex items-center justify-center",
          hero
            ? "aspect-square h-[65%] max-w-[86%] rounded-[2.5rem] p-[2.5%] shadow-[0_48px_120px_-44px_rgba(23,32,29,0.30),0_4px_14px_-6px_rgba(23,32,29,0.08)]"
            : "h-full w-full",
        )}
        initial={reduced || !hero ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduced ? 0 : 0.9, ease, delay: reduced ? 0 : 0.1 }}
        /*
         * The card's ground is the artwork's own ground, not paper white. Three
         * levels of grey apart is invisible on its own but visible as an inner
         * rectangle once the image sits inside a white card — matching it makes
         * the padding and the artwork one surface. Not a new palette colour:
         * the value belongs to the asset.
         */
        style={hero ? { background: "#fcfcfd" } : undefined}
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
