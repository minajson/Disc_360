/**
 * DISC360 Workplace Scenarios v2 — the authored source of truth.
 *
 * Original content written for DISC360. Not derived from any proprietary
 * DISC instrument. Behavioural situations only: no scenario asks a trait
 * question ("are you confident?"), and within every scenario the four
 * options are written to be equally socially acceptable, comparable in
 * length, workplace-relevant and culturally neutral.
 *
 * Dimensions here are the USER-FACING set — D, I, S, A (Analytical).
 * The internal database keeps "C" for Analytical; `data/disc-questions.ts`
 * adapts this bank to the internal representation. Authoring happens in
 * user-facing letters so reviewers read what participants are measured on.
 *
 * This is a self-awareness and team-development instrument. It is not
 * clinically validated and makes no diagnostic claim.
 */

/** User-facing dimension letters. Analytical is "A" here, "C" internally. */
export type Dimension = "D" | "I" | "S" | "A";

export interface AssessmentOption {
  id: string;
  text: string;
  dimension: Dimension;
}

export interface AssessmentScenario {
  id: string;
  prompt: string;
  options: AssessmentOption[];
  category: string;
}

/** The behavioural themes the bank covers, one per scenario, in order. */
export const SCENARIO_CATEGORIES = [
  "decision-making",
  "communication",
  "meetings",
  "deadlines",
  "conflict",
  "change",
  "teamwork",
  "leadership",
  "planning",
  "problem-solving",
  "feedback",
  "pressure",
  "delegation",
  "social interaction",
  "quality",
  "risk",
  "uncertainty",
  "persuasion",
  "support",
  "rules",
  "priorities",
  "learning",
  "execution",
  "recovery after setbacks",
] as const;

export type ScenarioCategory = (typeof SCENARIO_CATEGORIES)[number];

/**
 * Authoring spec: prompt plus the behaviour for each dimension. Keeping the
 * four behaviours adjacent in one tuple is what makes desirability and
 * length balance reviewable at a glance.
 */
type Spec = readonly [prompt: string, d: string, i: string, s: string, a: string];

const specs: readonly Spec[] = [
  [
    "When a team must make a difficult decision, I usually:",
    "Push for a clear decision and immediate action.",
    "Encourage discussion and build enthusiasm around a direction.",
    "Help everyone remain calm and find common ground.",
    "Review the evidence, risks and consequences before deciding.",
  ],
  [
    "When I receive a new assignment, I usually:",
    "Identify the outcome and begin moving quickly.",
    "Talk through the idea with others and build momentum.",
    "Clarify how it affects the people and routines involved.",
    "Define the requirements, standards and process first.",
  ],
  [
    "During a meeting that is moving slowly, I tend to:",
    "Bring the discussion to a clear decision point.",
    "Re-energize the group and encourage participation.",
    "Give people time to contribute without pressure.",
    "Bring the conversation back to facts and objectives.",
  ],
  [
    "When a deadline is at risk, I am most likely to:",
    "Reprioritize sharply and push for delivery.",
    "Rally the people involved and keep energy high.",
    "Coordinate support so the team can recover steadily.",
    "Identify the source of delay and revise the plan carefully.",
  ],
  [
    "When disagreement arises, I usually:",
    "Address it directly and argue for the strongest outcome.",
    "Use conversation and persuasion to restore alignment.",
    "Reduce tension and search for a solution everyone can accept.",
    "Separate emotion from facts and examine the issue objectively.",
  ],
  [
    "When plans suddenly change, I tend to:",
    "Adapt quickly and take control of the new direction.",
    "Focus on the new possibilities and share them openly.",
    "Help others adjust while maintaining stability.",
    "Understand why the change occurred before altering the plan.",
  ],
  [
    "In group work, I naturally:",
    "Set direction and keep the team moving.",
    "Connect people and maintain enthusiasm.",
    "Support cooperation and dependable follow-through.",
    "Organize information and protect quality.",
  ],
  [
    "When asked to lead, I usually:",
    "Establish expectations and make decisions.",
    "Inspire commitment through energy and vision.",
    "Create trust and support people consistently.",
    "Define a reliable structure and clear standards.",
  ],
  [
    "When planning a project, I prefer to:",
    "Set a challenging goal and move into execution.",
    "Explore ideas with others before choosing an approach.",
    "Develop a realistic pace that people can sustain.",
    "Build a detailed plan with milestones and controls.",
  ],
  [
    "When solving an unfamiliar problem, I tend to:",
    "Test a practical solution quickly and adjust.",
    "Generate ideas through conversation and collaboration.",
    "Draw on approaches that have worked reliably before.",
    "Investigate the causes and compare possible solutions.",
  ],
  [
    "When someone gives me critical feedback, I usually:",
    "Evaluate whether it will improve my results.",
    "Discuss it openly and seek the wider context.",
    "Reflect on how it affects the relationship and team.",
    "Examine the examples and accuracy of the feedback.",
  ],
  [
    "Under intense pressure, I may:",
    "Become more forceful and more impatient.",
    "Talk more and move rapidly between ideas.",
    "Withdraw from conflict and try to preserve stability.",
    "Become more cautious and focused on possible errors.",
  ],
  [
    "When delegating work, I prefer to:",
    "State the required outcome and give ownership.",
    "Explain the purpose and build excitement.",
    "Ensure the person feels supported and comfortable.",
    "Clarify the process, standards and checkpoints.",
  ],
  [
    "At a professional social event, I am likely to:",
    "Approach the most useful contacts directly.",
    "Meet many people and keep conversation lively.",
    "Spend time building a few genuine connections.",
    "Observe first and engage in focused conversations.",
  ],
  [
    "When reviewing completed work, I focus first on:",
    "Whether the desired result was achieved.",
    "How well the work will engage and win over others.",
    "Whether the process supported the people involved.",
    "Whether the work is accurate and meets the standard.",
  ],
  [
    "When faced with a significant risk, I usually:",
    "Decide whether the potential gain justifies acting.",
    "Consider the opportunity and how to gain support.",
    "Consider how the risk may affect people and continuity.",
    "Gather information and reduce uncertainty before proceeding.",
  ],
  [
    "When instructions are unclear, I tend to:",
    "Make a reasonable decision and continue.",
    "Ask others and develop the idea through discussion.",
    "Seek clarification so expectations remain aligned.",
    "Request precise requirements and supporting information.",
  ],
  [
    "When I need to persuade others, I usually:",
    "Emphasize the outcome and the need for action.",
    "Use stories, energy and personal connection.",
    "Show how the idea supports people and cooperation.",
    "Present evidence, logic and a well-structured case.",
  ],
  [
    "When a colleague is struggling, I am most likely to:",
    "Help them identify the action needed to recover.",
    "Encourage them and restore their confidence.",
    "Listen patiently and offer dependable support.",
    "Help them analyze the problem and build a practical solution.",
  ],
  [
    "When procedures seem inefficient, I tend to:",
    "Change them quickly to improve the results.",
    "Discuss alternatives and gain support for a better approach.",
    "Improve them gradually without disrupting stability.",
    "Review why they exist before recommending a controlled change.",
  ],
  [
    "When several tasks compete for attention, I usually:",
    "Choose the highest-impact task and act.",
    "Start with the task that creates the most momentum.",
    "Work through priorities steadily and reliably.",
    "Rank them according to criteria, dependencies and deadlines.",
  ],
  [
    "When learning something new, I prefer to:",
    "Try it out and learn through direct action.",
    "Learn through discussion, demonstration and interaction.",
    "Follow a guided process with time to practice.",
    "Study the principles and understand how it works.",
  ],
  [
    "When a project enters execution, I tend to:",
    "Monitor progress closely toward the result.",
    "Keep people engaged and communicate momentum.",
    "Maintain coordination and consistent follow-through.",
    "Track quality, risks and adherence to the plan.",
  ],
  [
    "After a major setback, I usually:",
    "Regroup quickly and pursue another route.",
    "Restore optimism and reconnect people to the goal.",
    "Rebuild confidence and stability step by step.",
    "Review what failed and apply the lessons before restarting.",
  ],
];

/**
 * Authoring-time display order. Two Latin squares interleaved: across the
 * 24 scenarios every dimension lands in every slot exactly six times, so
 * position carries no signal a participant could learn. The order is fixed
 * at authoring time rather than shuffled per request — scoring reads option
 * ids, never positions, and a stable order keeps the bank reviewable and
 * the database rows reproducible.
 */
const LATIN_SQUARE_A: readonly (readonly Dimension[])[] = [
  ["D", "I", "S", "A"],
  ["I", "S", "A", "D"],
  ["S", "A", "D", "I"],
  ["A", "D", "I", "S"],
];

const LATIN_SQUARE_B: readonly (readonly Dimension[])[] = [
  ["D", "S", "I", "A"],
  ["S", "D", "A", "I"],
  ["I", "A", "D", "S"],
  ["A", "I", "S", "D"],
];

/** A0, B0, A1, B1, … — eight orders, each used three times across the bank. */
const displayOrders: readonly (readonly Dimension[])[] = LATIN_SQUARE_A.flatMap(
  (rowA, index) => [rowA, LATIN_SQUARE_B[index] as readonly Dimension[]],
);

const textFor = (spec: Spec, dimension: Dimension): string => {
  switch (dimension) {
    case "D":
      return spec[1];
    case "I":
      return spec[2];
    case "S":
      return spec[3];
    case "A":
      return spec[4];
  }
};

/**
 * Option ids deliberately encode position, never dimension — an id that
 * leaked its dimension would hand the mapping to any participant who opened
 * developer tools mid-assessment.
 */
export const assessmentScenarios: readonly AssessmentScenario[] = specs.map(
  (spec, index) => {
    const number = String(index + 1).padStart(2, "0");
    const order = displayOrders[index % displayOrders.length] as readonly Dimension[];
    return {
      id: `s${number}`,
      prompt: spec[0],
      category: SCENARIO_CATEGORIES[index] as ScenarioCategory,
      options: order.map((dimension, slot) => ({
        id: `s${number}-o${slot + 1}`,
        text: textFor(spec, dimension),
        dimension,
      })),
    };
  },
);

export const TOTAL_SCENARIOS = assessmentScenarios.length;
