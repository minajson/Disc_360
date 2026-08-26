"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { WellbeingDeck } from "@/lib/wellbeing/presentation";
import { DeckSlideBody, SLIDE_TITLE } from "./DeckSlides";

/**
 * The deck shell — navigation only.
 *
 * Every figure it renders was computed, authorised and suppressed on the
 * server and arrived as finished slide data. This component chooses which
 * slide is on screen and does nothing else: there is no fetch, no filter and
 * no toggle here, so there is no interaction that could surface a figure the
 * server declined to publish.
 *
 * Keyboard first, because that is how a deck is actually driven — arrows,
 * space, Home and End, plus the presenter-remote keys that map to page up and
 * page down. The on-screen controls exist for touch and for anybody who never
 * discovers the keys.
 */
export function DeckView({
  deck,
  backHref,
  syntheticBanner,
}: {
  deck: WellbeingDeck;
  backHref: string;
  /** Set only when the figures are synthetic. Never present on live data. */
  syntheticBanner: string | null;
}) {
  const [index, setIndex] = useState(0);
  const total = deck.slides.length;

  const go = useCallback(
    (next: number) => setIndex((current) => Math.max(0, Math.min(total - 1, next ?? current))),
    [total],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
          event.preventDefault();
          setIndex((current) => Math.min(total - 1, current + 1));
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          event.preventDefault();
          setIndex((current) => Math.max(0, current - 1));
          break;
        case "Home":
          event.preventDefault();
          setIndex(0);
          break;
        case "End":
          event.preventDefault();
          setIndex(total - 1);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  const slide = deck.slides[index]!;

  return (
    <div className="flex min-h-screen flex-col bg-pulse-mist">
      {/* rail */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-hairline px-6 py-3.5 sm:px-10">
        <span className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
          {deck.campaign}
        </span>
        <span className="font-mono text-[11px] text-faint">{deck.instrument}</span>

        {syntheticBanner && (
          <span className="rounded-full bg-[rgba(169,118,20,0.12)] px-3 py-1 font-mono text-[10px] tracking-[0.16em] text-[#7a5510] uppercase">
            {syntheticBanner}
          </span>
        )}

        <span className="ml-auto font-mono text-[11px] text-slate tabular-nums">
          {index + 1} / {total}
        </span>
        <Link
          href={backHref}
          className="pulse-focus rounded-full border border-hairline px-3 py-1.5 font-mono text-[11px] text-slate transition-colors hover:border-pulse hover:text-pulse"
        >
          Exit
        </Link>
      </header>

      {/* the slide */}
      <main className="flex flex-1 items-center px-6 py-8 sm:px-12 sm:py-12 lg:px-20">
        <div className="mx-auto w-full max-w-6xl">
          <DeckSlideBody slide={slide} />
        </div>
      </main>

      {/* controls */}
      <nav
        aria-label="Slides"
        className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 border-t border-hairline px-6 py-3.5 sm:px-10"
      >
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="pulse-focus rounded-full border border-hairline px-4 py-2 text-sm font-medium text-slate transition-colors hover:border-pulse hover:text-pulse disabled:opacity-35"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === total - 1}
          className="pulse-focus rounded-full bg-pulse-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink disabled:opacity-35"
        >
          Next →
        </button>

        <span className="hidden truncate text-sm text-slate lg:inline">
          {SLIDE_TITLE[slide.kind]}
        </span>

        <ol className="ml-auto flex items-center gap-1.5">
          {deck.slides.map((entry, position) => (
            <li key={`${entry.kind}-${position}`}>
              <button
                type="button"
                onClick={() => go(position)}
                aria-label={`Slide ${position + 1}: ${SLIDE_TITLE[entry.kind]}`}
                aria-current={position === index ? "true" : undefined}
                className={`pulse-focus block h-1.5 rounded-full transition-all ${
                  position === index ? "w-7 bg-pulse" : "w-3 bg-[rgba(31,78,95,0.22)] hover:bg-pulse-teal"
                }`}
              />
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
