"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface QuestionTransitionProps {
  /** Key that changes when the question changes. */
  transitionKey: string;
  direction: 1 | -1;
  children: React.ReactNode;
}

/**
 * Animated swap between questions. Motion-ready swap point: internals can
 * become a dimensional 3D transition later — contract stays stable.
 */
export function QuestionTransition({
  transitionKey,
  direction,
  children,
}: QuestionTransitionProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={transitionKey}
        initial={reduceMotion ? false : { opacity: 0, x: 48 * direction, filter: "blur(4px)" }}
        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        exit={
          reduceMotion
            ? { opacity: 0 }
            : { opacity: 0, x: -48 * direction, filter: "blur(4px)" }
        }
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
