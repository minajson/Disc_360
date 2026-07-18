"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import {
  preset,
  slideTransition,
  staggerContainer,
} from "@/lib/presentations/motion";
import type {
  DisplayDimension,
  PresentationSlide,
} from "@/lib/presentations/types";

/**
 * Renders one slide's audience-facing content, chosen by `visualType`. The
 * player owns the chrome (controls, progress, CTAs); this owns the message.
 *
 * Every layout is full-viewport and centred with generous whitespace, one
 * strong message per screen. Motion is applied through the shared presets and
 * collapses to plain fades under reduced motion — the `reduced` flag threads
 * down from the player, which reads it once via useReducedMotion.
 */

interface SlideVisualProps {
  slide: PresentationSlide;
  reduced: boolean;
  /** Extra content the player injects (e.g. closing-slide CTAs). */
  children?: React.ReactNode;
}

const DISC_COLOR: Record<DisplayDimension, string> = {
  D: "var(--color-disc-d)",
  I: "var(--color-disc-i)",
  S: "var(--color-disc-s)",
  A: "var(--color-disc-c)",
};
const DISC_SOFT: Record<DisplayDimension, string> = {
  D: "var(--color-disc-d-soft)",
  I: "var(--color-disc-i-soft)",
  S: "var(--color-disc-s-soft)",
  A: "var(--color-disc-c-soft)",
};

const ACCENT: Record<string, string> = {
  D: "var(--color-disc-d)",
  I: "var(--color-disc-i)",
  S: "var(--color-disc-s)",
  A: "var(--color-disc-c)",
  botanical: "var(--color-botanical)",
  teal: "var(--color-teal)",
};

/* ── shared frame ─────────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[clamp(0.7rem,0.4vw+0.6rem,0.85rem)] uppercase tracking-[0.28em] text-teal">
      {children}
    </span>
  );
}

function Title({
  children,
  reduced,
  size = "h1",
}: {
  children: React.ReactNode;
  reduced: boolean;
  size?: "display" | "h1" | "h2";
}) {
  const p = preset("fadeUp", reduced);
  const sizeClass =
    size === "display"
      ? "text-[length:var(--text-display)] leading-[1.02] tracking-[-0.02em]"
      : size === "h1"
        ? "text-[length:var(--text-h1)] leading-[1.06] tracking-[-0.015em]"
        : "text-[length:var(--text-h2)] leading-[1.12]";
  return (
    <motion.h2
      variants={p.variants}
      transition={p.transition}
      className={cn("max-w-[16ch] font-display font-semibold text-balance text-ink", sizeClass)}
    >
      {children}
    </motion.h2>
  );
}

function Body({ children, reduced }: { children: React.ReactNode; reduced: boolean }) {
  const p = preset("fadeUp", reduced);
  return (
    <motion.p
      variants={p.variants}
      transition={{ ...p.transition, delay: reduced ? 0 : 0.08 }}
      className="max-w-[42ch] text-pretty text-[clamp(1.05rem,1vw+0.85rem,1.6rem)] leading-relaxed text-slate"
    >
      {children}
    </motion.p>
  );
}

/**
 * The animated wrapper for a whole slide. A single stagger container drives the
 * title → body → visual sequence; children opt in with `variants` so we never
 * animate every object individually.
 */
function Frame({
  slide,
  reduced,
  children,
  className,
}: {
  slide: PresentationSlide;
  reduced: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainer(reduced, 0.1)}
      initial="hidden"
      animate="visible"
      className={cn(
        "mx-auto flex h-full w-full max-w-[min(92vw,1400px)] flex-col justify-center gap-[clamp(1.5rem,3vh,3rem)] px-[clamp(1.25rem,5vw,6rem)] py-[clamp(2rem,6vh,5rem)]",
        className,
      )}
    >
      {slide.eyebrow ? (
        <motion.div variants={preset("fadeUp", reduced).variants} transition={preset("fadeUp", reduced).transition}>
          <Eyebrow>{slide.eyebrow}</Eyebrow>
        </motion.div>
      ) : null}
      {children}
    </motion.div>
  );
}

/* ── ambient behavioural field (hero background) ──────────────────────── */

function AmbientField({ deckType, reduced }: { deckType: string; reduced: boolean }) {
  // A calm four-point field for DISC, a single-signal-amid-noise field for
  // focus. Very slow, very subtle — pure depth, never a distraction.
  const points =
    deckType === "focus"
      ? [{ cx: 50, cy: 50, r: 26, c: "var(--color-botanical)" }]
      : [
          { cx: 30, cy: 32, r: 20, c: "var(--color-disc-d)" },
          { cx: 70, cy: 30, r: 20, c: "var(--color-disc-i)" },
          { cx: 32, cy: 70, r: 20, c: "var(--color-disc-s)" },
          { cx: 70, cy: 70, r: 20, c: "var(--color-disc-c)" },
        ];
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]"
    >
      {points.map((pt, index) => (
        <motion.circle
          key={index}
          cx={pt.cx}
          cy={pt.cy}
          r={pt.r}
          fill={pt.c}
          initial={reduced ? false : { scale: 0.92, opacity: 0.6 }}
          animate={reduced ? undefined : { scale: [0.92, 1.04, 0.92], opacity: [0.6, 0.85, 0.6] }}
          transition={reduced ? undefined : { duration: 20 + index * 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: `${pt.cx}px ${pt.cy}px`, filter: "blur(6px)" }}
        />
      ))}
    </svg>
  );
}

/* ── visuals ──────────────────────────────────────────────────────────── */

function HeroVisual({ slide, reduced, children }: SlideVisualProps) {
  return (
    <div className="relative h-full w-full">
      <AmbientField deckType={slide.deckType} reduced={reduced} />
      <Frame slide={slide} reduced={reduced} className="relative">
        <Title reduced={reduced} size="display">
          {slide.title}
        </Title>
        {slide.body ? <Body reduced={reduced}>{slide.body}</Body> : null}
        {children}
      </Frame>
    </div>
  );
}

function SpectrumVisual({ slide, reduced, children }: SlideVisualProps) {
  const item = preset("fadeUp", reduced);
  return (
    <Frame slide={slide} reduced={reduced}>
      <Title reduced={reduced}>{slide.title}</Title>
      {slide.words ? (
        <motion.ul
          variants={staggerContainer(reduced, 0.1)}
          className="flex flex-wrap gap-x-[clamp(1.5rem,4vw,4rem)] gap-y-[clamp(0.5rem,2vh,1.5rem)] pt-2"
        >
          {slide.words.map((word) => (
            <motion.li
              key={word}
              variants={item.variants}
              transition={item.transition}
              className="font-display text-[clamp(1.6rem,3.5vw+0.5rem,3.4rem)] font-semibold tracking-tight text-ink"
            >
              {word}
            </motion.li>
          ))}
        </motion.ul>
      ) : null}
      {slide.body ? <Body reduced={reduced}>{slide.body}</Body> : null}
      {children}
    </Frame>
  );
}

function FourDimensionsVisual({ slide, reduced, children }: SlideVisualProps) {
  const item = preset("softScale", reduced);
  const dims = slide.dimensions ?? [];
  return (
    <Frame slide={slide} reduced={reduced}>
      <Title reduced={reduced} size="h2">
        {slide.title}
      </Title>
      <motion.div
        variants={staggerContainer(reduced, 0.12)}
        className="grid gap-[clamp(0.75rem,1.5vw,1.25rem)] sm:grid-cols-2"
      >
        {dims.map((dim) => (
          <motion.div
            key={dim.code + dim.label}
            variants={item.variants}
            transition={item.transition}
            className="flex items-center gap-4 rounded-2xl border border-hairline p-[clamp(1rem,2vw,1.75rem)]"
            style={{ background: DISC_SOFT[dim.code] }}
          >
            <span
              aria-hidden
              className="flex size-[clamp(2.75rem,4vw,3.75rem)] shrink-0 items-center justify-center rounded-full font-display text-[clamp(1.25rem,2vw,1.75rem)] font-semibold text-mineral"
              style={{ background: DISC_COLOR[dim.code] }}
            >
              {dim.code}
            </span>
            <span className="flex flex-col">
              <span className="font-display text-[clamp(1.15rem,1.6vw,1.6rem)] font-semibold text-ink">
                {dim.label}
              </span>
              {dim.note ? (
                <span className="text-[clamp(0.9rem,0.8vw,1.15rem)] text-slate">{dim.note}</span>
              ) : null}
            </span>
          </motion.div>
        ))}
      </motion.div>
      {slide.body ? <Body reduced={reduced}>{slide.body}</Body> : null}
      {children}
    </Frame>
  );
}

function TimelineVisual({ slide, reduced, children }: SlideVisualProps) {
  const item = preset("fadeUp", reduced);
  const line = preset("lineDraw", reduced);
  const steps = slide.steps ?? [];
  return (
    <Frame slide={slide} reduced={reduced}>
      <Title reduced={reduced} size="h2">
        {slide.title}
      </Title>
      <div className="relative pt-4">
        {/* connector */}
        <svg aria-hidden viewBox="0 0 100 2" preserveAspectRatio="none" className="absolute left-0 top-[calc(1rem+1.25rem)] hidden h-0.5 w-full sm:block">
          <motion.line
            x1="2" y1="1" x2="98" y2="1"
            stroke="var(--color-hairline, #d9d5cc)" strokeWidth="2" strokeLinecap="round"
            variants={line.variants} transition={line.transition}
          />
        </svg>
        <motion.ol
          variants={staggerContainer(reduced, 0.15)}
          className="grid gap-[clamp(1rem,2vw,1.5rem)] sm:grid-flow-col sm:auto-cols-fr"
        >
          {steps.map((step, index) => (
            <motion.li
              key={step.label}
              variants={item.variants}
              transition={item.transition}
              className="flex flex-col items-start gap-2 sm:items-center sm:text-center"
            >
              <span className="flex size-[clamp(2.25rem,3vw,2.75rem)] items-center justify-center rounded-full border border-hairline bg-paper font-mono text-sm text-teal">
                {index + 1}
              </span>
              <span className="font-display text-[clamp(1.15rem,1.8vw,1.75rem)] font-semibold text-ink">
                {step.label}
              </span>
              {step.note ? (
                <span className="text-[clamp(0.85rem,0.7vw,1.05rem)] text-slate">{step.note}</span>
              ) : null}
            </motion.li>
          ))}
        </motion.ol>
      </div>
      {slide.body ? <Body reduced={reduced}>{slide.body}</Body> : null}
      {children}
    </Frame>
  );
}

function ComparisonVisual({ slide, reduced, children }: SlideVisualProps) {
  const item = preset("fadeUp", reduced);

  // Three shapes share the comparison visual: labelled columns, strength→shadow
  // pairs, and a flat list of points.
  const columns = slide.columns;
  const pairs = slide.strengthShadows;
  const points = slide.points;

  return (
    <Frame slide={slide} reduced={reduced}>
      <Title reduced={reduced} size="h2">
        {slide.title}
      </Title>

      {columns ? (
        <motion.div variants={staggerContainer(reduced, 0.14)} className="grid gap-[clamp(1rem,2vw,1.75rem)] sm:grid-cols-2">
          {columns.map((col) => (
            <motion.div
              key={col.heading}
              variants={item.variants}
              transition={item.transition}
              className="flex flex-col gap-3 rounded-2xl border border-hairline bg-paper p-[clamp(1.25rem,2vw,2rem)]"
            >
              <span
                className="font-mono text-xs uppercase tracking-[0.22em]"
                style={{ color: ACCENT[col.accent ?? "botanical"] }}
              >
                {col.heading}
              </span>
              <ul className="flex flex-col gap-2.5">
                {col.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-3 text-[clamp(1rem,1.1vw,1.35rem)] leading-snug text-ink">
                    <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full" style={{ background: ACCENT[col.accent ?? "botanical"] }} />
                    {pt}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      ) : null}

      {pairs ? (
        <motion.ul variants={staggerContainer(reduced, 0.12)} className="flex flex-col gap-[clamp(0.6rem,1.5vh,1rem)]">
          {pairs.map((pair) => (
            <motion.li
              key={pair.strength}
              variants={item.variants}
              transition={item.transition}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-hairline/60 pb-3 text-[clamp(1.1rem,1.5vw,1.7rem)] leading-snug"
            >
              <span className="font-display font-semibold text-ink">{pair.strength}</span>
              <span aria-hidden className="text-teal">→</span>
              <span className="text-slate">{pair.shadow}</span>
            </motion.li>
          ))}
        </motion.ul>
      ) : null}

      {points ? (
        <motion.ul variants={staggerContainer(reduced, 0.09)} className="grid gap-x-[clamp(1.5rem,3vw,3rem)] gap-y-[clamp(0.4rem,1.2vh,0.9rem)] sm:grid-cols-2">
          {points.map((pt) => (
            <motion.li
              key={pt}
              variants={item.variants}
              transition={item.transition}
              className="flex items-center gap-3 text-[clamp(1.05rem,1.3vw,1.55rem)] text-ink"
            >
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-botanical" />
              {pt}
            </motion.li>
          ))}
        </motion.ul>
      ) : null}

      {slide.body ? <Body reduced={reduced}>{slide.body}</Body> : null}
      {children}
    </Frame>
  );
}

function ChartVisual({ slide, reduced, children }: SlideVisualProps) {
  // Two chart shapes: a blended DISC bar chart (when dimensions carry scores in
  // `note`), or an energy-rhythm curve otherwise.
  const dims = slide.dimensions;

  return (
    <Frame slide={slide} reduced={reduced}>
      <Title reduced={reduced} size="h2">
        {slide.title}
      </Title>
      {dims ? <BlendBars dims={dims} reduced={reduced} /> : <EnergyCurve reduced={reduced} />}
      {slide.body ? <Body reduced={reduced}>{slide.body}</Body> : null}
      {children}
    </Frame>
  );
}

function BlendBars({ dims, reduced }: { dims: NonNullable<PresentationSlide["dimensions"]>; reduced: boolean }) {
  const bar = preset("chartReveal", reduced);
  return (
    <motion.div variants={staggerContainer(reduced, 0.12)} className="flex items-end gap-[clamp(1rem,3vw,3rem)] pt-2" style={{ height: "clamp(160px, 26vh, 300px)" }}>
      {dims.map((dim) => {
        const value = Number(dim.note ?? 0);
        return (
          <div key={dim.code} className="flex h-full flex-1 flex-col items-center justify-end gap-3">
            <span className="font-mono text-sm text-slate">{value}</span>
            <motion.div
              variants={bar.variants}
              transition={bar.transition}
              className="w-full rounded-t-lg"
              style={{ height: `${value}%`, background: DISC_COLOR[dim.code], transformOrigin: "bottom" }}
            />
            <span className="font-display text-lg font-semibold text-ink">{dim.code}</span>
          </div>
        );
      })}
    </motion.div>
  );
}

function EnergyCurve({ reduced }: { reduced: boolean }) {
  const line = preset("lineDraw", reduced);
  return (
    <div className="pt-2">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-[clamp(140px,24vh,260px)] w-full" role="img" aria-label="A rhythm of energy rising and dipping through the day">
        {/* baseline */}
        <line x1="0" y1="38" x2="100" y2="38" stroke="var(--color-hairline,#d9d5cc)" strokeWidth="0.4" />
        <motion.path
          d="M0,30 C12,10 20,8 30,14 C40,20 46,34 58,32 C68,30 72,16 82,14 C90,12 96,20 100,18"
          fill="none"
          stroke="var(--color-botanical)"
          strokeWidth="1.2"
          strokeLinecap="round"
          variants={line.variants}
          transition={line.transition}
        />
      </svg>
      <div className="flex justify-between pt-2 font-mono text-xs text-faint">
        <span>Morning</span>
        <span>Midday</span>
        <span>Afternoon</span>
        <span>Late</span>
      </div>
    </div>
  );
}

function QuoteVisual({ slide, reduced, children }: SlideVisualProps) {
  const t = slideTransition(reduced);
  return (
    <div className="relative flex h-full items-center justify-center bg-ink px-[clamp(1.5rem,6vw,7rem)] py-[clamp(2rem,8vh,6rem)] text-center">
      <motion.div
        variants={staggerContainer(reduced, 0.12)}
        initial="hidden"
        animate="visible"
        className="flex max-w-[24ch] flex-col items-center gap-6"
      >
        {slide.eyebrow ? (
          <motion.span variants={t.variants} transition={t.transition} className="font-mono text-xs uppercase tracking-[0.28em] text-sage">
            {slide.eyebrow}
          </motion.span>
        ) : null}
        <motion.p
          variants={t.variants}
          transition={t.transition}
          className="font-display text-[length:var(--text-h1)] font-semibold leading-[1.08] tracking-[-0.015em] text-balance text-mineral"
        >
          {slide.title}
        </motion.p>
        {slide.body ? (
          <motion.p variants={t.variants} transition={t.transition} className="max-w-[42ch] text-[clamp(1rem,1vw+0.8rem,1.4rem)] leading-relaxed text-sage">
            {slide.body}
          </motion.p>
        ) : null}
        {children}
      </motion.div>
    </div>
  );
}

function InstructionsVisual({ slide, reduced, children }: SlideVisualProps) {
  const item = preset("fadeUp", reduced);
  const lines = slide.instructions ?? [];
  return (
    <Frame slide={slide} reduced={reduced}>
      <Title reduced={reduced} size="h2">
        {slide.title}
      </Title>
      {slide.body ? <Body reduced={reduced}>{slide.body}</Body> : null}
      <motion.ol variants={staggerContainer(reduced, 0.1)} className="flex flex-col gap-[clamp(0.6rem,1.5vh,1.1rem)]">
        {lines.map((instruction, index) => (
          <motion.li
            key={instruction}
            variants={item.variants}
            transition={item.transition}
            className="flex items-start gap-4 text-[clamp(1.05rem,1.2vw,1.5rem)] leading-snug text-ink"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-botanical font-display text-sm font-semibold text-mineral">
              {index + 1}
            </span>
            <span className="pt-0.5">{instruction}</span>
          </motion.li>
        ))}
      </motion.ol>
      {children}
    </Frame>
  );
}

function ClosingVisual({ slide, reduced, children }: SlideVisualProps) {
  return (
    <Frame slide={slide} reduced={reduced} className="items-center text-center">
      <Title reduced={reduced} size="display">
        {slide.title}
      </Title>
      {slide.body ? <Body reduced={reduced}>{slide.body}</Body> : null}
      {/* The player injects the start-assessment / dashboard CTAs here. */}
      {children}
    </Frame>
  );
}

/* ── dispatch ─────────────────────────────────────────────────────────── */

export function SlideVisual(props: SlideVisualProps) {
  switch (props.slide.visualType) {
    case "hero":
      return <HeroVisual {...props} />;
    case "spectrum":
      return <SpectrumVisual {...props} />;
    case "fourDimensions":
      return <FourDimensionsVisual {...props} />;
    case "timeline":
      return <TimelineVisual {...props} />;
    case "comparison":
      return <ComparisonVisual {...props} />;
    case "chart":
      return <ChartVisual {...props} />;
    case "quote":
      return <QuoteVisual {...props} />;
    case "instructions":
      return <InstructionsVisual {...props} />;
    case "closing":
      return <ClosingVisual {...props} />;
  }
}
