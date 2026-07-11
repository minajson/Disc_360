"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { dimensionList } from "@/data/dimension-meta";
import type { Dimension } from "@/lib/types";

/** Editorial numbered rows — one per dimension, expandable. */
export function DimensionsInteractive() {
  const [openDim, setOpenDim] = useState<Dimension>("D");

  return (
    <div className="flex flex-col">
      {dimensionList.map((dim, index) => {
        const open = openDim === dim.code;
        const panelId = `dimension-panel-${dim.code}`;
        return (
          <div key={dim.code} className="rule-t last:rule-b">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpenDim(dim.code)}
              className="group flex w-full items-baseline gap-5 py-6 text-left sm:gap-8 sm:py-7"
            >
              <span className="font-mono text-sm text-faint">
                0{index + 1}
              </span>
              <span
                className={cn(
                  "font-display text-h3 font-semibold transition-colors",
                  open ? "text-ink" : "text-slate group-hover:text-ink",
                )}
              >
                {dim.label}
              </span>
              <span
                aria-hidden
                className="ml-auto size-2.5 shrink-0 self-center rounded-full transition-transform duration-300"
                style={{
                  background: `var(--color-${dim.colorVar})`,
                  transform: open ? "scale(1.6)" : "scale(1)",
                }}
              />
            </button>

            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  id={panelId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.32, 0.94, 0.6, 1] }}
                  className="overflow-hidden"
                >
                  <div className="grid gap-6 pb-8 pl-10 sm:pl-14 lg:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                        The question it answers
                      </span>
                      <p className="text-sm leading-relaxed text-ink">
                        {dim.question}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                        High expression
                      </span>
                      <p className="text-sm leading-relaxed text-slate">
                        {dim.high}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                        Under pressure
                      </span>
                      <p className="text-sm leading-relaxed text-slate">
                        {dim.underPressure}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
