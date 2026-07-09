"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

const ATLAS_EASE = [0.22, 1, 0.36, 1] as const;

interface MotionSectionProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in seconds. */
  delay?: number;
  as?: "section" | "div";
}

/**
 * Viewport-reveal wrapper. Motion-ready swap point: internals may later be
 * replaced with dimensional/3D transitions — prop contract stays stable.
 */
export function MotionSection({
  children,
  className,
  delay = 0,
  as = "section",
}: MotionSectionProps) {
  const reduceMotion = useReducedMotion();
  const Tag = as === "section" ? motion.section : motion.div;

  return (
    <Tag
      className={cn(className)}
      initial={reduceMotion ? false : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.45, delay, ease: ATLAS_EASE }}
    >
      {children}
    </Tag>
  );
}
