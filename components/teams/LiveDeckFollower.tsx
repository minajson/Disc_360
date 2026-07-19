"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { SlideVisual } from "@/components/presentations/SlideVisual";
import type { PresentationDeck } from "@/lib/presentations/types";
import type { SessionState } from "@/lib/teams/session";

/**
 * Participant view of the facilitator's deck — the SAME slide content the
 * coach presents (no duplication; SlideVisual renders the shared deck data).
 *
 * Live mode: no navigation controls; the device follows the coach by polling
 * the member-scoped state route every 2.5s and snapping to the coach's
 * slide. Review mode: the participant browses freely with prev/next.
 */
export function LiveDeckFollower({
  deck,
  teamId,
  mode,
  initialSlide,
  initialState,
}: {
  deck: PresentationDeck;
  teamId: string;
  mode: "live" | "review";
  initialSlide: number;
  initialState: SessionState;
}) {
  const reduced = useReducedMotion() ?? false;
  const total = deck.slides.length;
  const clamp = useCallback(
    (value: number) => Math.max(0, Math.min(total - 1, value)),
    [total],
  );
  const [index, setIndex] = useState(clamp(initialSlide));
  const [sessionState, setSessionState] = useState<SessionState>(initialState);
  const pollFailures = useRef(0);

  // Live following — efficient polling of a single member-readable row.
  useEffect(() => {
    if (mode !== "live") return;
    const tick = async () => {
      try {
        const res = await fetch(`/app/teams/${teamId}/live/state`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { state: SessionState; activeSlide: number };
        pollFailures.current = 0;
        setSessionState(data.state);
        setIndex(clamp(data.activeSlide ?? 0));
      } catch {
        pollFailures.current += 1;
      }
    };
    const interval = setInterval(tick, 2500);
    tick();
    return () => clearInterval(interval);
  }, [mode, teamId, clamp]);

  const slide = deck.slides[index]!;
  const presentationOver = mode === "live" && sessionState !== "presentation";

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-canvas">
      <header className="flex items-center justify-between px-5 py-3">
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-faint">
          {deck.title}
        </span>
        <span className="font-mono text-xs text-faint">
          {mode === "live" ? "LIVE" : `${index + 1} / ${total}`}
        </span>
      </header>

      <div className="pres-stage min-h-0 flex-1 px-3 pb-3">
        <div className="pres-canvas paper-card relative overflow-hidden">
          {presentationOver ? (
            <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="font-display text-h3 font-semibold text-ink">
                The presentation has moved on.
              </p>
              <p className="max-w-sm text-sm text-slate">
                Your facilitator has {sessionState === "assessment_open" ? "opened the assessment" : "ended this part of the session"}.
              </p>
              <Link
                href="/app"
                className="inline-flex min-h-11 items-center rounded-full bg-botanical px-6 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
              >
                Go to your session
              </Link>
            </div>
          ) : (
            <SlideVisual slide={slide} reduced={reduced} />
          )}
        </div>
      </div>

      {mode === "review" ? (
        <footer className="flex items-center justify-center gap-3 pb-4">
          <button
            type="button"
            onClick={() => setIndex((c) => clamp(c - 1))}
            disabled={index === 0}
            aria-label="Previous slide"
            className="flex size-11 items-center justify-center rounded-full border border-hairline bg-paper text-slate transition-colors hover:border-botanical hover:text-botanical disabled:opacity-40"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setIndex((c) => clamp(c + 1))}
            disabled={index === total - 1}
            aria-label="Next slide"
            className="flex size-11 items-center justify-center rounded-full border border-hairline bg-paper text-slate transition-colors hover:border-botanical hover:text-botanical disabled:opacity-40"
          >
            →
          </button>
          <Link href="/app" className="ml-4 text-sm text-slate hover:text-ink">
            Back to dashboard
          </Link>
        </footer>
      ) : (
        <footer className="flex items-center justify-center pb-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            Following your facilitator
          </span>
        </footer>
      )}
    </div>
  );
}
