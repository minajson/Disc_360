"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { preset, slideTransition, staggerContainer } from "@/lib/presentations/motion";
import { smoothPath, wrapLabel, type Point } from "@/lib/visuals/geometry";
import { BehaviourCompass } from "@/components/visualisations/disc/BehaviourCompass";
import { AttentionRippleMap } from "@/components/visualisations/focus/AttentionRippleMap";
import { FocusCycle } from "@/components/visualisations/focus/FocusCycle";
import { RecoveryCurve } from "@/components/visualisations/focus/RecoveryCurve";
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
