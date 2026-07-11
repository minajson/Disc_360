"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Route-level entrance transition (used by app/template.tsx).
 * Motion-ready swap point for future dimensional page transitions.
 */
export function MotionShell({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="flex min-h-full flex-1 flex-col"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
