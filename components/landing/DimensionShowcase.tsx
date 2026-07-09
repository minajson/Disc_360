"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { dimensionList, dimensionMeta } from "@/data/dimension-meta";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { DimensionPill } from "@/components/ui/DimensionPill";
import type { Dimension } from "@/lib/types";

const activeStyles: Record<Dimension, string> = {
  D: "border-disc-d/50",
  I: "border-disc-i/50",
  S: "border-disc-s/50",
  C: "border-disc-c/50",
};

/** Interactive explorer for the four DISC dimensions. */
export function DimensionShowcase() {
  const [active, setActive] = useState<Dimension>("D");
  const meta = dimensionMeta[active];

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        {dimensionList.map((dim) => (
          <button
            key={dim.code}
            type="button"
            onClick={() => setActive(dim.code)}
            aria-pressed={active === dim.code}
            className={cn(
              "glass-panel flex items-center gap-4 rounded-2xl px-5 py-4 text-left transition-all duration-200 ease-[var(--ease-atlas)] hover:glass-panel-raised",
              active === dim.code && ["glass-panel-raised", activeStyles[dim.code]],
            )}
          >
            <span
              className="font-mono text-2xl font-medium"
              style={{ color: `var(--color-${dim.colorVar}-glow)` }}
            >
              {dim.code}
            </span>
            <span className="flex flex-col">
              <span className="font-display text-sm font-semibold text-ink sm:text-base">
                {dim.label}
              </span>
              <span className="hidden text-xs text-ink-muted sm:block">
                {dim.essence}
              </span>
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassPanel glow={active} className="flex h-full flex-col gap-6 p-7 sm:p-9">
            <div className="flex items-center justify-between gap-4">
              <DimensionPill dimension={active} />
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-ink-muted">
                Dimension {meta.code}
              </span>
            </div>

            <p className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              {meta.question}
            </p>

            <dl className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                  High expression
                </dt>
                <dd className="text-sm leading-relaxed text-ink-secondary">
                  {meta.high}
                </dd>
              </div>
              <div className="flex flex-col gap-1.5">
                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                  Low expression
                </dt>
                <dd className="text-sm leading-relaxed text-ink-secondary">
                  {meta.low}
                </dd>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                  Under pressure
                </dt>
                <dd className="text-sm leading-relaxed text-ink-secondary">
                  {meta.underPressure}
                </dd>
              </div>
            </dl>
          </GlassPanel>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
