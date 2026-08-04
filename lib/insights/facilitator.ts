import {
  DIMENSION_KEY,
  DIMENSIONS,
  type Dimension,
  type DiscScores,
} from "../types/index.ts";
import { dimensionMeta } from "../../data/dimension-meta.ts";
import {
  HIGH_BAND,
  balanceVerdict,
  behaviourDistribution,
  decisionStyle,
  rankDimensions,
  strengthDistribution,
  type BoardProfile,
} from "./board.ts";

/**
 * Facilitator insight categories — the evidence layer beneath AI Insights.
 *
 * Everything numeric on an insight card is computed here: the metrics, the
 * sample size, the signal strength and the fallback narrative. The model (when
 * configured) rewrites only the prose around these numbers, so a card can
 * never display a figure that was invented rather than measured.
 *
 * Register rules, enforced by tests:
 *  · observation and interpretation are separate fields, never merged;
 *  · no diagnosis, no clinical or medical language;
 *  · no judgement words about people (good/bad/weak/difficult/poor);
 *  · no individual is ever named as a cause of friction;
 *  · small samples say so instead of asserting a pattern;
 *  · nothing claims causation.
 */

export type SignalStrength = "strong" | "moderate" | "emerging" | "insufficient";

export const SIGNAL_LABEL: Record<SignalStrength, string> = {
  strong: "Strong data signal",
  moderate: "Moderate signal",
  emerging: "Emerging pattern",
  insufficient: "Too little data",
};

/**
 * Below this many completed profiles a group gets no interpretation at all.
 * Also the department-level privacy suppression threshold.
 */
export const MIN_GROUP_SIZE = 3;

/** Sample sizes at which a pattern earns each label. */
export const SIGNAL_THRESHOLDS = { strong: 20, moderate: 8, emerging: MIN_GROUP_SIZE } as const;

/**
 * Smallest gap between two averages that is reported as a difference.
 *
 * Below this the cards say the group is balanced rather than naming a lead.
 * Without it, a perfectly even cohort still produced a "Dominant–Influence
 * pattern" — an artefact of the D→I→S→C tie-break, not a finding — and
 * different cards could disagree about which style led. Ranking is only
 * meaningful once the ranks are separated by something.
 */
export const MIN_MEANINGFUL_GAP = 5;

/** True when two averages are far enough apart to be called different. */
export function separated(higher: number, lower: number): boolean {
  return higher - lower >= MIN_MEANINGFUL_GAP;
}

export type InsightCategory =
  | "snapshot"
  | "communication"
  | "decision"
  | "collaboration"
  | "change"
  | "leadership"
  | "conflict"
  | "inclusion";

export const CATEGORY_TITLE: Record<InsightCategory, string> = {
  snapshot: "Team snapshot",
  communication: "Communication dynamics",
  decision: "Decision-making style",
  collaboration: "Collaboration patterns",
  change: "Change readiness",
  leadership: "Leadership climate",
  conflict: "Conflict signals",
  inclusion: "Inclusion and voice balance",
};

/**
 * The heading every `interpretation` list is rendered under, without
 * exception. The hedge lives here rather than being repeated on each line, so
 * a reader can never encounter an interpretation presented as a finding — and
 * the tests can enforce that structurally instead of by inspecting prose.
 */
export const INTERPRETATION_HEADING = "What this may mean";

export interface EvidenceChip {
  label: string;
  value: string;
}

export interface FacilitatorInsight {
  category: InsightCategory;
  title: string;
  /** What the data shows. Descriptive only — no interpretation. */
  observation: string;
  /** What it may mean. Always hedged; never asserted as fact. */
  interpretation: string[];
  /** Questions a facilitator can put to the room. */
  questions: string[];
  evidence: EvidenceChip[];
  signal: SignalStrength;
  /** Completed profiles the card is computed from. */
  sampleSize: number;
  /** Profiles invited in the same scope, for a coverage read. */
  populationSize: number;
}

export interface FacilitatorScope {
  /** Team, department or organisation label the insight belongs to. */
  label: string;
  /** Whether the numbers describe one person, a group, or an organisation. */
  basis: "individual" | "group" | "organization";
  /** ISO date the underlying results were read. */
  generatedAt: string;
}

export interface FacilitatorInsightSet {
  scope: FacilitatorScope;
  insights: FacilitatorInsight[];
  /** Present when the scope is too small to interpret at all. */
  suppressed: string | null;
}

/* ── signal ─────────────────────────────────────────────────────────── */

export function signalFor(sampleSize: number): SignalStrength {
  if (sampleSize >= SIGNAL_THRESHOLDS.strong) return "strong";
  if (sampleSize >= SIGNAL_THRESHOLDS.moderate) return "moderate";
  if (sampleSize >= SIGNAL_THRESHOLDS.emerging) return "emerging";
  return "insufficient";
}

/* ── shared helpers ─────────────────────────────────────────────────── */

function averages(profiles: readonly BoardProfile[]): DiscScores {
  if (profiles.length === 0) return { d: 0, i: 0, s: 0, c: 0 };
  const totals: DiscScores = { d: 0, i: 0, s: 0, c: 0 };
  for (const profile of profiles) {
    for (const dim of DIMENSIONS) {
      totals[DIMENSION_KEY[dim]] += profile.scores[DIMENSION_KEY[dim]];
    }
  }
  return {
    d: Math.round(totals.d / profiles.length),
    i: Math.round(totals.i / profiles.length),
    s: Math.round(totals.s / profiles.length),
    c: Math.round(totals.c / profiles.length),
  };
}

function averageChips(mean: DiscScores): EvidenceChip[] {
  return DIMENSIONS.map((dim) => ({
    label: `${dimensionMeta[dim].displayCode} average`,
    value: String(mean[DIMENSION_KEY[dim]]),
  }));
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

const pair = (a: Dimension, b: Dimension) =>
  `${dimensionMeta[a].label}–${dimensionMeta[b].label}`;

/* ── categories ─────────────────────────────────────────────────────── */

function snapshot(profiles: readonly BoardProfile[], mean: DiscScores): FacilitatorInsight {
  const ranked = rankDimensions(mean);
  const lead = ranked[0]!;
  const second = ranked[1]!;
  const weakest = ranked[3]!;
  const balance = balanceVerdict(mean);
  const spread = 100 - balance.index;

  // Nothing leads unless it is separated from the rest by a real margin.
  const hasLead = separated(mean[DIMENSION_KEY[lead]], mean[DIMENSION_KEY[weakest]]);
  const observation = `Across ${plural(profiles.length, "completed profile")}, ${DIMENSIONS.map(
    (dim) => `${dimensionMeta[dim].label} averages ${mean[DIMENSION_KEY[dim]]}`,
  ).join(", ")}. The four averages span ${spread} points.`;

  if (!hasLead) {
    return {
      category: "snapshot",
      title: "An evenly balanced pattern",
      observation,
      interpretation: [
        `the four styles sit within ${spread} points of each other, so no single preference sets the tone`,
        "most situations should find someone who works that way naturally",
        "the risk of an even spread is dilution rather than blind spots — ownership of each mode may need to be named rather than assumed",
      ],
      questions: [
        "If no style dominates, who owns each mode when it is needed?",
        "Where has our range helped, and where has it left a decision without an obvious owner?",
      ],
      evidence: [...averageChips(mean), { label: "Balance index", value: String(balance.index) }],
      signal: signalFor(profiles.length),
      sampleSize: profiles.length,
      populationSize: profiles.length,
    };
  }

  const secondCounts = separated(mean[DIMENSION_KEY[second]], mean[DIMENSION_KEY[weakest]]);
  return {
    category: "snapshot",
    title: secondCounts ? `A ${pair(lead, second)} pattern` : `A ${dimensionMeta[lead].label}-led pattern`,
    observation,
    interpretation: [
      `a preference for ${lead === "C" || lead === "S" ? "structure and considered decision-making" : "pace and forward motion"}`,
      `${dimensionMeta[lead].essence.replace(/\.$/, "").toLowerCase()} is likely to feel normal here`,
      `situations calling for ${dimensionMeta[weakest].label.toLowerCase()} behaviour may need that voice invited rather than assumed`,
    ],
    questions: [
      "Where does this pattern serve us well?",
      "Where does it cost us, and what does that cost look like in practice?",
    ],
    evidence: [...averageChips(mean), { label: "Balance index", value: String(balance.index) }],
    signal: signalFor(profiles.length),
    sampleSize: profiles.length,
    populationSize: profiles.length,
  };
}

function communication(profiles: readonly BoardProfile[], mean: DiscScores): FacilitatorInsight {
  const distribution = behaviourDistribution(profiles);
  const ranked = [...distribution].sort((a, b) => b.count - a.count);
  const top = ranked[0]!;
  const bands = strengthDistribution(profiles);
  const band = (dim: Dimension) => bands.find((entry) => entry.dimension === dim)!;
  // Halved because each side is a sum of two averages, not one.
  const paceGap = (mean.d + mean.i - (mean.s + mean.c)) / 2;
  const paceCalled = Math.abs(paceGap) >= MIN_MEANINGFUL_GAP;
  const paceLed = paceGap > 0;

  const interpretation = [
    !paceCalled
      ? "no clear pace preference — fast and reflective communicators are present in similar measure, so pace has to be set explicitly rather than assumed"
      : paceLed
        ? "a faster conversational pace, with headline-first messages and less patience for preamble"
        : "a more reflective pace, with processing time expected before commitment",
    top.share >= 50
      ? `${top.share}% share one preferred style, so messages framed that way will land and others may not`
      : "no single communication preference dominates, so framing has to be chosen per audience rather than by default",
  ];

  if (band("D").count >= 2 && band("S").count >= 2) {
    interpretation.push(
      "directness and deliberateness are both well represented — the same message can read as decisive to one group and abrupt to another",
    );
  }
  if (band("I").count >= 2 && band("C").count >= 2) {
    interpretation.push(
      "expressive and evidence-first preferences are both present — enthusiasm may read as insufficiently supported, and scrutiny as discouraging",
    );
  }

  return {
    category: "communication",
    title: !paceCalled
      ? "Mixed communication preferences"
      : paceLed
        ? "Direct and fast-moving"
        : "Considered and evidence-first",
    observation: `${plural(top.count, "participant")} (${top.share}%) lead with ${dimensionMeta[top.dimension].label}. ${plural(band("D").count, "participant")} run Dominant at or above ${HIGH_BAND}, and ${plural(band("C").count, "participant")} run Analytical at or above ${HIGH_BAND}.`,
    interpretation,
    questions: [
      "How do we prefer to receive difficult information — in the room, or in writing beforehand?",
      "Where have messages recently been misread, and what framing would have helped?",
    ],
    evidence: [
      { label: "Leading style", value: `${dimensionMeta[top.dimension].label} ${top.share}%` },
      { label: `High ${dimensionMeta.D.displayCode}`, value: String(band("D").count) },
      { label: `High ${dimensionMeta.C.displayCode}`, value: String(band("C").count) },
      { label: "Pace balance", value: `${mean.d + mean.i} vs ${mean.s + mean.c}` },
    ],
    signal: signalFor(profiles.length),
    sampleSize: profiles.length,
    populationSize: profiles.length,
  };
}

function decision(profiles: readonly BoardProfile[], mean: DiscScores): FacilitatorInsight {
  const style = decisionStyle(mean);
  const bands = strengthDistribution(profiles);
  const evidenceLed = mean.c >= mean.i;

  return {
    category: "decision",
    title: `Decisions read as ${style.label.toLowerCase()}`,
    observation: `Action bias (Dominant and Influence averaged) sits at ${style.actionBias}; deliberation (Stable and Analytical averaged) sits at ${style.deliberation}. The gap is ${Math.abs(style.tilt)} points.`,
    interpretation: [
      style.tilt > 10
        ? "decisions are likely to be reached quickly, with verification arriving after commitment rather than before"
        : style.tilt < -10
          ? "decisions are likely to be well evidenced, and may take longer to reach than the calendar allows"
          : "speed and verification appear to be in working tension, which is generally the productive setting",
      evidenceLed
        ? "evidence is likely to carry more weight than instinct in this group"
        : "instinct and momentum are likely to carry more weight than documentation in this group",
      bands.find((band) => band.dimension === "D")!.count <= 1
        ? "with few participants running Dominant at strength, deadlock-breaking may need to be assigned rather than expected to emerge"
        : "with Dominant well represented, the risk is a decision landing before quieter objections are voiced",
    ],
    questions: [
      "What is our default when the evidence is incomplete and the deadline is real?",
      "Who breaks a tie here, and does everyone know that?",
    ],
    evidence: [
      { label: "Action bias", value: String(style.actionBias) },
      { label: "Deliberation", value: String(style.deliberation) },
      { label: "Tilt", value: `${style.tilt > 0 ? "+" : ""}${style.tilt}` },
    ],
    signal: signalFor(profiles.length),
    sampleSize: profiles.length,
    populationSize: profiles.length,
  };
}

function collaboration(profiles: readonly BoardProfile[], mean: DiscScores): FacilitatorInsight {
  const people = mean.i + mean.s;
  const task = mean.d + mean.c;
  const distribution = behaviourDistribution(profiles);
  const missing = distribution.filter((slice) => slice.count === 0);
  const top = [...distribution].sort((a, b) => b.count - a.count)[0]!;

  // Both sides are sums of two averages, so the margin is doubled to match.
  const orientationGap = people - task;
  const orientationCalled = Math.abs(orientationGap) >= MIN_MEANINGFUL_GAP * 2;

  const interpretation = [
    !orientationCalled
      ? "task focus and people focus appear balanced, so neither is likely to be sacrificed for the other by default"
      : orientationGap > 0
        ? "relationship and continuity are likely to be protected, sometimes ahead of the task"
        : "the task is likely to be protected, sometimes ahead of the relationship",
    top.share >= 50
      ? `a concentration of one style (${top.share}%) tends to produce fast agreement and shared blind spots`
      : "style variety is spread widely enough that agreement should require actual persuasion",
  ];
  if (missing.length > 0) {
    interpretation.push(
      `no participant leads with ${missing.map((slice) => dimensionMeta[slice.dimension].label).join(" or ")} — that contribution has to be sourced deliberately`,
    );
  }

  return {
    category: "collaboration",
    title: !orientationCalled
      ? "Task and people focus in balance"
      : orientationGap > 0
        ? "People-oriented balance"
        : "Task-oriented balance",
    observation: `People orientation (Influence plus Stable) totals ${people}; task orientation (Dominant plus Analytical) totals ${task}. The largest style cluster holds ${plural(top.count, "participant")} (${top.share}%).`,
    interpretation,
    questions: [
      "Which style do we under-use when the work gets busy?",
      "Who would notice if we optimised the task at the cost of the group, or the reverse?",
    ],
    evidence: [
      { label: "People orientation", value: String(people) },
      { label: "Task orientation", value: String(task) },
      { label: "Largest cluster", value: `${dimensionMeta[top.dimension].label} ${top.share}%` },
      { label: "Styles unrepresented", value: String(missing.length) },
    ],
    signal: signalFor(profiles.length),
    sampleSize: profiles.length,
    populationSize: profiles.length,
  };
}

function change(profiles: readonly BoardProfile[], mean: DiscScores): FacilitatorInsight {
  // Higher Stable and Analytical averages track a stated preference for
  // preparation; this is a preference reading, not a capability judgement.
  const preparation = Math.round((mean.s + mean.c) / 2);
  const adaptability = Math.round((mean.d + mean.i) / 2);
  const called = Math.abs(preparation - adaptability) >= MIN_MEANINGFUL_GAP;
  const preparationLed = preparation > adaptability;

  return {
    category: "change",
    title: !called
      ? "Mixed change preferences"
      : preparationLed
        ? "Preparation before movement"
        : "Comfortable moving early",
    observation: `Preparation preference (Stable and Analytical averaged) sits at ${preparation}; early-movement preference (Dominant and Influence averaged) sits at ${adaptability}.`,
    interpretation: [
      !called
        ? "the two preferences sit within a few points of each other, so responses to change are likely to vary by individual rather than follow a group pattern"
        : preparationLed
          ? "ambiguity is likely to be uncomfortable until the shape of the change is explained"
          : "ambiguity is likely to be tolerated, and detail may be requested later than it is needed",
      !called
        ? "a change announcement is likely to land differently across the group, so one framing may not reach everyone"
        : preparationLed
          ? "rapid change announced without a rationale may be met with quiet rather than objection"
          : "rapid change may be adopted before its consequences are fully mapped",
      "a change approach that states the reason, the sequence and what stays the same is likely to travel further here than one that leads with urgency",
    ],
    questions: [
      "What would we need to know before a change feels workable rather than imposed?",
      "How would we notice that someone disagrees but has not said so?",
    ],
    evidence: [
      { label: "Preparation preference", value: String(preparation) },
      { label: "Early-movement preference", value: String(adaptability) },
      { label: `${dimensionMeta.S.displayCode} average`, value: String(mean.s) },
      { label: `${dimensionMeta.C.displayCode} average`, value: String(mean.c) },
    ],
    signal: signalFor(profiles.length),
    sampleSize: profiles.length,
    populationSize: profiles.length,
  };
}

const CLIMATE: Record<Dimension, string> = {
  D: "directive",
  I: "relational",
  S: "participative",
  C: "cautious",
};

function leadership(profiles: readonly BoardProfile[], mean: DiscScores): FacilitatorInsight {
  const ranked = rankDimensions(mean);
  const lead = ranked[0]!;
  const weakest = ranked[3]!;
  const called = separated(mean[DIMENSION_KEY[lead]], mean[DIMENSION_KEY[weakest]]);

  if (!called) {
    return {
      category: "leadership",
      title: "No single leadership register dominates",
      observation: `The highest and lowest team averages differ by ${mean[DIMENSION_KEY[lead]] - mean[DIMENSION_KEY[weakest]]} points, which is below the margin at which one register can be called dominant.`,
      interpretation: [
        "leadership is likely to be experienced differently depending on who is leading, rather than as one consistent house style",
        "that breadth can be a strength — but it may also mean people are unsure what to expect from a given decision",
        "agreeing explicitly how decisions get made here may matter more than it would in a group with one clear register",
      ],
      questions: [
        "What do people currently expect when a decision comes down — and is that expectation consistent?",
        "Which register do we default to under pressure, and does it match what the situation needs?",
      ],
      evidence: [...averageChips(mean), { label: "Lead margin", value: `${mean[DIMENSION_KEY[lead]] - mean[DIMENSION_KEY[weakest]]}` }],
      signal: signalFor(profiles.length),
      sampleSize: profiles.length,
      populationSize: profiles.length,
    };
  }

  return {
    category: "leadership",
    title: `Leadership may be experienced as ${CLIMATE[lead]}`,
    observation: `${dimensionMeta[lead].label} is the highest team average at ${mean[DIMENSION_KEY[lead]]}, ahead of ${dimensionMeta[weakest].label} at ${mean[DIMENSION_KEY[weakest]]}.`,
    interpretation: [
      `direction is likely to be set in a ${CLIMATE[lead]} register, which tends to be experienced as ${lead === "D" ? "clear and fast" : lead === "I" ? "energising and personal" : lead === "S" ? "steady and inclusive" : "thorough and exacting"}`,
      `over-used, that same register can be experienced as ${lead === "D" ? "not leaving room to disagree" : lead === "I" ? "long on optimism and short on specifics" : lead === "S" ? "slow to confront what is not working" : "hard to satisfy"}`,
      `the ${CLIMATE[weakest]} register is the least available here, so situations needing it will feel effortful`,
    ],
    questions: [
      "When has our leading style been exactly right, and when has it been too much of a good thing?",
      "What would a different leadership register make possible that we currently find hard?",
    ],
    evidence: [
      ...averageChips(mean),
      { label: "Dominant register", value: CLIMATE[lead] },
    ],
    signal: signalFor(profiles.length),
    sampleSize: profiles.length,
    populationSize: profiles.length,
  };
}

function conflict(profiles: readonly BoardProfile[], mean: DiscScores): FacilitatorInsight {
  const bands = strengthDistribution(profiles);
  const band = (dim: Dimension) => bands.find((entry) => entry.dimension === dim)!.count;
  const paceTension = band("D") >= 1 && band("S") >= 1;
  const proofTension = band("I") >= 1 && band("C") >= 1;

  const interpretation: string[] = [];
  if (paceTension) {
    interpretation.push(
      "potential tension may arise between participants who prefer to commit quickly and participants who prefer more preparation before committing",
    );
  }
  if (proofTension) {
    interpretation.push(
      "potential tension may arise between participants who lead with the story and participants who want the evidence before the story",
    );
  }
  if (interpretation.length === 0) {
    interpretation.push(
      "no opposing style concentrations are present, so open disagreement may be rarer than useful",
    );
  }
  interpretation.push(
    "these are style tendencies observed in aggregate, not predictions about particular relationships",
  );

  return {
    category: "conflict",
    title: paceTension || proofTension ? "Style tensions worth naming early" : "Low style tension",
    observation: `${plural(band("D"), "participant")} run Dominant at or above ${HIGH_BAND}, ${plural(band("S"), "participant")} run Stable, ${plural(band("I"), "participant")} run Influence and ${plural(band("C"), "participant")} run Analytical at the same band.`,
    interpretation,
    questions: [
      "How do we currently surface disagreement, and does that route work for everyone?",
      "What would make it easier to say 'I am not ready to commit to that yet'?",
    ],
    evidence: [
      ...DIMENSIONS.map((dim) => ({
        label: `High ${dimensionMeta[dim].displayCode}`,
        value: String(band(dim)),
      })),
      {
        label: "Pace gap",
        value: String(Math.abs(mean.d - mean.s)),
      },
    ],
    signal: signalFor(profiles.length),
    sampleSize: profiles.length,
    populationSize: profiles.length,
  };
}

function inclusion(profiles: readonly BoardProfile[], mean: DiscScores): FacilitatorInsight {
  const distribution = behaviourDistribution(profiles);
  const sorted = [...distribution].sort((a, b) => b.count - a.count);
  const top = sorted[0]!;
  const smallest = sorted.filter((slice) => slice.count > 0).slice(-1)[0] ?? top;
  const reflective = distribution
    .filter((slice) => slice.dimension === "S" || slice.dimension === "C")
    .reduce((sum, slice) => sum + slice.share, 0);
  const dominated = top.share >= 50;

  return {
    category: "inclusion",
    title: dominated ? "One style carries the room" : "Voice is spread across styles",
    observation: `${dimensionMeta[top.dimension].label} accounts for ${top.share}% of participants; ${dimensionMeta[smallest.dimension].label} accounts for ${smallest.share}%. Reflective styles (Stable and Analytical) together account for ${reflective}%.`,
    interpretation: [
      dominated
        ? "decisions may be shaped disproportionately by one behavioural cluster, without anyone intending it"
        : "no single cluster is positioned to shape decisions on its own",
      reflective >= 50
        ? "a majority prefer to process before speaking, so the first opinion voiced may not represent the room"
        : "a majority are likely to think out loud, so quieter participants may need to be invited explicitly rather than waited for",
      "participants who prefer to reflect before speaking are often heard less in fast discussion — this is about airtime, not about contribution or ability",
    ],
    questions: [
      "Whose view have we not heard on the last three significant decisions?",
      "What would let someone contribute after the meeting rather than during it?",
      "If we went round the table in reverse, what would change?",
    ],
    evidence: [
      { label: "Largest cluster", value: `${dimensionMeta[top.dimension].label} ${top.share}%` },
      { label: "Smallest represented", value: `${dimensionMeta[smallest.dimension].label} ${smallest.share}%` },
      { label: "Reflective share", value: `${reflective}%` },
      { label: "Reflective average", value: String(Math.round((mean.s + mean.c) / 2)) },
    ],
    signal: signalFor(profiles.length),
    sampleSize: profiles.length,
    populationSize: profiles.length,
  };
}

/* ── entry point ────────────────────────────────────────────────────── */

const BUILDERS: Record<
  InsightCategory,
  (profiles: readonly BoardProfile[], mean: DiscScores) => FacilitatorInsight
> = {
  snapshot,
  communication,
  decision,
  collaboration,
  change,
  leadership,
  conflict,
  inclusion,
};

export const INSIGHT_ORDER: InsightCategory[] = [
  "snapshot",
  "communication",
  "decision",
  "collaboration",
  "change",
  "leadership",
  "conflict",
  "inclusion",
];

/**
 * Builds every insight card for one scope.
 *
 * A scope below MIN_GROUP_SIZE completed profiles produces no cards at all —
 * privacy suppression and analytical honesty point the same way here, because
 * a two-person "team pattern" identifies both people and means nothing.
 */
export function buildFacilitatorInsights(
  profiles: readonly BoardProfile[],
  scope: FacilitatorScope,
  populationSize = profiles.length,
): FacilitatorInsightSet {
  if (profiles.length < MIN_GROUP_SIZE) {
    return {
      scope,
      insights: [],
      suppressed:
        profiles.length === 0
          ? "No completed profiles in this scope yet. Insights appear once participants finish their assessments."
          : `Too little data for a reliable group interpretation. ${plural(profiles.length, "completed profile")} — at least ${MIN_GROUP_SIZE} are needed before a group pattern is reported.`,
    };
  }

  const mean = averages(profiles);
  return {
    scope,
    insights: INSIGHT_ORDER.map((category) => ({
      ...BUILDERS[category](profiles, mean),
      populationSize,
    })),
    suppressed: null,
  };
}

/* ── department comparison ──────────────────────────────────────────── */

export interface DepartmentInsight {
  department: string;
  completedCount: number;
  memberCount: number;
  averages: DiscScores;
  lead: Dimension;
  balanceIndex: number;
  signal: SignalStrength;
  /** Null when the department is below the suppression threshold. */
  insights: FacilitatorInsight[] | null;
  suppressed: string | null;
}

/**
 * Per-department insights inside ONE team. Departments below the suppression
 * threshold return their headline counts (so a facilitator can see coverage)
 * but no interpretation.
 */
export function departmentInsights(
  profiles: readonly BoardProfile[],
  memberCountByDepartment: Readonly<Record<string, number>>,
  generatedAt: string,
): DepartmentInsight[] {
  const buckets = new Map<string, BoardProfile[]>();
  for (const profile of profiles) {
    const key = profile.department ?? "Unassigned";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(profile);
    else buckets.set(key, [profile]);
  }

  return [...buckets.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([department, group]) => {
      const mean = averages(group);
      const set = buildFacilitatorInsights(
        group,
        { label: department, basis: "group", generatedAt },
        memberCountByDepartment[department] ?? group.length,
      );
      return {
        department,
        completedCount: group.length,
        memberCount: memberCountByDepartment[department] ?? group.length,
        averages: mean,
        lead: rankDimensions(mean)[0]!,
        balanceIndex: balanceVerdict(mean).index,
        signal: signalFor(group.length),
        insights: set.suppressed ? null : set.insights,
        suppressed: set.suppressed,
      };
    });
}
