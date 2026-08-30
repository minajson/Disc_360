"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion/preferences";

/**
 * A figure that counts to its value once, then stays still.
 *
 * ─────────────────────────────────────────────────────────────────────
 * SHARED, SO THERE IS ONE COUNTER AND NOT SIX.
 *
 * The executive tiles, the live participation panel and the presentation deck
 * all want the same behaviour, and three copies of a requestAnimationFrame
 * loop is three places for it to drift. This is the only one.
 *
 * NON-NUMERIC VALUES PASS STRAIGHT THROUGH. "Unrestricted", "—" and "83%" all
 * arrive here as strings; only the ones that parse as numbers are animated,
 * and a suffix like "%" is preserved rather than counted.
 *
 * The animated text is stored WITH the value it belongs to, and the render
 * falls back to the incoming value whenever the two disagree — which is what
 * keeps this free of a synchronising `setState` in the effect body. There is
 * nothing to reset, because a frame from the previous figure simply stops
 * matching.
 *
 * Under `prefers-reduced-motion` the figure simply changes.
 * ─────────────────────────────────────────────────────────────────────
 */
export function AnimatedNumber({
  value,
  durationMs = 420,
}: {
  value: string;
  durationMs?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [frame, setFrame] = useState<{ of: string; text: string } | null>(null);
  const from = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const parse = (text: string) => {
      const match = text.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
      return match ? { number: Number(match[1]), suffix: match[2] ?? "" } : null;
    };

    const to = parse(value);
    const previous = parse(from.current);
    from.current = value;

    if (
      reduced ||
      to === null ||
      previous === null ||
      to.suffix !== previous.suffix ||
      to.number === previous.number
    ) {
      return;
    }

    const start = performance.now();
    const decimals = (value.split(".")[1] ?? "").replace(/\D.*$/, "").length;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Ease-out: the figure arrives rather than skidding to a halt.
      const eased = 1 - (1 - t) * (1 - t);
      const current = previous.number + (to.number - previous.number) * eased;
      setFrame({ of: value, text: `${current.toFixed(decimals)}${to.suffix}` });
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);

    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [value, reduced, durationMs]);

  return <>{frame?.of === value ? frame.text : value}</>;
}
