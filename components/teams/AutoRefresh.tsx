"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Near-real-time submissions: refreshes server data every 15 s while the
 * tab is visible. Cheap, honest polling — no websocket infrastructure.
 */
export function AutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
