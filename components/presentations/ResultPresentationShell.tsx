"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Full-viewport shell for presenting a result or team summary. Simpler than
 * the deck player — a single scrollable canvas at presentation scale, with
 * fullscreen and exit. Readable on projector, conference display and
 * ultra-wide; the content scrolls within its own container so nothing spills.
 */
export function ResultPresentationShell({
  exitHref,
  children,
}: {
  exitHref: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void ref.current?.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f") toggleFullscreen();
      if (e.key === "Escape" && !document.fullscreenElement) window.location.assign(exitHref);
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
    };
  }, [toggleFullscreen, exitHref]);

  return (
    <div ref={ref} className="relative min-h-[100dvh] overflow-y-auto bg-canvas">
      <div className="sticky top-0 z-20 flex items-center justify-end gap-2 bg-canvas/85 px-[clamp(1rem,4vw,3rem)] py-3 backdrop-blur print:hidden">
        <button
          type="button"
          onClick={toggleFullscreen}
          className="rounded-full border border-hairline px-4 py-1.5 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
        >
          {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
        <Link
          href={exitHref}
          className="rounded-full border border-hairline px-4 py-1.5 text-xs text-slate transition-colors hover:border-disc-d hover:text-disc-d"
        >
          Exit
        </Link>
      </div>
      <div className="mx-auto w-full max-w-[min(94vw,1600px)] px-[clamp(1.25rem,5vw,5rem)] py-[clamp(1.5rem,4vh,4rem)]">
        {children}
      </div>
    </div>
  );
}
