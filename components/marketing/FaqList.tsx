"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export interface FaqItem {
  question: string;
  answer: string;
}

export function FaqList({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="flex flex-col">
      {items.map((item, index) => {
        const open = openIndex === index;
        const panelId = `faq-panel-${index}`;
        return (
          <div key={item.question} className="rule-t last:rule-b">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpenIndex(open ? null : index)}
              className="flex w-full items-center justify-between gap-6 py-5 text-left"
            >
              <span
                className={cn(
                  "text-base font-medium transition-colors",
                  open ? "text-ink" : "text-slate hover:text-ink",
                )}
              >
                {item.question}
              </span>
              <svg
                viewBox="0 0 16 16"
                className={cn(
                  "size-4 shrink-0 text-faint transition-transform duration-300",
                  open && "rotate-45",
                )}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M8 2v12M2 8h12" />
              </svg>
            </button>
            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  id={panelId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.32, 0.94, 0.6, 1] }}
                  className="overflow-hidden"
                >
                  <p className="max-w-2xl pb-6 text-sm leading-relaxed text-slate">
                    {item.answer}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
