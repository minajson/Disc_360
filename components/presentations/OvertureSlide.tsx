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
}: {
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const reduced = useReducedMotion() ?? false;

  return (
    <motion.div
      data-testid="overture"
      className={cn("absolute inset-0 flex items-center justify-center bg-paper", className)}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: reduced ? 0 : OVERTURE_FADE_SECONDS,
        ease: [0.22, 1, 0.36, 1],
      }}
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
  );
}
