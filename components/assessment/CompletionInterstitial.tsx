"use client";

import { motion, useReducedMotion } from "framer-motion";
import { GlowPulse } from "@/components/motion/GlowPulse";
import { dimensionList } from "@/data/dimension-meta";

interface CompletionInterstitialProps {
  /** Present when result computation failed. */
  error: string | null;
  onRetry: () => void;
}

/**
 * Cinematic beat while the profile is computed. Motion-ready swap point
 * for a future dimensional scene.
 */
export function CompletionInterstitial({
  error,
  onRetry,
}: CompletionInterstitialProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative flex min-h-[420px] flex-col items-center justify-center gap-8 overflow-hidden text-center">
      <GlowPulse className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" size={560} />

      <div className="relative flex items-center justify-center">
        <motion.div
          aria-hidden
          className="absolute size-40 rounded-full border border-line"
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        >
          {dimensionList.map((dim, index) => (
            <span
              key={dim.code}
              className="absolute size-2 rounded-full"
              style={{
                background: `var(--color-${dim.colorVar})`,
                top: "50%",
                left: "50%",
                transform: `rotate(${index * 90}deg) translateY(-80px) translate(-50%, -50%)`,
              }}
            />
          ))}
        </motion.div>
        <motion.span
          className="relative font-mono text-sm uppercase tracking-[0.2em] text-ink-secondary"
          animate={reduceMotion ? undefined : { opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {error ? "Interrupted" : "Mapping"}
        </motion.span>
      </div>

      {error ? (
        <div className="relative flex flex-col items-center gap-4">
          <p role="alert" className="max-w-sm text-sm leading-relaxed text-ink-secondary">
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-line-strong px-6 py-2.5 font-display text-sm font-semibold text-ink transition-colors hover:border-accent/60 hover:bg-accent/5"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-2">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Computing your profile
          </h2>
          <p className="text-sm text-ink-muted">
            Weighing {dimensionList.map((d) => d.label).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
