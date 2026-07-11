"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSIONS } from "@/lib/types";
import { TeamQuadrantMap } from "@/components/teams/TeamQuadrantMap";
import type { TeamIntelligence } from "@/lib/insights/team";

const AUTO_ADVANCE_MS = 20_000;

interface PresentationDeckProps {
  data: TeamIntelligence;
  resultsUrl: string;
}

export function PresentationDeck({ data, resultsUrl }: PresentationDeckProps) {
  const reduced = useReducedMotion();
  const [slide, setSlide] = useState(0);
  const [showNames, setShowNames] = useState(data.named);
  const [autoAdvance, setAutoAdvance] = useState(false);

  const displayProfiles = useMemo(
    () =>
      data.profiles.map((profile) => ({
        ...profile,
        label: showNames ? profile.label : profile.anonLabel,
      })),
    [data.profiles, showNames],
  );

  const labelFor = useCallback(
    (index: number) => displayProfiles[index]?.label ?? "—",
    [displayProfiles],
  );

  const slides = useMemo(
    () => [
      { id: "title", label: "Title" },
      { id: "culture", label: "Culture" },
      { id: "map", label: "Team map" },
      { id: "gaps", label: "Communication" },
      { id: "strengths", label: "Strengths & risks" },
      { id: "actions", label: "Action plan" },
      { id: "closing", label: "Closing" },
    ],
    [],
  );
  const total = slides.length;

  const go = useCallback(
    (delta: number) => setSlide((current) => Math.max(0, Math.min(total - 1, current + delta))),
    [total],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        go(1);
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  useEffect(() => {
    if (!autoAdvance) return;
    const timer = setInterval(() => go(1), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [autoAdvance, go]);

  const enterFullscreen = () => {
    void document.documentElement.requestFullscreen?.();
  };

  const slideMotion = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -16 },
        transition: { duration: 0.4, ease: [0.32, 0.94, 0.6, 1] as const },
      };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* presenter chrome (hidden in print) */}
      <header className="flex items-center justify-between gap-4 px-8 py-4 print:hidden">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-faint">
          DISC360 · {data.teamName}
        </span>
        <div className="flex items-center gap-2.5">
          {data.named ? (
            <button
              type="button"
              onClick={() => setShowNames((v) => !v)}
              aria-pressed={showNames}
              className="rounded-full border border-hairline px-4 py-2 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical"
            >
              {showNames ? "Showing names" : "Anonymized"}
            </button>
          ) : (
            <span className="rounded-full border border-hairline px-4 py-2 text-sm text-faint">
              Anonymized
            </span>
          )}
          <button
            type="button"
            onClick={() => setAutoAdvance((v) => !v)}
            aria-pressed={autoAdvance}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition-colors",
              autoAdvance
                ? "border-botanical text-botanical"
                : "border-hairline text-slate hover:text-ink",
            )}
          >
            Auto-advance {autoAdvance ? "on" : "off"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full border border-hairline px-4 py-2 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical"
          >
            Export PDF
          </button>
          <button
            type="button"
            onClick={enterFullscreen}
            className="rounded-full border border-hairline px-4 py-2 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical"
          >
            Full screen
          </button>
          <Link
            href={`/app/teams/${data.teamId}`}
            className="rounded-full border border-hairline px-4 py-2 text-sm text-slate transition-colors hover:text-ink"
          >
            Exit
          </Link>
        </div>
      </header>

      {/* slides */}
      <main className="relative flex flex-1 items-center justify-center px-8 pb-24 sm:px-16">
        <AnimatePresence mode="wait">
          <motion.section
            key={slides[slide]!.id}
            {...slideMotion}
            aria-label={slides[slide]!.label}
            className="w-full max-w-6xl"
          >
            {slide === 0 ? (
              <div className="flex flex-col items-center gap-8 text-center">
                <span className="font-mono text-sm uppercase tracking-[0.3em] text-teal">
                  Team intelligence briefing
                </span>
                <h1 className="font-display text-[clamp(3rem,7vw,6.5rem)] font-semibold leading-[1.02] text-balance">
                  {data.teamName}
                </h1>
                <p className="text-xl text-slate">
                  {data.completedCount} completed profile{data.completedCount === 1 ? "" : "s"} ·{" "}
                  {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
            ) : null}

            {slide === 1 ? (
              <div className="mx-auto flex max-w-4xl flex-col gap-10">
                <span className="font-mono text-sm uppercase tracking-[0.3em] text-teal">
                  Culture
                </span>
                <p className="font-display text-[clamp(1.6rem,3.2vw,2.8rem)] font-medium leading-snug text-ink">
                  {data.cultureSummary}
                </p>
                <p className="max-w-3xl text-lg leading-relaxed text-slate">
                  {data.pressureShift}
                </p>
              </div>
            ) : null}

            {slide === 2 ? (
              <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]">
                <TeamQuadrantMap profiles={displayProfiles} presentation />
                <div className="flex flex-col gap-6">
                  <span className="font-mono text-sm uppercase tracking-[0.3em] text-teal">
                    Composition
                  </span>
                  {DIMENSIONS.map((dim) => (
                    <div key={dim} className="flex items-center gap-4">
                      <span className="w-32 text-lg text-slate">
                        {dimensionMeta[dim].label}
                      </span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-ink/8">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: `var(--color-${dimensionMeta[dim].colorVar})` }}
                          initial={reduced ? false : { width: 0 }}
                          animate={{
                            width: `${data.completedCount ? (data.composition[dim] / data.completedCount) * 100 : 0}%`,
                          }}
                          transition={{ duration: 0.8, ease: [0.32, 0.94, 0.6, 1] }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-lg text-ink">
                        {data.composition[dim]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {slide === 3 ? (
              <div className="flex flex-col gap-10">
                <span className="font-mono text-sm uppercase tracking-[0.3em] text-teal">
                  Where communication can break
                </span>
                <div className="grid gap-6 lg:grid-cols-2">
                  {data.communicationGaps.map((gap) => (
                    <div key={gap.between.join("-")} className="paper-card flex flex-col gap-4 p-8">
                      <h2 className="font-display text-2xl font-semibold">
                        {gap.between[0]} ↔ {gap.between[1]}
                      </h2>
                      <p className="text-lg leading-relaxed text-slate">{gap.friction}</p>
                      <p className="rule-t pt-4 text-lg leading-relaxed text-botanical">
                        {gap.bridge}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {slide === 4 ? (
              <div className="flex flex-col gap-10">
                <span className="font-mono text-sm uppercase tracking-[0.3em] text-teal">
                  Strengths and risks
                </span>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="flex flex-col gap-5">
                    {data.narrative.map((item) => (
                      <div key={item.title} className="paper-card flex flex-col gap-2 p-7">
                        <h2 className="font-display text-xl font-semibold">{item.title}</h2>
                        <p className="text-base leading-relaxed text-slate">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-5">
                    {data.riskZones.map((zone) => (
                      <div
                        key={zone.title}
                        className={cn(
                          "paper-card flex flex-col gap-2 p-7",
                          zone.severity === "high" && "border-disc-d/40",
                        )}
                      >
                        <span
                          className={cn(
                            "self-start rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wide",
                            zone.severity === "high"
                              ? "bg-disc-d-soft text-disc-d"
                              : "bg-disc-i-soft text-disc-i",
                          )}
                        >
                          {zone.severity === "high" ? "High attention" : "Watch"}
                        </span>
                        <h2 className="font-display text-xl font-semibold">{zone.title}</h2>
                        <p className="text-base leading-relaxed text-slate">{zone.detail}</p>
                      </div>
                    ))}
                    {data.frictionPairs.length > 0 ? (
                      <div className="paper-card flex flex-col gap-3 p-7">
                        <h2 className="font-display text-xl font-semibold">Watch these pairings</h2>
                        {data.frictionPairs.slice(0, 2).map((pair) => (
                          <p key={`${pair.aIndex}-${pair.bIndex}`} className="text-base leading-relaxed text-slate">
                            <span className="font-medium text-ink">
                              {labelFor(pair.aIndex)} ↔ {labelFor(pair.bIndex)}:
                            </span>{" "}
                            {pair.reason}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {slide === 5 ? (
              <div className="mx-auto flex max-w-4xl flex-col gap-10">
                <span className="font-mono text-sm uppercase tracking-[0.3em] text-teal">
                  Action plan
                </span>
                <ol className="flex flex-col gap-6">
                  {data.actions
                    .filter((action) => action.audience === "team")
                    .map((action, index) => (
                      <motion.li
                        key={action.action}
                        initial={reduced ? false : { opacity: 0, x: -24 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.15, duration: 0.4 }}
                        className="flex items-start gap-6"
                      >
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-botanical font-display text-xl font-semibold text-mineral">
                          {index + 1}
                        </span>
                        <p className="pt-2 text-xl leading-relaxed text-ink">{action.action}</p>
                      </motion.li>
                    ))}
                </ol>
              </div>
            ) : null}

            {slide === 6 ? (
              <div className="flex flex-col items-center gap-10 text-center">
                <h2 className="max-w-3xl font-display text-[clamp(2.2rem,4.5vw,4rem)] font-semibold leading-tight text-balance">
                  Style is now vocabulary.
                  <br />
                  <span className="italic text-botanical">Use it this week.</span>
                </h2>
                <div className="paper-card flex flex-col items-center gap-4 p-8">
                  <QRCodeSVG value={resultsUrl} size={180} fgColor="#17201D" bgColor="#FFFFFF" marginSize={1} />
                  <p className="max-w-xs text-sm leading-relaxed text-slate">
                    Members: scan to open the team summary and your personal
                    report on your own device.
                  </p>
                </div>
              </div>
            ) : null}
          </motion.section>
        </AnimatePresence>
      </main>

      {/* navigation (hidden in print) */}
      <footer className="fixed inset-x-0 bottom-0 flex items-center justify-between gap-6 px-8 pb-6 print:hidden">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={slide === 0}
          className="flex min-h-14 min-w-14 items-center justify-center rounded-full border border-hairline-strong bg-paper text-ink transition-colors hover:border-botanical disabled:pointer-events-none disabled:opacity-30"
          aria-label="Previous section"
        >
          <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l-6 6 6 6" /></svg>
        </button>

        <div className="flex items-center gap-2" role="tablist" aria-label="Sections">
          {slides.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={slide === index}
              aria-label={entry.label}
              onClick={() => setSlide(index)}
              className={cn(
                "h-2.5 rounded-full transition-all duration-300",
                slide === index ? "w-8 bg-botanical" : "w-2.5 bg-ink/15 hover:bg-ink/30",
              )}
            />
          ))}
          <span className="ml-3 font-mono text-xs text-faint">
            {slide + 1} / {total}
          </span>
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          disabled={slide === total - 1}
          className="flex min-h-14 min-w-14 items-center justify-center rounded-full border border-hairline-strong bg-paper text-ink transition-colors hover:border-botanical disabled:pointer-events-none disabled:opacity-30"
          aria-label="Next section"
        >
          <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4l6 6-6 6" /></svg>
        </button>
      </footer>
    </div>
  );
}
