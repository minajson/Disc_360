"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { preset, slideTransition, staggerContainer } from "@/lib/presentations/motion";
import { smoothPath, wrapLabel, type Point } from "@/lib/visuals/geometry";
import { BehaviourCompass } from "@/components/visualisations/disc/BehaviourCompass";
import { AttentionRippleMap } from "@/components/visualisations/focus/AttentionRippleMap";
import { FocusCycle } from "@/components/visualisations/focus/FocusCycle";
import { RecoveryCurve } from "@/components/visualisations/focus/RecoveryCurve";
import { OVERTURE_ALT, OvertureSlide } from "@/components/presentations/OvertureSlide";
import type {
  DisplayDimension,
  PresentationSlide,
} from "@/lib/presentations/types";
import type { Dimension, DiscScores } from "@/lib/types";

/**
 * Renders one slide's audience-facing content, chosen by `visualType`. The
 * player owns the chrome; this owns the message.
 *
 * Every size and space in here reads the `--pres-*` variables defined by the
 * slide engine (globals.css): canvas mode resolves them against the 16:9
 * canvas (cqw/cqh), portrait mode against the viewport — one component, both
 * worlds, and an ultrawide screen scales type with the slide, not the window.
 * Motion runs through the shared presets and collapses under reduced motion.
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
/** Display letter → internal dimension key (A is Analytical/C). */
const INTERNAL: Record<DisplayDimension, Dimension> = { D: "D", I: "I", S: "S", A: "C" };

/* ── shared frame ─────────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[length:var(--pres-eyebrow)] uppercase tracking-[0.28em] text-teal">
      {children}
    </span>
  );
}

function Title({
  children,
  reduced,
  size = "title",
}: {
  children: React.ReactNode;
  reduced: boolean;
  size?: "display" | "title" | "heading";
}) {
  const p = preset("fadeUp", reduced);
  return (
    <motion.h2
      variants={p.variants}
      transition={p.transition}
      className={cn(
        "max-w-[18ch] font-display font-semibold text-balance text-ink",
        size === "display" && "text-[length:var(--pres-display)] leading-[1.02] tracking-[-0.02em]",
        size === "title" && "text-[length:var(--pres-title)] leading-[1.06] tracking-[-0.015em]",
        size === "heading" && "text-[length:var(--pres-heading)] leading-[1.1]",
      )}
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
      className="max-w-[46ch] text-pretty text-[length:var(--pres-body)] leading-relaxed text-slate"
    >
      {children}
    </motion.p>
  );
}

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
        "mx-auto flex min-h-full w-full flex-col justify-center gap-[var(--pres-gap)] px-[var(--pres-pad)] py-[calc(var(--pres-pad)*0.7)]",
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
    <div className="relative min-h-full w-full">
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
          className="flex flex-wrap gap-x-[calc(var(--pres-gap)*1.4)] gap-y-[calc(var(--pres-gap)*0.5)] pt-2"
        >
          {slide.words.map((word) => (
            <motion.li
              key={word}
              variants={item.variants}
              transition={item.transition}
              className="font-display text-[length:var(--pres-heading)] font-semibold tracking-tight text-ink"
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
      <Title reduced={reduced} size="heading">
        {slide.title}
      </Title>
      <motion.div
        variants={staggerContainer(reduced, 0.12)}
        className="grid gap-[calc(var(--pres-gap)*0.55)] sm:grid-cols-2"
      >
        {dims.map((dim) => (
          <motion.div
            key={dim.code + dim.label}
            variants={item.variants}
            transition={item.transition}
            className="flex items-center gap-[calc(var(--pres-gap)*0.55)] rounded-2xl border border-hairline p-[calc(var(--pres-gap)*0.7)]"
            style={{ background: DISC_SOFT[dim.code] }}
          >
            <span
              aria-hidden
              className="flex size-[calc(var(--pres-body)*2.1)] shrink-0 items-center justify-center rounded-full font-display font-semibold text-mineral"
              style={{ background: DISC_COLOR[dim.code], fontSize: "var(--pres-statement)" }}
            >
              {dim.code}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="font-display text-[length:var(--pres-statement)] font-semibold leading-tight text-ink">
                {dim.label}
              </span>
              {dim.note ? (
                <span className="text-[length:var(--pres-caption)] text-slate">{dim.note}</span>
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

/** Ordered steps on a flowing curved path — never a straight connector. */
function TimelineVisual({ slide, reduced, children }: SlideVisualProps) {
  const item = preset("fadeUp", reduced);
  const line = preset("lineDraw", reduced);
  const steps = slide.steps ?? [];
  const count = Math.max(steps.length, 2);

  // Desktop/canvas: nodes spaced along a gentle wave.
  const VB_W = 640;
  const VB_H = 190;
  const pad = 56;
  const nodes: Point[] = steps.map((_, index) => ({
    x: pad + (index * (VB_W - pad * 2)) / (count - 1),
    y: 74 + (index % 2 === 0 ? -14 : 14),
  }));

  return (
    <Frame slide={slide} reduced={reduced}>
      <Title reduced={reduced} size="heading">
        {slide.title}
      </Title>

      {/* flowing curve — hidden on portrait phones, which get the stack below */}
      <div className="hidden sm:block">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-auto w-full" role="img" aria-label={steps.map((s) => s.label).join(" → ")}>
          <motion.path
            d={smoothPath(nodes, 0.6)}
            fill="none"
            stroke="var(--color-teal)"
            strokeOpacity={0.55}
            strokeWidth={2.5}
            strokeLinecap="round"
            variants={line.variants}
            transition={line.transition}
          />
          {steps.map((step, index) => {
            const node = nodes[index]!;
            const above = index % 2 === 0;
            const lines = wrapLabel(step.label, 14);
            const labelY = above ? node.y + 38 : node.y - 26 - (lines.length - 1) * 17 - (step.note ? 15 : 0);
            return (
              <g key={step.label}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={17}
                  fill="var(--color-paper)"
                  stroke="var(--color-teal)"
                  strokeWidth={2}
                />
                <text
                  x={node.x}
                  y={node.y + 5}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={600}
                  fill="var(--color-teal)"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {index + 1}
                </text>
                <text x={node.x} y={labelY} textAnchor="middle" fontSize={17} fontWeight={600} fill="var(--color-ink)">
                  {lines.map((lineText, lineIndex) => (
                    <tspan key={lineText} x={node.x} dy={lineIndex === 0 ? 0 : 17}>
                      {lineText}
                    </tspan>
                  ))}
                  {step.note ? (
                    <tspan x={node.x} dy={16} fontSize={12.5} fontWeight={400} fill="var(--color-slate)">
                      {step.note}
                    </tspan>
                  ) : null}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* portrait stack */}
      <motion.ol variants={staggerContainer(reduced, 0.12)} className="flex flex-col gap-[calc(var(--pres-gap)*0.55)] sm:hidden">
        {steps.map((step, index) => (
          <motion.li key={step.label} variants={item.variants} transition={item.transition} className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-paper font-mono text-sm text-teal">
              {index + 1}
            </span>
            <span className="flex flex-col">
              <span className="font-display text-[length:var(--pres-statement)] font-semibold leading-tight text-ink">
                {step.label}
              </span>
              {step.note ? <span className="text-[length:var(--pres-caption)] text-slate">{step.note}</span> : null}
            </span>
          </motion.li>
        ))}
      </motion.ol>

      {slide.body ? <Body reduced={reduced}>{slide.body}</Body> : null}
      {children}
    </Frame>
  );
}

function ComparisonVisual({ slide, reduced, children }: SlideVisualProps) {
  const item = preset("fadeUp", reduced);
  const columns = slide.columns;
  const pairs = slide.strengthShadows;
  const points = slide.points;

  return (
    <Frame slide={slide} reduced={reduced}>
      <Title reduced={reduced} size="heading">
        {slide.title}
      </Title>

      {columns ? (
        <motion.div variants={staggerContainer(reduced, 0.14)} className="grid gap-[calc(var(--pres-gap)*0.6)] sm:grid-cols-2">
          {columns.map((col) => (
            <motion.div
              key={col.heading}
              variants={item.variants}
              transition={item.transition}
              className="flex flex-col gap-3 rounded-2xl border border-hairline bg-paper p-[calc(var(--pres-gap)*0.8)]"
            >
              <span
                className="font-mono text-[length:var(--pres-eyebrow)] uppercase tracking-[0.22em]"
                style={{ color: ACCENT[col.accent ?? "botanical"] }}
              >
                {col.heading}
              </span>
              <ul className="flex flex-col gap-2.5">
                {col.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-3 text-[length:var(--pres-body)] leading-snug text-ink">
                    <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 rounded-full" style={{ background: ACCENT[col.accent ?? "botanical"] }} />
                    {pt}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      ) : null}

      {pairs ? (
        <motion.ul variants={staggerContainer(reduced, 0.12)} className="flex flex-col gap-[calc(var(--pres-gap)*0.4)]">
          {pairs.map((pair) => (
            <motion.li
              key={pair.strength}
              variants={item.variants}
              transition={item.transition}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-hairline/60 pb-[calc(var(--pres-gap)*0.35)] text-[length:var(--pres-statement)] leading-snug"
            >
              <span className="font-display font-semibold text-ink">{pair.strength}</span>
              <span aria-hidden className="text-teal">→</span>
              <span className="text-slate">{pair.shadow}</span>
            </motion.li>
          ))}
        </motion.ul>
      ) : null}

      {points ? (
        <motion.ul variants={staggerContainer(reduced, 0.09)} className="grid gap-x-[var(--pres-gap)] gap-y-[calc(var(--pres-gap)*0.35)] sm:grid-cols-2">
          {points.map((pt) => (
            <motion.li
              key={pt}
              variants={item.variants}
              transition={item.transition}
              className="flex items-center gap-3 text-[length:var(--pres-body)] text-ink"
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
  const line = preset("lineDraw", reduced);
  return (
    <Frame slide={slide} reduced={reduced}>
      <Title reduced={reduced} size="heading">
        {slide.title}
      </Title>
      <div className="pt-2">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-[clamp(120px,30cqh,340px)] w-full" role="img" aria-label="A rhythm of energy rising and dipping through the day">
          <line x1="0" y1="38" x2="100" y2="38" stroke="var(--color-hairline)" strokeWidth="0.4" />
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
        <div className="flex justify-between pt-2 font-mono text-[length:var(--pres-caption)] text-faint">
          <span>Morning</span>
          <span>Midday</span>
          <span>Afternoon</span>
          <span>Late</span>
        </div>
      </div>
      {slide.body ? <Body reduced={reduced}>{slide.body}</Body> : null}
      {children}
    </Frame>
  );
}

function QuoteVisual({ slide, reduced, children }: SlideVisualProps) {
  const t = slideTransition(reduced);
  return (
    <div className="flex min-h-full items-center justify-center bg-ink px-[var(--pres-pad)] py-[calc(var(--pres-pad)*0.7)] text-center">
      <motion.div
        variants={staggerContainer(reduced, 0.12)}
        initial="hidden"
        animate="visible"
        className="flex max-w-[26ch] flex-col items-center gap-[var(--pres-gap)]"
      >
        {slide.eyebrow ? (
          <motion.span variants={t.variants} transition={t.transition} className="font-mono text-[length:var(--pres-eyebrow)] uppercase tracking-[0.28em] text-sage">
            {slide.eyebrow}
          </motion.span>
        ) : null}
        <motion.p
          variants={t.variants}
          transition={t.transition}
          className="font-display text-[length:var(--pres-title)] font-semibold leading-[1.08] tracking-[-0.015em] text-balance text-mineral"
        >
          {slide.title}
        </motion.p>
        {slide.body ? (
          <motion.p variants={t.variants} transition={t.transition} className="max-w-[46ch] text-[length:var(--pres-body)] leading-relaxed text-sage">
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
      <Title reduced={reduced} size="heading">
        {slide.title}
      </Title>
      {slide.body ? <Body reduced={reduced}>{slide.body}</Body> : null}
      <motion.ol variants={staggerContainer(reduced, 0.1)} className="flex flex-col gap-[calc(var(--pres-gap)*0.45)]">
        {lines.map((instruction, index) => (
          <motion.li
            key={instruction}
            variants={item.variants}
            transition={item.transition}
            className="flex items-start gap-[calc(var(--pres-gap)*0.5)] text-[length:var(--pres-body)] leading-snug text-ink"
          >
            <span
              className="flex size-[calc(var(--pres-body)*1.7)] shrink-0 items-center justify-center rounded-full bg-botanical font-display font-semibold text-mineral"
              style={{ fontSize: "calc(var(--pres-body) * 0.75)" }}
            >
              {index + 1}
            </span>
            <span className="pt-[0.1em]">{instruction}</span>
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
      {children}
    </Frame>
  );
}

/* ── rich-visual slides (compass / ripple / cycle / recovery curve) ───── */

/**
 * Constrains an instrument visual so it fits the 16:9 canvas by HEIGHT: the
 * max width is the visual's aspect ratio × the canvas height left over after
 * the title block. Portrait phones scroll, so the px cap simply keeps visuals
 * comfortable there.
 */
function VisualStage({
  aspect = "square",
  children,
}: {
  /** square 1:1 (compass) · ring 640:420 (cycle) · flat 640:360 (ripple/curve) */
  aspect?: "square" | "ring" | "flat";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        aspect === "square" && "max-w-[min(56cqh,430px)]",
        aspect === "ring" && "max-w-[min(82cqh,600px)]",
        aspect === "flat" && "max-w-[min(100cqh,720px)]",
      )}
    >
      {children}
    </div>
  );
}

function CompassSlide({ slide, reduced, children }: SlideVisualProps) {
  const dims = slide.dimensions ?? [];
  const scored = dims.filter((d) => d.note && !Number.isNaN(Number(d.note)));
  const isExample = scored.length === 4;

  let scores: DiscScores = { d: 55, i: 55, s: 55, c: 55 };
  let primary: Dimension = "D";
  let secondary: Dimension | null = null;
  if (isExample) {
    const byInternal = new Map<Dimension, number>(
      scored.map((d) => [INTERNAL[d.code], Number(d.note)]),
    );
    scores = {
      d: byInternal.get("D") ?? 50,
      i: byInternal.get("I") ?? 50,
      s: byInternal.get("S") ?? 50,
      c: byInternal.get("C") ?? 50,
    };
    const ranked = [...byInternal.entries()].sort((a, b) => b[1] - a[1]);
    primary = ranked[0]?.[0] ?? "D";
    secondary = ranked[1]?.[0] ?? null;
  }

  return (
    <Frame slide={slide} reduced={reduced}>
      <Title reduced={reduced} size="heading">
        {slide.title}
      </Title>
      <VisualStage>
        <BehaviourCompass
          variant={isExample ? "profile" : "concept"}
          scores={scores}
          primary={primary}
          secondary={secondary}
          showScores={isExample}
        />
      </VisualStage>
      {/* concept mode keeps the four teaching labels as a legend */}
      {!isExample && dims.length > 0 ? (
        <ul className="mx-auto grid w-fit gap-x-[var(--pres-gap)] gap-y-[calc(var(--pres-gap)*0.3)] sm:grid-cols-2">
          {dims.map((dim) => (
            <li key={dim.code} className="flex items-center gap-2.5 text-[length:var(--pres-body)] text-ink">
              <span
                aria-hidden
                className="flex size-[1.5em] shrink-0 items-center justify-center rounded-full font-mono text-[0.7em] font-semibold text-mineral"
                style={{ background: DISC_COLOR[dim.code] }}
              >
                {dim.code}
              </span>
              {dim.label}
            </li>
          ))}
        </ul>
      ) : null}
      {slide.body ? <Body reduced={reduced}>{slide.body}</Body> : null}
      {children}
    </Frame>
  );
}

function RippleSlide({ slide, reduced, children }: SlideVisualProps) {
  return (
    <Frame slide={slide} reduced={reduced}>
      <Title reduced={reduced} size="heading">
        {slide.title}
      </Title>
      <VisualStage aspect="flat">
        <AttentionRippleMap markers={(slide.words ?? []).map((label) => ({ label }))} />
      </VisualStage>
      {slide.body ? <Body reduced={reduced}>{slide.body}</Body> : null}
      {children}
    </Frame>
  );
}

function CycleSlide({ slide, reduced, children }: SlideVisualProps) {
  return (
    <Frame slide={slide} reduced={reduced}>
      <Title reduced={reduced} size="heading">
        {slide.title}
      </Title>
      <VisualStage aspect="ring">
        <FocusCycle stages={slide.steps ?? []} />
      </VisualStage>
      {slide.body ? <Body reduced={reduced}>{slide.body}</Body> : null}
      {children}
    </Frame>
  );
}

function RecoveryCurveSlide({ slide, reduced, children }: SlideVisualProps) {
  return (
    <Frame slide={slide} reduced={reduced}>
      <Title reduced={reduced} size="heading">
        {slide.title}
      </Title>
      <VisualStage aspect="flat">
        <RecoveryCurve annotations={(slide.steps ?? []).map((step) => step.label)} />
      </VisualStage>
      {slide.body ? <Body reduced={reduced}>{slide.body}</Body> : null}
      {children}
    </Frame>
  );
}

/* ── statement ────────────────────────────────────────────────────────── */

/**
 * One claim, then the three things a room can do something about.
 *
 * This replaced a black poster slide: a high-contrast panel with a sentence
 * and a paragraph on it, which read as a web callout rather than a keynote
 * beat. The claim now owns the upper half at display size on the deck's own
 * ivory, and the three cards underneath arrive after it — so the room hears
 * the statement, then sees where it lands, instead of reading both at once.
 *
 * Each card takes a DISC tint as a hairline accent only: identity colour used
 * as an identifier, never as chrome.
 */
function StatementVisual({ slide, reduced }: SlideVisualProps) {
  const t = slideTransition(reduced);
  const cards = slide.columns ?? [];

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-[calc(var(--pres-gap)*1.6)] px-[var(--pres-pad)] py-[calc(var(--pres-pad)*0.8)] text-center">
      <motion.div
        variants={staggerContainer(reduced, 0.14)}
        initial="hidden"
        animate="visible"
        className="flex flex-col items-center gap-[var(--pres-gap)]"
      >
        {slide.eyebrow ? (
          <motion.span
            variants={t.variants}
            transition={t.transition}
            className="font-mono text-[length:var(--pres-eyebrow)] uppercase tracking-[0.28em] text-teal"
          >
            {slide.eyebrow}
          </motion.span>
        ) : null}
        <motion.h2
          variants={t.variants}
          transition={t.transition}
          className="max-w-[26ch] font-display text-[length:var(--pres-title)] font-semibold leading-[1.06] tracking-[-0.015em] text-balance text-ink"
        >
          {slide.title}
        </motion.h2>
      </motion.div>

      {cards.length > 0 ? (
        <motion.div
          variants={staggerContainer(reduced, 0.1)}
          initial="hidden"
          animate="visible"
          className="grid w-full max-w-[86cqw] gap-[var(--pres-gap)] sm:grid-cols-3"
        >
          {cards.map((card) => {
            const accent = ACCENT[card.accent ?? "teal"] ?? "var(--color-teal)";
            return (
              <motion.div
                key={card.heading}
                variants={t.variants}
                transition={{ ...t.transition, delay: reduced ? 0 : 0.22 }}
                className="paper-card flex flex-col items-center gap-[calc(var(--pres-gap)*0.5)] px-[calc(var(--pres-pad)*0.42)] py-[calc(var(--pres-pad)*0.5)]"
              >
                <span
                  aria-hidden
                  className="h-1 w-10 rounded-full"
                  style={{ background: accent }}
                />
                <span className="text-balance font-display text-[length:var(--pres-body)] font-semibold leading-tight text-ink">
                  {card.heading}
                </span>
                {card.points.map((point) => (
                  <span
                    key={point}
                    className="text-pretty text-[length:var(--pres-caption)] leading-snug text-slate"
                  >
                    {point}
                  </span>
                ))}
              </motion.div>
            );
          })}
        </motion.div>
      ) : null}
    </div>
  );
}

/* ── keynote patterns ─────────────────────────────────────────────────── */

/**
 * A slide heading used by the patterns below.
 *
 * Every pattern opens the same way — eyebrow, then title — so a deck built
 * from different layouts still reads as one keynote. Sizes come from the slide
 * engine, never hard-coded, so a 4K wall scales with the canvas.
 */
function PatternHead({ slide, reduced }: { slide: PresentationSlide; reduced: boolean }) {
  const t = slideTransition(reduced);
  return (
    <motion.div
      variants={staggerContainer(reduced, 0.08)}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center gap-[calc(var(--pres-gap)*0.4)] text-center"
    >
      {slide.eyebrow ? (
        <motion.span
          variants={t.variants}
          transition={t.transition}
          className="font-mono text-[length:var(--pres-eyebrow)] uppercase tracking-[0.28em] text-teal"
        >
          {slide.eyebrow}
        </motion.span>
      ) : null}
      <motion.h2
        variants={t.variants}
        transition={t.transition}
        className="max-w-[24ch] font-display text-[length:var(--pres-title)] font-semibold leading-[1.06] tracking-[-0.015em] text-balance text-ink"
      >
        {slide.title}
      </motion.h2>
      {slide.body ? (
        <motion.p
          variants={t.variants}
          transition={t.transition}
          className="max-w-[52ch] text-pretty text-[length:var(--pres-body)] leading-snug text-slate"
        >
          {slide.body}
        </motion.p>
      ) : null}
    </motion.div>
  );
}

/** The outer shell every pattern sits in: centred, inside the safe area. */
function PatternFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-[calc(var(--pres-gap)*1.2)] px-[var(--pres-pad)] py-[calc(var(--pres-pad)*0.6)]">
      {children}
    </div>
  );
}

/**
 * Four stages on one line, evenly weighted.
 *
 * The timeline this replaces drew a curved path with labels hung off it, and
 * the first and last labels ran past the canvas — which in strict 16:9 means
 * they are simply gone. Equal columns cannot clip at the ends, because there
 * are no ends to overhang: the rule runs behind the row and every stage owns
 * the same width.
 */
function JourneyVisual({ slide, reduced }: SlideVisualProps) {
  const t = slideTransition(reduced);
  const steps = slide.steps ?? [];
  return (
    <PatternFrame>
      <PatternHead slide={slide} reduced={reduced} />
      <motion.ol
        variants={staggerContainer(reduced, 0.1)}
        initial="hidden"
        animate="visible"
        style={{ ["--journey-cols" as string]: String(Math.max(1, steps.length)) }}
        className="relative grid w-full max-w-[88cqw] grid-cols-2 gap-[var(--pres-gap)] sm:[grid-template-columns:repeat(var(--journey-cols),minmax(0,1fr))]"
      >
        {/* The connecting line, behind the row and inset so it never reaches
            the canvas edge. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-[12%] top-[calc(var(--pres-gap)*0.55)] hidden h-px bg-hairline-strong sm:block"
        />
        {steps.map((step, index) => (
          <motion.li
            key={step.label}
            variants={t.variants}
            transition={t.transition}
            className="relative flex flex-col items-center gap-[calc(var(--pres-gap)*0.4)] text-center"
          >
            <span
              className="flex size-[calc(var(--pres-gap)*1.1)] items-center justify-center rounded-full border border-hairline bg-paper font-mono text-[length:var(--pres-caption)] text-teal"
              aria-hidden
            >
              {index + 1}
            </span>
            <span className="font-display text-[length:var(--pres-body)] font-semibold leading-tight text-ink">
              {step.label}
            </span>
            {step.note ? (
              <span className="max-w-[22ch] text-pretty text-[length:var(--pres-caption)] leading-snug text-slate">
                {step.note}
              </span>
            ) : null}
          </motion.li>
        ))}
      </motion.ol>
    </PatternFrame>
  );
}

/**
 * Strength → consequence, as paired rows.
 *
 * The relationship is the point, so the arrow sits between two typed halves
 * rather than the pair being a sentence. Each row takes one DISC accent as a
 * hairline; four accents on four rows is an identifier set, not a rainbow.
 */
function RelationshipsVisual({ slide, reduced }: SlideVisualProps) {
  const t = slideTransition(reduced);
  const pairs = slide.strengthShadows ?? [];
  const accents: DisplayDimension[] = ["D", "I", "S", "A"];
  return (
    <PatternFrame>
      <PatternHead slide={slide} reduced={reduced} />
      <motion.ul
        variants={staggerContainer(reduced, 0.09)}
        initial="hidden"
        animate="visible"
        className="flex w-full max-w-[86cqw] flex-col gap-[calc(var(--pres-gap)*0.6)]"
      >
        {pairs.map((pair, index) => (
          <motion.li
            key={pair.strength}
            variants={t.variants}
            transition={t.transition}
            className="paper-card grid grid-cols-[1fr_auto_1.25fr] items-center gap-[var(--pres-gap)] px-[calc(var(--pres-pad)*0.45)] py-[calc(var(--pres-pad)*0.3)]"
          >
            <span className="flex items-center gap-[calc(var(--pres-gap)*0.4)]">
              <span
                aria-hidden
                className="h-[1.6em] w-1 shrink-0 rounded-full"
                style={{ background: DISC_COLOR[accents[index % 4]!] }}
              />
              <span className="font-display text-[length:var(--pres-body)] font-semibold leading-tight text-ink">
                {pair.strength}
              </span>
            </span>
            <span aria-hidden className="text-[length:var(--pres-body)] text-faint">
              →
            </span>
            <span className="text-pretty text-[length:var(--pres-caption)] leading-snug text-slate">
              {pair.shadow}
            </span>
          </motion.li>
        ))}
      </motion.ul>
    </PatternFrame>
  );
}

/** A modular grid of short titled results — the report, previewed. */
function ModulesVisual({ slide, reduced }: SlideVisualProps) {
  const t = slideTransition(reduced);
  const modules = slide.steps ?? [];
  return (
    <PatternFrame>
      <PatternHead slide={slide} reduced={reduced} />
      <motion.ul
        variants={staggerContainer(reduced, 0.07)}
        initial="hidden"
        animate="visible"
        className="grid w-full max-w-[88cqw] gap-[calc(var(--pres-gap)*0.7)] sm:grid-cols-2 lg:grid-cols-3"
      >
        {modules.map((module) => (
          <motion.li
            key={module.label}
            variants={t.variants}
            transition={t.transition}
            className="paper-card flex flex-col gap-[calc(var(--pres-gap)*0.3)] px-[calc(var(--pres-pad)*0.38)] py-[calc(var(--pres-pad)*0.34)]"
          >
            <span aria-hidden className="h-1 w-8 rounded-full bg-teal" />
            <span className="text-balance font-display text-[length:var(--pres-body)] font-semibold leading-tight text-ink">
              {module.label}
            </span>
            {module.note ? (
              <span className="text-pretty text-[length:var(--pres-caption)] leading-snug text-slate">
                {module.note}
              </span>
            ) : null}
          </motion.li>
        ))}
      </motion.ul>
    </PatternFrame>
  );
}

/**
 * Numbered instructions as distinct rows.
 *
 * MOST and LEAST are the only words on this slide a participant has to carry
 * into the assessment, so they are set apart rather than left inside a
 * sentence.
 */
function NumberedVisual({ slide, reduced }: SlideVisualProps) {
  const t = slideTransition(reduced);
  const lines = slide.instructions ?? [];
  return (
    <PatternFrame>
      <PatternHead slide={slide} reduced={reduced} />
      <motion.ol
        variants={staggerContainer(reduced, 0.09)}
        initial="hidden"
        animate="visible"
        className="flex w-full max-w-[74cqw] flex-col gap-[calc(var(--pres-gap)*0.55)]"
      >
        {lines.map((line, index) => (
          <motion.li
            key={line}
            variants={t.variants}
            transition={t.transition}
            className="flex items-start gap-[var(--pres-gap)] rule-t pt-[calc(var(--pres-gap)*0.55)] first:border-t-0 first:pt-0"
          >
            <span
              aria-hidden
              className="font-mono text-[length:var(--pres-body)] leading-none text-sage"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-pretty text-[length:var(--pres-body)] leading-snug text-ink">
              {line.split(/\b(MOST|LEAST)\b/).map((part, partIndex) =>
                part === "MOST" || part === "LEAST" ? (
                  <strong
                    key={partIndex}
                    className="font-mono font-semibold tracking-[0.06em] text-botanical"
                  >
                    {part}
                  </strong>
                ) : (
                  <span key={partIndex}>{part}</span>
                ),
              )}
            </span>
          </motion.li>
        ))}
      </motion.ol>
    </PatternFrame>
  );
}

/**
 * Two privacy zones and the standing scope line.
 *
 * The zones are visually separate because the promises are different: what a
 * participant gets, and what a team sees. The footnote states what the
 * instrument is not — it is a scope statement, not a legal claim.
 */
function TrustVisual({ slide, reduced }: SlideVisualProps) {
  const t = slideTransition(reduced);
  const zones = slide.columns ?? [];
  return (
    <PatternFrame>
      <PatternHead slide={slide} reduced={reduced} />
      <motion.div
        variants={staggerContainer(reduced, 0.1)}
        initial="hidden"
        animate="visible"
        className="grid w-full max-w-[84cqw] gap-[var(--pres-gap)] sm:grid-cols-2"
      >
        {zones.map((zone) => {
          const accent = ACCENT[zone.accent ?? "teal"] ?? "var(--color-teal)";
          return (
            <motion.div
              key={zone.heading}
              variants={t.variants}
              transition={t.transition}
              className="paper-card flex flex-col gap-[calc(var(--pres-gap)*0.45)] px-[calc(var(--pres-pad)*0.42)] py-[calc(var(--pres-pad)*0.38)]"
            >
              <span
                className="font-mono text-[length:var(--pres-caption)] uppercase tracking-[0.2em]"
                style={{ color: accent }}
              >
                {zone.heading}
              </span>
              <ul className="flex flex-col gap-[calc(var(--pres-gap)*0.35)]">
                {zone.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-[calc(var(--pres-gap)*0.4)] text-pretty text-[length:var(--pres-caption)] leading-snug text-ink"
                  >
                    <span
                      aria-hidden
                      className="mt-[0.55em] size-[0.4em] shrink-0 rounded-full"
                      style={{ background: accent }}
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </motion.div>
      {slide.footnote ? (
        <p className="max-w-[70ch] text-center text-[length:var(--pres-caption)] leading-snug text-faint">
          {slide.footnote}
        </p>
      ) : null}
    </PatternFrame>
  );
}

/* ── dispatch ─────────────────────────────────────────────────────────── */

export function SlideVisual(props: SlideVisualProps) {
  switch (props.slide.visualType) {
    // The opening slide is an image with nothing around it, so it does not use
    // the shared slide Frame at all — the player and the live follower render
    // OvertureSlide directly. This case exists so the switch stays exhaustive
    // and a `wheel` slide reaching an unexpected surface renders the image
    // rather than a blank canvas.
    case "wheel":
      return <OvertureSlide alt={OVERTURE_ALT} priority={false} />;
    case "statement":
      return <StatementVisual {...props} />;
    case "journey":
      return <JourneyVisual {...props} />;
    case "relationships":
      return <RelationshipsVisual {...props} />;
    case "modules":
      return <ModulesVisual {...props} />;
    case "numbered":
      return <NumberedVisual {...props} />;
    case "trust":
      return <TrustVisual {...props} />;
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
    case "compass":
      return <CompassSlide {...props} />;
    case "ripple":
      return <RippleSlide {...props} />;
    case "cycle":
      return <CycleSlide {...props} />;
    case "recoveryCurve":
      return <RecoveryCurveSlide {...props} />;
  }
}
