"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils/cn";
import { slideTransition } from "@/lib/presentations/motion";
import { deckDurationSeconds, type PresentationDeck } from "@/lib/presentations/types";
import { SlideVisual } from "@/components/presentations/SlideVisual";

/**
 * The deck player. Owns all chrome and navigation; SlideVisual owns each
 * slide's message. One player drives both the individual and the team flows —
 * the differences (what "Start assessment" does, whether a QR and a "Return to
 * dashboard" exist) arrive as props.
 *
 * Facilitator notes are OFF by default so a shared screen never leaks the
 * speaking prompts; the facilitator toggles them on their own device.
 */

interface QrConfig {
  joinUrl: string;
  isLocal: boolean;
  teamCode?: string;
  /** Shown above "Scan to begin" — usually the team name. */
  label?: string;
}

export interface PresentationPlayerProps {
  deck: PresentationDeck;
  /** Final-slide primary CTA label, e.g. "Start DISC assessment". */
  startLabel: string;
  /**
   * Server action to start the assessment (redirects). Preferred. When absent,
   * `startHref` is used for plain navigation.
   */
  startAction?: () => Promise<void>;
  startHref?: string;
  /** Where "Exit" leaves to (product page, or team dashboard). */
  exitHref: string;
  /** Team sessions: a labelled return that isn't the same as Exit. */
  dashboardHref?: string;
  dashboardLabel?: string;
  /** Team sessions: the participant join QR. */
  qr?: QrConfig;
  /** Softens the closing copy when no scored instrument exists yet. */
  assessmentLive?: boolean;
  /**
   * Facilitated sessions: called with the current slide index so live
   * participant followers track the coach's deck. Fire-and-forget.
   */
  syncAction?: (index: number) => Promise<void>;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.abs(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PresentationPlayer({
  deck,
  startLabel,
  startAction,
  startHref,
  exitHref,
  dashboardHref,
  dashboardLabel,
  qr,
  assessmentLive = true,
  syncAction,
}: PresentationPlayerProps) {
  const reduced = useReducedMotion() ?? false;
  const slides = deck.slides;
  const total = slides.length;

  const [index, setIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Fullscreen chrome auto-hides after inactivity, reappears on any activity.
  const [chromeHidden, setChromeHidden] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, startTransition] = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const slide = slides[index]!;
  const nextSlide = slides[index + 1];
  const isLast = index === total - 1;
  const totalSeconds = useMemo(() => deckDurationSeconds(deck), [deck]);

  const goTo = useCallback(
    (next: number) => setIndex(Math.min(total - 1, Math.max(0, next))),
    [total],
  );
  const goNext = useCallback(() => setIndex((c) => Math.min(total - 1, c + 1)), [total]);
  const goPrev = useCallback(() => setIndex((c) => Math.max(0, c - 1)), []);
  const restart = useCallback(() => setIndex(0), []);

  const start = useCallback(() => {
    if (startAction) {
      startTransition(async () => {
        await startAction();
      });
    } else if (startHref) {
      window.location.assign(startHref);
    }
  }, [startAction, startHref]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      const fullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(fullscreen);
      // Leaving fullscreen always restores the chrome (event callback, so no
      // synchronous set-state-in-effect).
      if (!fullscreen) setChromeHidden(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Live follower sync: report the slide the room is looking at.
  useEffect(() => {
    if (!syncAction) return;
    syncAction(index).catch(() => undefined);
  }, [index, syncAction]);

  // Auto-hide chrome in fullscreen after 3s of inactivity; any pointer, touch
  // or key activity brings it back. Outside fullscreen the chrome is fixed.
  useEffect(() => {
    if (!isFullscreen) return;
    const schedule = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setChromeHidden(true), 3000);
    };
    const poke = () => {
      setChromeHidden(false);
      schedule();
    };
    schedule();
    window.addEventListener("pointermove", poke);
    window.addEventListener("touchstart", poke);
    window.addEventListener("keydown", poke);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      window.removeEventListener("pointermove", poke);
      window.removeEventListener("touchstart", poke);
      window.removeEventListener("keydown", poke);
    };
  }, [isFullscreen]);

  // Keyboard: arrows / space / escape / n (notes) / f (fullscreen) / q (QR).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goPrev();
      } else if (event.key === " ") {
        event.preventDefault();
        goNext();
      } else if (event.key === "Escape") {
        if (showQr) setShowQr(false);
        else if (!document.fullscreenElement) window.location.assign(exitHref);
      } else if (event.key.toLowerCase() === "n") {
        setShowNotes((v) => !v);
      } else if (event.key.toLowerCase() === "f") {
        toggleFullscreen();
      } else if (event.key.toLowerCase() === "q" && qr) {
        setShowQr((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, toggleFullscreen, exitHref, qr, showQr]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(dx) > 50) (dx < 0 ? goNext : goPrev)();
    touchStartX.current = null;
  };

  const st = slideTransition(reduced);

  const ctrlBtn =
    "flex size-11 items-center justify-center rounded-full border border-hairline bg-paper/90 text-slate transition-colors hover:border-botanical hover:text-botanical disabled:opacity-40 disabled:hover:border-hairline disabled:hover:text-slate";

  return (
    <div
      ref={containerRef}
      data-testid="deck-root"
      className={cn(
        "relative flex h-dvh w-full flex-col overflow-hidden bg-canvas",
        isFullscreen && "pres-fullscreen",
      )}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* progress bar */}
      <div className="absolute inset-x-0 top-0 z-20 h-1 bg-ink/5" aria-hidden>
        <motion.div
          className="h-full bg-botanical"
          initial={false}
          animate={{ width: `${((index + 1) / total) * 100}%` }}
          transition={{ duration: reduced ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* top bar — overlays and auto-hides in fullscreen */}
      <header
        className={cn(
          "z-20 flex flex-wrap items-center justify-between gap-y-1 px-[clamp(1rem,3vw,2.5rem)] py-3 pt-[max(0.75rem,env(safe-area-inset-top))] transition-opacity duration-300",
          isFullscreen ? "absolute inset-x-0 top-0 bg-gradient-to-b from-canvas/95 to-transparent" : "relative",
          isFullscreen && chromeHidden && "pointer-events-none opacity-0",
        )}
        aria-hidden={isFullscreen && chromeHidden ? true : undefined}
      >
        <span className="min-w-0 truncate font-mono text-xs text-faint">{deck.title}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs tabular-nums text-slate" aria-live="polite">
            {index + 1} / {total}
          </span>
          {qr ? (
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              aria-pressed={showQr}
              className="rounded-full border border-hairline px-3 py-1.5 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
            >
              {showQr ? "Hide QR" : "Show QR"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            aria-pressed={showNotes}
            className="rounded-full border border-hairline px-3 py-1.5 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
          >
            {showNotes ? "Hide notes" : "Show facilitator notes"}
          </button>
          <Link
            href={exitHref}
            className="rounded-full border border-hairline px-3 py-1.5 text-xs text-slate transition-colors hover:border-disc-d hover:text-disc-d"
          >
            Exit
          </Link>
        </div>
      </header>

      {/* stage → 16:9 canvas in landscape, scrollable column on phones */}
      <div className="pres-stage relative z-10 min-h-0 flex-1">
        <motion.div
          key={slide.id}
          variants={st.variants}
          initial="hidden"
          animate="visible"
          transition={st.transition}
          className="pres-canvas"
        >
          <SlideVisual slide={slide} reduced={reduced}>
            {slide.visualType === "closing" ? (
              <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={start}
                  disabled={pending}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-botanical px-8 text-base font-medium text-mineral transition-colors hover:bg-botanical-deep disabled:opacity-60"
                >
                  {pending ? "Starting…" : startLabel}
                </button>
                {dashboardHref ? (
                  <Link
                    href={dashboardHref}
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-hairline-strong px-8 text-base font-medium text-ink transition-colors hover:border-botanical hover:text-botanical"
                  >
                    {dashboardLabel ?? "Return to facilitator dashboard"}
                  </Link>
                ) : null}
                {!assessmentLive ? (
                  <span className="text-xs text-faint">
                    This starts the available DISC assessment.
                  </span>
                ) : null}
              </div>
            ) : null}
          </SlideVisual>
        </motion.div>
      </div>

      {/* bottom controls — overlay and auto-hide in fullscreen */}
      <footer
        className={cn(
          "z-20 flex items-center justify-between gap-3 px-[clamp(1rem,3vw,2.5rem)] py-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-opacity duration-300",
          isFullscreen ? "absolute inset-x-0 bottom-0 bg-gradient-to-t from-canvas/95 to-transparent" : "relative",
          isFullscreen && chromeHidden && "pointer-events-none opacity-0",
        )}
        aria-hidden={isFullscreen && chromeHidden ? true : undefined}
      >
        <div className="flex items-center gap-2">
          <button type="button" onClick={goPrev} disabled={index === 0} aria-label="Previous slide" className={ctrlBtn}>
            <Chevron dir="left" />
          </button>
          <button type="button" onClick={goNext} disabled={isLast} aria-label="Next slide" className={ctrlBtn}>
            <Chevron dir="right" />
          </button>
          <button type="button" onClick={restart} aria-label="Restart presentation" className={cn(ctrlBtn, "size-11 text-xs")}>
            <RestartIcon />
          </button>
        </div>

        {/* progress dots */}
        <nav aria-label="Slides" className="hidden items-center gap-1.5 sm:flex">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-6 bg-botanical" : "w-1.5 bg-ink/15 hover:bg-ink/30",
              )}
            />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={start}
            disabled={pending}
            className="hidden rounded-full border border-hairline-strong px-4 py-2 text-xs font-medium text-ink transition-colors hover:border-botanical hover:text-botanical disabled:opacity-60 sm:inline-flex"
          >
            {pending ? "Starting…" : "Jump to assessment"}
          </button>
          <button type="button" onClick={toggleFullscreen} aria-label="Toggle fullscreen" className={ctrlBtn}>
            {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
        </div>
      </footer>

      {/* facilitator notes / presenter panel — facilitator device only */}
      {showNotes ? (
        <aside
          role="complementary"
          aria-label="Facilitator notes"
          className="absolute inset-x-0 bottom-0 z-30 border-t border-hairline bg-ink/95 px-[clamp(1rem,3vw,2.5rem)] py-5 text-mineral backdrop-blur print:hidden"
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-sage">
                  Slide {index + 1} · {slide.section}
                </span>
                {slide.estimatedSeconds ? (
                  <span className="font-mono text-[11px] text-sage/70">
                    ~{formatTime(slide.estimatedSeconds)}
                  </span>
                ) : null}
              </div>
              {slide.facilitatorPrompt ? (
                <p className="max-w-prose text-sm leading-relaxed text-mineral">{slide.facilitatorPrompt}</p>
              ) : (
                <p className="text-sm text-sage/70">No note for this slide.</p>
              )}
              {slide.audienceQuestion ? (
                <p className="text-sm text-sage">
                  <span className="font-medium text-mineral">Ask:</span> {slide.audienceQuestion}
                </p>
              ) : null}
            </div>

            {/* single-screen presenter console: next slide + deck timer */}
            <div className="flex shrink-0 gap-4 lg:w-72 lg:flex-col">
              <div className="flex-1 rounded-xl border border-mineral/15 bg-mineral/5 p-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-sage/70">Next</span>
                <p className="mt-1 line-clamp-2 text-sm text-mineral">
                  {nextSlide ? nextSlide.title : "End of deck — Start assessment"}
                </p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-mineral/15 bg-mineral/5 p-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-sage/70">Deck</span>
                <span className="font-mono text-sm text-mineral">~{formatTime(totalSeconds)}</span>
              </div>
            </div>
          </div>
        </aside>
      ) : null}

      {/* participant join QR overlay (team sessions) — sized to read from the
          back of a room, white quiet zone, readable fallback URL */}
      {qr && showQr ? (
        <div
          role="dialog"
          aria-label="Scan to begin"
          className="absolute inset-0 z-40 grid place-items-center bg-ink/60 p-4"
          onClick={() => setShowQr(false)}
        >
          <div
            className="paper-card flex max-h-[94dvh] w-[min(94vw,36rem)] flex-col items-center gap-[clamp(0.6rem,1.8vh,1.1rem)] overflow-y-auto p-[clamp(1.25rem,3.5vh,2.25rem)] text-center"
            onClick={(event) => event.stopPropagation()}
          >
            {qr.label ? (
              <span className="font-mono text-[clamp(0.7rem,1.6vh,0.85rem)] uppercase tracking-[0.22em] text-teal">
                {qr.label}
              </span>
            ) : null}
            <h2 className="font-display text-[clamp(1.5rem,4.2vh,2.6rem)] font-semibold leading-tight text-ink">
              Scan to begin
            </h2>
            <div className="w-[min(74vw,52dvh)] rounded-2xl border border-hairline bg-white p-[clamp(0.85rem,2.2vh,1.5rem)]">
              <QRCodeSVG
                value={qr.joinUrl}
                size={512}
                fgColor="#17201D"
                bgColor="#FFFFFF"
                marginSize={0}
                className="h-auto w-full"
                role="img"
                aria-label="QR code linking to the assessment join page"
              />
            </div>
            <p className="max-w-full break-all font-mono text-[clamp(0.85rem,2vh,1.1rem)] text-slate">
              {qr.joinUrl.replace(/^https?:\/\//, "")}
            </p>
            {qr.teamCode ? (
              <p className="text-[clamp(0.85rem,2vh,1.05rem)] text-slate">
                or enter code <span className="font-mono font-semibold text-ink">{qr.teamCode}</span>
              </p>
            ) : null}
            {qr.isLocal ? (
              <p role="alert" className="max-w-sm rounded-xl bg-disc-i-soft px-4 py-2.5 text-center text-xs leading-relaxed text-disc-i">
                Local development only — this QR cannot be opened from another device until a public URL is configured.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── icons ────────────────────────────────────────────────────────────── */

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}
function RestartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}
function ExitFullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M8 21v-3a2 2 0 0 0-2-2H3M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}
