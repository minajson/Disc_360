"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Draws a chart once, when it first comes into view.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY A WRAPPER AND NOT ANIMATION INSIDE EACH CHART.
 *
 * There are a dozen charts in this product and they are all server-rendered
 * SVG. Animating them individually would make every one of them a client
 * component, put a dozen copies of the same intersection logic in the bundle,
 * and guarantee that they drift apart. This is the only client component in
 * the chart layer: it sets one attribute, and `app/globals.css` decides what
 * that attribute means for `.chart-draw`, `.chart-appear` and `.chart-grow`.
 *
 * ONCE. NOT ON EVERY SCROLL.
 *
 * The observer disconnects after the first intersection. A chart that redraws
 * every time it re-enters the viewport is a chart that is moving while
 * somebody is trying to read the figure next to it.
 *
 * IT FAILS TO THE FINISHED STATE.
 *
 * If `IntersectionObserver` is unavailable, or the element is already on
 * screen at mount, the attribute is set immediately. The animation is an
 * enhancement of a chart that is complete and legible without it — never a
 * condition of it appearing.
 * ─────────────────────────────────────────────────────────────────────
 */
export function ChartReveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      // A little before the edge, so the draw has begun by the time the chart
      // is properly in view rather than starting under the reader's eye.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-chart-reveal={revealed ? "true" : "false"} className={className}>
      {children}
    </div>
  );
}
