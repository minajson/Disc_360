"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface KineticHeadlineProps {
  /** Plain text; words animate individually. */
  text: string;
  /** Words to set in the display italic accent style. */
  accents?: string[];
  as?: "h1" | "h2";
  className?: string;
}

/** Word-by-word editorial rise. Used sparingly — hero-grade moments only. */
export function KineticHeadline({
  text,
  accents = [],
  as: Tag = "h1",
  className,
}: KineticHeadlineProps) {
  const reduced = useReducedMotion();
  const words = text.split(" ");

  return (
    <Tag className={cn("font-display font-semibold text-balance", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((word, index) => {
          const clean = word.replace(/[.,]/g, "");
          const accent = accents.includes(clean);
          return (
            <span key={index} className="inline-block overflow-hidden pb-1 align-bottom">
              <motion.span
                className={cn(
                  "inline-block",
                  accent && "italic text-botanical",
                )}
                initial={reduced ? false : { y: "110%" }}
                animate={{ y: 0 }}
                transition={{
                  duration: 0.7,
                  delay: 0.08 + index * 0.045,
                  ease: [0.32, 0.94, 0.6, 1],
                }}
              >
                {word}
                {index < words.length - 1 ? " " : ""}
              </motion.span>
            </span>
          );
        })}
      </span>
    </Tag>
  );
}
