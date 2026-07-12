"use client";

import { useEffect, useRef } from "react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { dimensionMeta } from "@/data/dimension-meta";
import { useMotionTier } from "@/lib/motion/preferences";
import type { Dimension } from "@/lib/types";

interface Delivery {
  dim: Dimension;
  line: string;
}

/** The same feedback — "we need to change direction" — adapted per style. */
const deliveries: Delivery[] = [
  {
    dim: "D",
    line: "“Here's the call: we pivot Friday. You own the go/no-go — challenge it today if you disagree.”",
  },
  {
    dim: "I",
    line: "“I want your energy on this — the pivot is a chance to tell a better story. Can I talk it through with you first?”",
  },
  {
    dim: "S",
    line: "“Nothing changes this week. Here's the transition plan, step by step — and what stays exactly the same for your team.”",
  },
  {
    dim: "C",
    line: "“The data behind the pivot is in the doc — assumptions flagged. Take two days with it; I want your holes-poked version.”",
  },
];

/**
 * Scroll-driven communication-adaptation story. GSAP ScrollTrigger scrubs a
 * short pinned sequence on capable devices; reduced/lite tiers get the plain
 * stacked layout. GSAP loads only inside this component.
 */
export function AdaptationStory() {
  const tier = useMotionTier();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tier !== "full" || !rootRef.current) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled || !rootRef.current) return;
      gsap.registerPlugin(ScrollTrigger);

      const cards = rootRef.current.querySelectorAll("[data-delivery]");
      const context = gsap.context(() => {
        gsap.set(cards, { yPercent: 24, opacity: 0 });
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top 70%",
            end: "bottom 60%",
            scrub: 0.6,
          },
        });
        cards.forEach((card, index) => {
          timeline.to(card, { yPercent: 0, opacity: 1, duration: 1 }, index * 0.6);
        });
      }, rootRef);

      cleanup = () => context.revert();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [tier]);

  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
        <Eyebrow index="05">Communication adaptation</Eyebrow>
        <h2 className="font-display text-h1 font-semibold text-balance">
          One message.
          <br />
          <span className="italic text-botanical">Four deliveries.</span>
        </h2>
        <p className="max-w-lg text-lead text-slate">
          The same feedback, landing well four different ways.
        </p>
      </div>

      <div ref={rootRef} className="mt-14 grid gap-4 sm:grid-cols-2">
        {deliveries.map((delivery) => {
          const meta = dimensionMeta[delivery.dim];
          return (
            <figure
              key={delivery.dim}
              data-delivery
              className="paper-card flex flex-col gap-4 p-7"
            >
              <figcaption className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ background: `var(--color-${meta.colorVar})` }}
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate">
                  To a {meta.label} colleague
                </span>
              </figcaption>
              <blockquote className="font-display text-lg leading-snug text-ink">
                {delivery.line}
              </blockquote>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
