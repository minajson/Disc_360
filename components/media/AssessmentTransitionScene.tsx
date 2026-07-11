"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { usePrefersReducedMotion } from "@/lib/motion/preferences";

/**
 * Calm breathing backdrop used between assessment stages and on interstitials.
 * Deliberately cheap: two soft radial fields, no filters on the main thread.
 * Swap-point contract: decorative full-bleed backdrop.
 */
export function AssessmentTransitionScene({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion();

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <motion.div
        className="absolute -left-1/4 top-[-20%] size-[70vmin] rounded-full bg-sage/50 blur-3xl"
        animate={reduced ? undefined : { scale: [1, 1.08, 1], opacity: [0.5, 0.7, 0.5] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-1/4 bottom-[-25%] size-[75vmin] rounded-full bg-sand/70 blur-3xl"
        animate={reduced ? undefined : { scale: [1.05, 1, 1.05], opacity: [0.6, 0.8, 0.6] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
