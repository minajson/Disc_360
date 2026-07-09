"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface DimensionalLayerProps {
  children: React.ReactNode;
  className?: string;
  /** Parallax depth: positive drifts slower than scroll (background feel). */
  depth?: number;
}

/**
 * Parallax depth layer — placeholder for a future 3D canvas.
 * Swap point: the prop contract (children + depth) must stay stable when
 * internals are replaced with a WebGL scene.
 */
export function DimensionalLayer({
  children,
  className,
  depth = 40,
}: DimensionalLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [depth, -depth]);

  return (
    <motion.div
      ref={ref}
      style={reduceMotion ? undefined : { y }}
      className={cn("will-change-transform", className)}
    >
      {children}
    </motion.div>
  );
}
