import type { Dimension, Question } from "@/lib/types";

/**
 * 24 forced-choice groups. Each group carries exactly one option per
 * dimension (D, I, S, C); option order was shuffled at authoring time and
 * must stay fixed — determinism is part of the scoring contract.
 */

type Spec = [prompt: string, d: string, i: string, s: string, c: string];

const specs: Spec[] = [
  [
    "When a project stalls, you are the one who…",
    "Forces a decision and moves",
    "Re-energizes the room",
    "Holds the team steady",
    "Diagnoses what broke",
  ],
  [
    "In a first meeting with strangers, you tend to…",
    "Steer the agenda",
    "Spark the conversation",
    "Put people at ease",
    "Listen and observe closely",
  ],
  [
    "Under a hard deadline, your instinct is to…",
    "Cut scope and ship now",
    "Rally help fast",
    "Keep a steady, reliable pace",
    "Protect quality above all",
  ],
  [
    "When someone challenges your idea, you…",
    "Push back head-on",
    "Win them over",
    "Look for middle ground",
    "Go back and re-verify the facts",
  ],
  [
    "Colleagues would most likely describe you as…",
    "Decisive",
    "Magnetic",
    "Dependable",
    "Precise",
  ],
  [
    "Faced with a risky opportunity, you…",
    "Seize it before others do",
    "Sell everyone on the upside",
    "Weigh the impact on people first",
    "Model the downside carefully",
  ],
  [
    "Your natural role on a team is…",
    "The driver",
    "The energizer",
    "The anchor",
    "The examiner",
  ],
  [
    "When plans change suddenly, you…",
    "Take command of the pivot",
    "Improvise out loud",
    "Restore calm and order",
    "Re-plan methodically",
  ],
  [
    "In a negotiation, you rely on…",
    "Leverage and pace",
    "Rapport and charm",
    "Patience and trust",
    "Data and detail",
  ],
  [
    "When a teammate underperforms, you…",
    "Confront it directly",
    "Motivate them back up",
    "Support them quietly",
    "Analyze the root cause",
  ],
  [
    "Your written communication style is…",
    "Short and commanding",
    "Warm and expressive",
    "Considered and kind",
    "Thorough and exact",
  ],
  [
    "At your best, you are…",
    "Bold",
    "Inspiring",
    "Steadfast",
    "Rigorous",
  ],
  [
    "What drains you the most is…",
    "Slow consensus",
    "Working alone too long",
    "Constant churn and upheaval",
    "Sloppy, careless work",
  ],
  [
    "You make big decisions by…",
    "Instinct and speed",
    "Talking them through",
    "Sleeping on them",
    "Building the full case",
  ],
  [
    "In a crisis, you become…",
    "The commander",
    "The morale keeper",
    "The stabilizer",
    "The fact-checker",
  ],
  [
    "Meetings, ideally, should be…",
    "Short and decisive",
    "Lively and open",
    "Predictable and inclusive",
    "Structured and well-prepared",
  ],
  [
    "The praise that lands hardest with you…",
    "“You made the tough call.”",
    "“You lit up the room.”",
    "“You held us together.”",
    "“You got it exactly right.”",
  ],
  [
    "Your relationship with rules is…",
    "Break them if they slow results",
    "Charm your way around them",
    "Respect them — they keep things stable",
    "They usually exist for good reason",
  ],
  [
    "A new idea arrives. Your first instinct…",
    "Who decides? Let’s move.",
    "Who can I tell first?",
    "How does this affect the team?",
    "Does it actually hold up?",
  ],
  [
    "When conflict breaks out in the room, you…",
    "Name it bluntly",
    "Defuse it with warmth",
    "Calm everyone down",
    "Steer back to the facts",
  ],
  [
    "Progress, to you, feels like…",
    "Ground taken",
    "Momentum and buzz",
    "A consistent rhythm",
    "Errors eliminated",
  ],
  [
    "Your ideal calendar is…",
    "Full of decisions",
    "Full of people",
    "Predictable, protected blocks",
    "Long stretches of deep focus",
  ],
  [
    "Right after a win, you…",
    "Set the next target",
    "Celebrate loudly",
    "Credit the team",
    "Study why it worked",
  ],
  [
    "The legacy you want is…",
    "Results that changed the game",
    "People you energized",
    "Teams that lasted",
    "Standards that endured",
  ],
];

/** Authoring-time shuffle patterns so dimensions don't sit in fixed slots. */
const orderPatterns: Dimension[][] = [
  ["D", "I", "S", "C"],
  ["I", "C", "D", "S"],
  ["S", "D", "C", "I"],
  ["C", "S", "I", "D"],
];

const labelFor = (spec: Spec, dim: Dimension): string => {
  switch (dim) {
    case "D":
      return spec[1];
    case "I":
      return spec[2];
    case "S":
      return spec[3];
    case "C":
      return spec[4];
  }
};

export const discQuestions: Question[] = specs.map((spec, index) => {
  const number = String(index + 1).padStart(2, "0");
  const order = orderPatterns[index % orderPatterns.length] as Dimension[];
  const options = order.map((dim, optionIndex) => ({
    id: `q${number}-${optionIndex + 1}`,
    label: labelFor(spec, dim),
    dimension: dim,
  })) as Question["options"];
  return {
    id: `q${number}`,
    index,
    prompt: spec[0],
    options,
  };
});

export const TOTAL_QUESTIONS = discQuestions.length;
