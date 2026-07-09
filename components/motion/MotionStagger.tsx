"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

const ATLAS_EASE = [0.22, 1, 0.36, 1] as const;

interface MotionStaggerProps {
  children: React.ReactNode;
  className?: string;
  /** Seconds between each child reveal. */
  interval?: number;
}

/** Staggered viewport reveal for grids and lists. */
export function MotionStagger({
  children,
  className,
  interval = 0.08,
}: MotionStaggerProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial={reduceMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: interval } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function MotionStaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={cn(className)}
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.45, ease: ATLAS_EASE },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
