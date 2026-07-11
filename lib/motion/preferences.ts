"use client";

import { useSyncExternalStore } from "react";

/**
 * Central motion-capability gates. Every enhanced scene must consult these:
 * - reduced  → render the static accessible layout
 * - lite     → coarse pointers / small screens get cheaper motion
 * Base layouts must be complete without JavaScript-driven motion.
 */

function subscribeToQuery(query: string) {
  return (onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const FULL_TIER_QUERY = "(pointer: fine) and (min-width: 1024px)";

const subscribeReduced = subscribeToQuery(REDUCED_QUERY);
const subscribeFull = subscribeToQuery(FULL_TIER_QUERY);

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

export type MotionTier = "full" | "lite" | "reduced";

/** full = fine-pointer desktop · lite = touch/small screens · reduced = user preference */
export function useMotionTier(): MotionTier {
  const reduced = usePrefersReducedMotion();
  const full = useSyncExternalStore(
    subscribeFull,
    () => window.matchMedia(FULL_TIER_QUERY).matches,
    () => false,
  );
  if (reduced) return "reduced";
  return full ? "full" : "lite";
}
