import type { InstrumentMetadata } from "../../data/wellbeing-instruments.ts";

/**
 * Evidence-first management signals.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT A SIGNAL IS, AND WHAT IT REFUSES TO BE.
 *
 * A signal is an aggregate PATTERN worth a conversation, stated in four parts:
 * what was observed, the figures behind it, what the pattern does and does not
 * establish, and what a facilitator might reasonably look into. Every figure
 * comes from this module's arithmetic. Nothing here is generated prose, and
 * nothing here is inferred by a model.
 *
 * It is not a diagnosis, not a cause, and never about a person. The hard part
 * of this file is not detecting patterns — it is the discipline of describing
 * them without sliding into explanation. "Recovery & Demand has remained lower
 * across three waves" is an observation. "Workload is damaging recovery" is a
 * claim this product has no basis to make, and the language rules below exist
 * so that a future edit cannot quietly introduce one.
 *
 * WHY IT IS RANKED, AND HOW.
 *
 * Showing every detectable pattern is the same as showing none: a reader
 * cannot tell which of fifteen cards matters. Ranking is therefore by
 * DETERMINISTIC EVIDENCE STRENGTH — how many waves a pattern persisted, how
 * far a figure moved, how much of the workforce it covers, and how reliable
 * the participation behind it is. It is a statement about the evidence, never
 * about the people: no cohort is "worse", nothing is "high risk", and no
 * ordering of humans is produced anywhere in this module.
 *
 * WHY GHQ IS TREATED MORE CAUTIOUSLY.
 *
 * GHQ-12 and GHQ-28 are screening instruments whose scores run in the
 * direction of distress. A confidently-worded pattern about a screening score
 * reads as a clinical claim however carefully the surrounding page is written,
 * so signals for those instruments carry a plainer, flatter register and never
 * characterise a group's state at all.
 * ─────────────────────────────────────────────────────────────────────
 */

/** How strongly the evidence supports treating a pattern as real. */
export type SignalPriority = "priority" | "emerging" | "stable";

export const SIGNAL_PRIORITY_LABEL: Record<SignalPriority, string> = {
  priority: "Priority pattern",
  emerging: "Emerging pattern",
  stable: "Stable pattern",
};

export interface WellbeingSignal {
  key: string;
  priority: SignalPriority;
  /** What was seen. A description, never an explanation. */
  observation: string;
  /** The figures behind it, written by this module and by nothing else. */
  evidence: string;
  /** What the pattern does and does not establish. */
  mayMean: string;
  /** Where a facilitator might reasonably look. Never a prescription. */
  considerExploring: string;
  /**
   * Deterministic score used only for ordering. Never displayed: a number
   * beside a wellbeing pattern invites it to be read as a severity.
   */
  weight: number;
}

/* ── inputs ─────────────────────────────────────────────────────────── */

export interface WaveFigure {
  label: string;
  median: number;
  /** Distinct people in the wave. */
  participants: number;
  /** Share at or above threshold, where the instrument has one. */
  thresholdShare: number | null;
  /** Interquartile-style spread: the width covering the middle of the cohort. */
  spread: number;
}

export interface DimensionWave {
  key: string;
  label: string;
  /** Median per wave, oldest first. */
  medians: number[];
}

export interface CohortFigure {
  label: string;
  participants: number;
  median: number;
  /** Movement against this cohort's own previous wave, where known. */
  delta: number | null;
}

export interface SignalInput {
  instrument: InstrumentMetadata;
  /** Oldest first. Suppressed waves are already absent. */
  waves: WaveFigure[];
  /** Empty for instruments without dimensions or subscales. */
  dimensions: DimensionWave[];
  /** Already suppression-filtered. Empty when nothing may be published. */
  cohorts: CohortFigure[];
  /** What the cohorts are grouped by, for the observation text. */
  cohortLabel: string;
}

/* ── language ───────────────────────────────────────────────────────── */

/**
 * Words a signal may never contain.
 *
 * Screened by test rather than by review. Several of these read as harmless in
 * isolation — "risk", "concerning" — and that is exactly why they are listed:
 * they arrive one careful edit at a time.
 */
export const FORBIDDEN_SIGNAL_TERMS = [
  "diagnos",
  "caused",
  "causing",
  "because of",
  "due to",
  "risk",
  "unhealthy",
  "depressed",
  "depression",
  "anxiety disorder",
  "burnout",
  "suffering",
  "concerning",
  "alarming",
  "poor performer",
  "underperform",
  "worst",
  "best team",
  "struggling",
] as const;

/** Direction wording that never implies a value judgement. */
function movementWord(delta: number, higherIsBetter: boolean): string {
  if (delta === 0) return "unchanged";
  const higher = delta > 0;
  // For a distress scale a higher number is not "an improvement", so the
  // wording stays strictly directional for every instrument.
  void higherIsBetter;
  return higher ? "higher" : "lower";
}

function series(values: number[]): string {
  return values.map((value) => String(Math.round(value * 10) / 10)).join(" → ");
}

/* ── detection ──────────────────────────────────────────────────────── */

const PERSISTENCE_WAVES = 3;

/**
 * Builds the signal set.
 *
 * Pure: takes already-authorised, already-suppressed figures and returns
 * descriptions. It performs no I/O, so it cannot reach a participant row even
 * by accident, and it can be tested exhaustively.
 */
export function buildWellbeingSignals(input: SignalInput): WellbeingSignal[] {
  const { instrument, waves, dimensions, cohorts, cohortLabel } = input;
  const signals: WellbeingSignal[] = [];
  const isScreening = instrument.key === "ghq12" || instrument.key === "ghq28";
  const higherIsBetter = instrument.scoreDirection !== "higher_is_more_distress";

  /* A dimension that has stayed lower than the others across several waves. */
  if (dimensions.length > 1 && waves.length >= PERSISTENCE_WAVES) {
    const recent = dimensions
      .map((dimension) => ({
        dimension,
        medians: dimension.medians.slice(-PERSISTENCE_WAVES),
      }))
      .filter((entry) => entry.medians.length === PERSISTENCE_WAVES);

    if (recent.length > 1) {
      const averages = recent.map((entry) => ({
        entry,
        average: entry.medians.reduce((sum, value) => sum + value, 0) / entry.medians.length,
      }));
      averages.sort((a, b) => a.average - b.average);
      const lowest = averages[0]!;
      const next = averages[1]!;
      const gap = next.average - lowest.average;

      // Only worth naming when it is genuinely separated from the rest, not
      // when six dimensions sit within a point of each other.
      if (gap >= 3) {
        signals.push({
          key: `dimension-persistent-${lowest.entry.dimension.key}`,
          priority: gap >= 6 ? "priority" : "emerging",
          observation: `${lowest.entry.dimension.label} has remained lower than the other dimensions across ${PERSISTENCE_WAVES} waves.`,
          evidence: `Median ${series(lowest.entry.medians)}, against ${Math.round(next.average)} for the next lowest dimension.`,
          mayMean:
            "The pattern is persistent rather than a single-wave fluctuation. It describes what a group reported, not why they reported it.",
          considerExploring:
            "Whether anything in how this area of work is structured is worth discussing with the people doing it.",
          weight: gap * 10 + PERSISTENCE_WAVES,
        });
      }
    }
  }

  /* The middle of the cohort spreading out between waves. */
  if (waves.length >= 2) {
    const previous = waves[waves.length - 2]!;
    const latest = waves[waves.length - 1]!;
    const widening = latest.spread - previous.spread;
    if (widening >= 4) {
      signals.push({
        key: "distribution-widening",
        priority: widening >= 8 ? "priority" : "emerging",
        observation: "Responses are more spread out this wave than last.",
        evidence: `The middle of the cohort covers ${Math.round(latest.spread)} points, against ${Math.round(previous.spread)} in ${previous.label}.`,
        mayMean:
          "A single median can stay steady while experiences diverge underneath it. A wider spread means people are reporting less similar experiences than before.",
        considerExploring:
          "Whether particular groups account for the wider spread, where cohort sizes allow that to be reported.",
        weight: widening * 6,
      });
    }
  }

  /* Participation falling away, which makes every other figure less reliable. */
  if (waves.length >= 2) {
    const previous = waves[waves.length - 2]!;
    const latest = waves[waves.length - 1]!;
    if (previous.participants > 0) {
      const drop = ((previous.participants - latest.participants) / previous.participants) * 100;
      if (drop >= 20) {
        signals.push({
          key: "participation-drop",
          priority: drop >= 40 ? "priority" : "emerging",
          observation: "Fewer people completed this wave than the previous one.",
          evidence: `${latest.participants} participants in ${latest.label}, against ${previous.participants} in ${previous.label}.`,
          mayMean:
            "Every other figure on this page rests on who answered. A smaller wave is less representative, and a change between waves may reflect who responded as much as what they reported.",
          considerExploring:
            "How and when the invitation reached people, and whether anything made taking part harder this time.",
          // Participation reliability is weighted heavily: it qualifies
          // everything else, so a reader should meet it first.
          weight: drop * 8,
        });
      }
    }
  }

  /* Two cohorts sitting apart from each other in the same wave. */
  if (cohorts.length >= 2) {
    const sorted = [...cohorts].sort((a, b) => a.median - b.median);
    const lowest = sorted[0]!;
    const highest = sorted[sorted.length - 1]!;
    const gap = highest.median - lowest.median;
    if (gap >= 5) {
      const covered = lowest.participants + highest.participants;
      signals.push({
        key: `cohort-divergence-${lowest.label}`,
        priority: gap >= 10 ? "priority" : "emerging",
        observation: `${lowest.label} recorded a lower median than ${highest.label} this wave.`,
        evidence: `Median ${lowest.median} (n = ${lowest.participants}) against ${highest.median} (n = ${highest.participants}), by ${cohortLabel.toLowerCase()}.`,
        mayMean:
          "The two groups reported differently. Groups differ in size, role and circumstance, and a difference between them is a starting point for a conversation rather than a conclusion about either.",
        considerExploring:
          "What differs in the day-to-day experience of these two groups, asked of the groups themselves.",
        weight: gap * 5 + covered,
      });
    }
  }

  /* Threshold prevalence, stated flatly and only where it is comparable. */
  if (instrument.hasThreshold && waves.length >= 2) {
    const previous = waves[waves.length - 2]!;
    const latest = waves[waves.length - 1]!;
    if (previous.thresholdShare !== null && latest.thresholdShare !== null) {
      const delta = latest.thresholdShare - previous.thresholdShare;
      if (Math.abs(delta) >= 5) {
        signals.push({
          key: "threshold-prevalence",
          priority: Math.abs(delta) >= 12 ? "priority" : "emerging",
          observation: `The share of responses at or above the configured threshold is ${movementWord(delta, higherIsBetter)} than the previous wave.`,
          evidence: `${latest.thresholdShare}% in ${latest.label}, against ${previous.thresholdShare}% in ${previous.label}.`,
          mayMean:
            "The threshold indicates where a fuller conversation may be warranted. It is a screening cut-off applied to a group total, and it describes no individual and establishes nothing about anyone's health.",
          considerExploring:
            "Whether the support routes available to people are known, reachable and used.",
          weight: Math.abs(delta) * 6,
        });
      }
    }
  }

  /* Genuine stability is itself worth reporting. */
  if (waves.length >= PERSISTENCE_WAVES && signals.length === 0) {
    const medians = waves.slice(-PERSISTENCE_WAVES).map((wave) => wave.median);
    const range = Math.max(...medians) - Math.min(...medians);
    if (range <= 2) {
      signals.push({
        key: "stable",
        priority: "stable",
        observation: `The median has stayed within ${Math.round(range)} points across ${PERSISTENCE_WAVES} waves.`,
        evidence: `Median ${series(medians)}.`,
        mayMean:
          "No movement worth investigating has appeared in the headline figure over this period.",
        considerExploring:
          "Whether the groups underneath the organisation-wide figure are equally steady, where cohort sizes allow that to be reported.",
        weight: 1,
      });
    }
  }

  // Screening instruments get the same patterns with a flatter register: the
  // interpretive sentence is replaced by a plainer one that characterises the
  // figures and nothing else.
  const finished = isScreening
    ? signals.map((signal) => ({
        ...signal,
        mayMean:
          "This describes the pattern of responses to a screening questionnaire across a group. It is not a clinical finding, it does not describe any individual, and it establishes nothing about anyone's health.",
      }))
    : signals;

  return finished.sort((a, b) => b.weight - a.weight);
}
