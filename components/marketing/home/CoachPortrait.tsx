"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { useMotionTier } from "@/lib/motion/preferences";
import { LeadershipPortraitPlaceholder } from "@/components/media/LeadershipPortraitPlaceholder";

/**
 * The coach living portrait on the botanical band.
 *
 * Desktop (fine pointer, motion allowed): a whisper of scroll parallax
 * (±10 px) and a gentle hover lift (scale 1.02 + slight brightness) — both
 * CSS/GPU transforms. Touch and small screens get no movement beyond the
 * looping film itself; reduced-motion viewers get the static poster (the
 * film slot already holds on its poster under reduced motion).
 */
export function CoachPortrait({ className }: { className?: string }) {
  const tier = useMotionTier();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [10, -10]);

  return (
    <motion.div
      ref={ref}
      style={tier === "full" ? { y } : undefined}
      className={cn("group", className)}
    >
      <LeadershipPortraitPlaceholder
        src="/media/coach-01.webm"
        mp4Src="/media/coach-01.mp4"
        poster="/media/coach-01-poster.jpg"
        label="Coach smiling warmly, head and shoulders, natural light"
        className="transition-[transform,filter] duration-500 ease-out lg:group-hover:scale-[1.02] lg:group-hover:brightness-[1.04]"
      />
    </motion.div>
  );
}
