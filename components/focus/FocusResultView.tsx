"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { FocusLens } from "@/components/visualisations/focus/FocusLens";
import { deriveDistractionFactors } from "@/lib/visuals/focus-factors";
import type { FocusScores } from "@/lib/scoring/focus";
import {
  ENERGY_LABELS,
  FOCUS_DIMENSION_META,
  FOCUS_PATTERNS,
  LOOP_LABELS,
  NOTIFICATION_LABELS,
  RESET_LABELS,
} from "@/data/focus-insights";
import type {
  EnergyKey,
  FocusPatternCode,
  LoopKey,
  NotifKey,
  ResetKey,
} from "@/lib/scoring/focus";

export interface FocusResultData {
  scores: FocusScores;
  patternCode: FocusPatternCode;
  primaryLoop: LoopKey;
  notificationPattern: NotifKey;
  energyPattern: EnergyKey;
  preferredReset: ResetKey;
}

interface FocusResultViewProps {
  data: FocusResultData;
  /** Presentation mode: larger type, deck-friendly spacing. */
  presentation?: boolean;
  /** The combined view renders the Fusion map instead, so it hides the lens. */
  showLens?: boolean;
}

/**
 * The Focus Pulse result — used by both the individual result page and
 * presentation mode. Non-clinical throughout: an attention pattern, not a
 * diagnosis. Charts are bold and readable at projector scale.
 */
export function FocusResultView({ data, presentation = false, showLens = true }: FocusResultViewProps) {
  const pattern = FOCUS_PATTERNS[data.patternCode];

  return (
    <div className={cn("flex flex-col", presentation ? "gap-10" : "gap-8")}>
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal">
          Your attention pattern
        </span>
        <h1
          className={cn(
            "font-display font-semibold text-balance text-ink",
            presentation ? "text-[length:var(--text-display)] leading-[1.02]" : "text-h1",
          )}
        >
          {pattern.name}
        </h1>
        <p className={cn("max-w-2xl leading-relaxed text-slate", presentation ? "text-lead" : "text-base")}>
          {pattern.summary}
        </p>
      </header>

      {/* Focus Lens hero — the field of attention; meters below stay as the
          quantitative comparison view */}
      {showLens ? (
      <FocusLens
        scores={data.scores}
        factors={deriveDistractionFactors({
          scores: data.scores,
          primaryLoop: data.primaryLoop,
          notificationPattern: data.notificationPattern,
        })}
        className={cn("mx-auto", presentation ? "max-w-[min(58vh,720px)]" : "max-w-[520px]")}
      />
      ) : null}

      <FocusMeters scores={data.scores} presentation={presentation} />

      <section
        className={cn("grid gap-4", presentation ? "sm:grid-cols-3" : "sm:grid-cols-3")}
        aria-label="Attention descriptors"
      >
        <Descriptor label="Top distraction loop" value={LOOP_LABELS[data.primaryLoop]} />
        <Descriptor label="Notification response" value={NOTIFICATION_LABELS[data.notificationPattern]} />
        <Descriptor label="Energy pattern" value={ENERGY_LABELS[data.energyPattern]} />
        <Descriptor label="Preferred focus reset" value={RESET_LABELS[data.preferredReset]} />
      </section>

      <section className="flex flex-col gap-4" aria-label="Recommendations">
        <h2 className={cn("font-display font-semibold text-ink", presentation ? "text-h2" : "text-h3")}>
          Three things to try
        </h2>
        <ol className="flex flex-col gap-3">
          {pattern.recommendations.map((rec, index) => (
            <li key={rec} className="flex items-start gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-botanical font-display text-sm font-semibold text-mineral">
                {index + 1}
              </span>
              <span className={cn("pt-0.5 leading-snug text-ink", presentation ? "text-lg" : "text-base")}>
                {rec}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-xs leading-relaxed text-faint">
        The Focus Pulse describes attention patterns and habits. It is not a
        medical or clinical measure and is not a diagnosis.
      </p>
    </div>
  );
}

function FocusMeters({ scores, presentation }: { scores: FocusScores; presentation: boolean }) {
  const reduced = useReducedMotion();
  return (
    <section
      className={cn("grid gap-x-8 gap-y-5", presentation ? "sm:grid-cols-2" : "sm:grid-cols-2")}
      aria-label="Focus dimensions"
    >
      {FOCUS_DIMENSION_META.map((meta) => {
        const value = scores[meta.key];
        return (
          <div key={meta.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className={cn("font-medium text-ink", presentation ? "text-lg" : "text-sm")}>
                {meta.label}
              </span>
              <span className="font-mono text-sm tabular-nums text-slate">{value}</span>
            </div>
            <div className={cn("overflow-hidden rounded-full bg-ink/8", presentation ? "h-4" : "h-2.5")}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: meta.color }}
                initial={reduced ? false : { width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: reduced ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="text-xs leading-snug text-faint">{meta.description}</span>
          </div>
        );
      })}
    </section>
  );
}

function Descriptor({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-hairline bg-paper p-5">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">{label}</span>
      <span className="font-display text-lg font-semibold leading-snug text-ink">{value}</span>
    </div>
  );
}
