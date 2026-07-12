"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface ExpandableSectionProps {
  label?: string;
  children: React.ReactNode;
}

/** "View more" accordion for the detailed copy behind concise summaries. */
export function ExpandableSection({
  label = "View more",
  children,
}: ExpandableSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 self-start text-xs font-medium text-botanical hover:underline print:hidden"
      >
        {open ? "View less" : label}
        <svg
          viewBox="0 0 16 16"
          className={open ? "size-3 rotate-180 transition-transform" : "size-3 transition-transform"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.94, 0.6, 1] }}
            className="overflow-hidden print:!h-auto print:!opacity-100"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
