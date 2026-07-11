import type { ArchetypeCode } from "@/lib/types";

/**
 * Static insight content for all 13 archetypes.
 * Register: second person, executive-coaching tone, no emoji.
 * UI dimension labels only: Dominant, Influence, Stable, Analytical.
 */

export interface ArchetypeInsight {
  code: ArchetypeCode;
  name: string;
  tagline: string;
  summary: string;
  strengths: { title: string; detail: string }[];
  blindSpots: { title: string; detail: string }[];
  communication: { do: string[]; dont: string[] };
  /** How this archetype communicates (their own style). */
  communicationStyle: string[];
  leadershipStyle: { headline: string; description: string; bullets: string[] };
  conflictResponse: { headline: string; description: string; tips: string[] };
  stressResponse: { triggers: string[]; behaviors: string[]; recovery: string[] };
  motivators: string[];
  drainers: string[];
  idealEnvironment: string[];
  /** Growth and coaching recommendation. */
  coaching: string;
  complementaryTypes: { code: ArchetypeCode; reason: string }[];
}

export const insightMap: Record<ArchetypeCode, ArchetypeInsight> = {
  D: {
    code: "D",
    name: "The Commander",
    tagline: "Moves first, decides fast, owns the outcome.",
    summary:
      "You are built for forward motion. Where others see obstacles, you see a sequence of decisions waiting to be made — and you would rather make a wrong call quickly than watch a right one die in committee. People experience you as direct, composed under fire, and allergic to wasted time. That force is your greatest asset and your most predictable liability: the same edge that cuts through ambiguity can cut people who needed one more beat of context. You do your best work when the goal is explicit, the authority is real, and the scoreboard is public. Your growth path is not softening — it is timing: learning when a pause, a question, or a handoff buys you more speed than another push.",
    strengths: [
      {
        title: "Decisive under ambiguity",
        detail:
          "You commit while others are still framing the question, which gives your teams direction when it matters most.",
      },
      {
        title: "Comfortable with confrontation",
        detail:
          "You name the hard thing in the room. Problems surface earlier and fester less around you.",
      },
      {
        title: "Relentless about outcomes",
        detail:
          "You measure everything against results, which keeps effort pointed at what actually moves the needle.",
      },
      {
        title: "Calm in crisis",
        detail:
          "Pressure narrows your focus instead of scattering it. People instinctively look to you when plans collapse.",
      },
      {
        title: "High standards for ownership",
        detail:
          "You take responsibility without being asked and expect the same — which raises the bar for everyone near you.",
      },
    ],
    blindSpots: [
      {
        title: "Speed reads as steamrolling",
        detail:
          "Your pace can look like disregard. Quieter voices stop offering input long before you notice the silence.",
      },
      {
        title: "Impatience with process",
        detail:
          "You dismiss checks that feel slow — and occasionally the one check that would have caught the expensive mistake.",
      },
      {
        title: "Winning replaces listening",
        detail:
          "In debate you shift from understanding to prevailing, and the room learns to stop debating you.",
      },
      {
        title: "Under-communicated intent",
        detail:
          "You move on decisions you consider obvious, leaving others to reverse-engineer your reasoning after the fact.",
      },
    ],
    communication: {
      do: [
        "Lead with the bottom line, then give supporting detail on request",
        "Offer options with clear trade-offs rather than open-ended questions",
        "Be direct about disagreement — hedging reads as evasion",
        "Keep meetings short and end with owners and deadlines",
        "Acknowledge their track record before challenging their plan",
      ],
      dont: [
        "Bury the decision in background and caveats",
        "Escalate emotionally — they will discount the message with the delivery",
        "Slow-roll bad news; they punish surprises harder than problems",
        "Mistake their bluntness for hostility",
        "Relitigate settled decisions without new information",
      ],
    },
    leadershipStyle: {
      headline: "Command through clarity",
      description:
        "You lead from the front and set direction by deciding, not by facilitating. Teams under you always know what winning looks like — the risk is that they stop telling you what you don't want to hear.",
      bullets: [
        "Set the destination and defend it; delegate the route",
        "Institutionalize dissent — appoint someone to argue the other side",
        "Publicly reward the person who catches your mistake",
      ],
    },
    stressResponse: {
      triggers: [
        "Losing control of a decision that affects your results",
        "Slow consensus on questions you consider already answered",
        "Public failure or a challenge to your competence",
      ],
      behaviors: [
        "Becomes blunt to the point of bruising",
        "Takes unilateral control and bypasses agreed process",
        "Escalates pace — more pressure, shorter deadlines, less listening",
      ],
      recovery: [
        "Physical outlet first; decisions an hour later",
        "Write the decision down and sleep on anything irreversible",
        "Debrief with one trusted peer who is allowed to push back",
      ],
    },
    idealEnvironment: [
      "Real authority matched to real accountability",
      "Direct communication culture with fast feedback loops",
      "Measurable goals and a visible scoreboard",
      "Freedom to act without approval theater",
      "Peers strong enough to push back without flinching",
    ],
    communicationStyle: [
      "Leads with the conclusion and works backward only if asked",
      "Short, declarative sentences — questions are often decisions in disguise",
      "Comfortable interrupting to keep the room on point",
      "Signals respect by being blunt; small talk is rationed",
    ],
    conflictResponse: {
      headline: "Meets conflict head-on",
      description:
        "You treat conflict as information: something is blocked, and pressure will unblock it. You escalate quickly, argue to win, and recover fast — often faster than the person you argued with.",
      tips: [
        "Name the shared goal before pressing your case",
        "Let the other side finish; you decide better with full data",
        "Close hard conversations with an explicit repair — you've moved on, they may not have",
      ],
    },
    motivators: [
      "Authority matched to accountability",
      "Ambitious, measurable targets",
      "Visible wins and ground gained",
      "Direct competition",
    ],
    drainers: [
      "Approval chains and committee consensus",
      "Vague goals with no scoreboard",
      "Being managed in the details",
      "Meetings that end without decisions",
    ],
    coaching:
      "Your growth multiplier is timing, not softening. Practice the deliberate pause: before overriding someone, ask one real question and use the answer. Keep people around who are safe to contradict you and reward them publicly when they do — your results are already strong; your ceiling is set by the quality of dissent you retain.",
    complementaryTypes: [
      {
        code: "SC",
        reason:
          "Brings the patience and precision that protect your speed from its own shortcuts.",
      },
      {
        code: "S",
        reason:
          "Anchors the team you accelerate — keeping people intact while you keep things moving.",
      },
    ],
  },

  DI: {
    code: "DI",
    name: "The Catalyst",
    tagline: "Turns intent into momentum — and momentum into results.",
    summary:
      "You combine the will to win with the ability to make people want to come along. Where a pure driver pushes and a pure persuader charms, you do both in the same breath: you set an aggressive goal, then sell the room on why it's inevitable. You are at your best launching things — new products, new teams, new turnarounds — where energy and direction matter more than polish. Your risks are impatience and overreach: you commit the group before the details are load-bearing, and you can mistake enthusiasm in the room for capacity on the ground. Pair yourself deliberately with people who finish, verify, and stabilize, and your starts become wins instead of stories.",
    strengths: [
      {
        title: "Ignites action",
        detail:
          "You compress the distance between idea and first step better than almost anyone.",
      },
      {
        title: "Sells the mission",
        detail:
          "You frame goals in language that makes people volunteer instead of comply.",
      },
      {
        title: "Thrives in turnarounds",
        detail:
          "Chaos reads to you as opportunity; you give demoralized teams both a plan and a pulse.",
      },
      {
        title: "Decisive optimism",
        detail:
          "You make the call and make it feel winnable — a rare combination under pressure.",
      },
      {
        title: "Builds coalitions fast",
        detail:
          "You recruit allies across silos before the org chart notices what you're doing.",
      },
    ],
    blindSpots: [
      {
        title: "Starts more than you finish",
        detail:
          "Your energy peaks at the launch and dips in the long middle where results are actually made.",
      },
      {
        title: "Overpromises under excitement",
        detail:
          "The vision you sell can outrun what the team can deliver — and they inherit the gap.",
      },
      {
        title: "Confuses buzz with buy-in",
        detail:
          "A room that nodded is not a team that agreed. Quiet skeptics go unheard until execution stalls.",
      },
      {
        title: "Details feel optional",
        detail:
          "You delegate the fine print so completely that you sometimes can't see the risk it contains.",
      },
    ],
    communication: {
      do: [
        "Bring energy and a point of view — flat delivery loses them",
        "Frame issues as opportunities with a clear next move",
        "Give them the stage for wins; share credit visibly",
        "Anchor commitments in writing while the enthusiasm is real",
        "Challenge them directly — they respect a worthy sparring partner",
      ],
      dont: [
        "Open with process, constraints, or a list of risks",
        "Take their big claims literally without confirming the plan",
        "Slow the conversation with exhaustive background",
        "Compete for the spotlight in their moment",
        "Assume silence in the room means agreement",
      ],
    },
    leadershipStyle: {
      headline: "Momentum as a management system",
      description:
        "You lead by declaring the destination and generating belief. Teams move fast and feel alive under you — the discipline they need is the one you find boring: sequencing, verification, and the unglamorous middle.",
      bullets: [
        "Appoint a strong finisher as your explicit counterweight",
        "Convert every rally into written owners, dates, and definitions of done",
        "Protect one skeptic whose job is to test your claims before the market does",
      ],
    },
    stressResponse: {
      triggers: [
        "Stalled momentum and death-by-committee",
        "Being sidelined from the interesting problem",
        "Detailed scrutiny that feels like distrust",
      ],
      behaviors: [
        "Talks more, listens less, and doubles the promises",
        "Starts something new instead of fixing what's stuck",
        "Charms past objections that deserved an answer",
      ],
      recovery: [
        "Ship one small, finished thing to restore real momentum",
        "Debrief with someone Analytical you trust — facts as ballast",
        "Cut the commitment list in half, publicly",
      ],
    },
    idealEnvironment: [
      "New initiatives, launches, and turnarounds",
      "Visible goals with room to improvise the route",
      "A team that executes and pushes back in equal measure",
      "Direct access to decision-makers",
      "Wins that are celebrated out loud",
    ],
    communicationStyle: [
      "Announces direction with energy — communication doubles as recruitment",
      "Persuades in headlines and delegates the fine print",
      "Adjusts the pitch in real time to the room's energy",
      "Prefers conversation over documents, momentum over minutes",
    ],
    conflictResponse: {
      headline: "Wins the room, then the argument",
      description:
        "You confront quickly but stylishly — challenging the idea while charming the person. The risk is that unresolved substance hides under restored rapport.",
      tips: [
        "Confirm the disagreement is actually resolved, not just defused",
        "Put the settlement in writing while goodwill is high",
        "Don't recruit allies mid-conflict; it reads as campaigning",
      ],
    },
    motivators: [
      "Launches, turnarounds, and new ground",
      "An audience for the wins",
      "Freedom to improvise the route",
      "Ambitious goals with public stakes",
    ],
    drainers: [
      "Maintenance mode and steady-state operations",
      "Long documents and longer approval loops",
      "Skeptics with no counter-proposal",
      "Working alone for extended stretches",
    ],
    coaching:
      "Pair every launch with a named finisher and hold yourself to their sequence. Your persuasion creates commitments faster than the team can absorb them — cap the number of open initiatives, and audit last quarter's promises before making this quarter's.",
    complementaryTypes: [
      {
        code: "CS",
        reason:
          "Turns your declared inevitabilities into verified, sequenced delivery.",
      },
      {
        code: "S",
        reason:
          "Holds the team steady through the long middle your energy skips past.",
      },
    ],
  },

  ID: {
    code: "ID",
    name: "The Energizer",
    tagline: "Wins the room first, then wins the argument.",
    summary:
      "You lead with connection and back it with push. People meet your warmth before they meet your will — and many only realize afterward how effectively you moved them. You read rooms in real time, adjust the pitch mid-sentence, and leave people feeling bigger than you found them. Unlike a pure socializer, you keep score: relationships are real to you, and so is winning. Your best arenas are ones where persuasion is the work — sales, evangelism, leadership of volunteers, any situation where authority must be earned rather than assigned. Your watch-outs are follow-through and depth: the same agility that makes you compelling can make you hard to pin down, and commitments made in warm rooms need cold-morning verification.",
    strengths: [
      {
        title: "Instant credibility with people",
        detail:
          "You build trust in minutes that others need months to earn.",
      },
      {
        title: "Persuasion with a spine",
        detail:
          "Your charm carries a clear ask. People know what you want and want to give it to you.",
      },
      {
        title: "Reads the room in real time",
        detail:
          "You sense resistance before it speaks and adjust before it hardens.",
      },
      {
        title: "Lifts team morale",
        detail:
          "Your presence is expansive — energy rises when you walk in, and teams run on that.",
      },
      {
        title: "Fearless ambassador",
        detail:
          "Cold calls, hostile stakeholders, skeptical boards — you volunteer for the rooms others avoid.",
      },
    ],
    blindSpots: [
      {
        title: "Commitment inflation",
        detail:
          "You say yes in the moment because the moment feels good. Your calendar pays for it later.",
      },
      {
        title: "Allergic to the unglamorous",
        detail:
          "Documentation, reconciliation, maintenance — the invisible work erodes when you own it.",
      },
      {
        title: "Conflict by avoidance or charm",
        detail:
          "You defuse rather than resolve, and some conflicts return with interest.",
      },
      {
        title: "Needs the audience",
        detail:
          "Working alone drains you fast, and your judgment of an idea can depend on how it lands in a room.",
      },
    ],
    communication: {
      do: [
        "Engage personally before transacting — the relationship is the channel",
        "Let them think out loud; their best ideas arrive mid-sentence",
        "Confirm agreements in writing, framed as helping, not policing",
        "Give recognition publicly and specifically",
        "Bring stories and people, not just spreadsheets",
      ],
      dont: [
        "Open with criticism or corrections in front of others",
        "Drown them in written process before the conversation",
        "Mistake their friendliness for full agreement",
        "Leave the ask implicit — be as direct as they are",
        "Schedule them into long stretches of solo work without warning",
      ],
    },
    leadershipStyle: {
      headline: "Leadership by gravitational pull",
      description:
        "People follow you because they want to be near what you're building. You create belonging and direction at once — the risk is a team tuned to your presence that wobbles when you're not in the room.",
      bullets: [
        "Build systems that carry your standards when you're absent",
        "Pair every public commitment with a private owner and date",
        "Practice delivering hard feedback plainly — warmth plus truth, not warmth instead of truth",
      ],
    },
    stressResponse: {
      triggers: [
        "Rejection from people whose opinion matters to you",
        "Long isolation from the audience that recharges you",
        "Rigid structure with no room to improvise",
      ],
      behaviors: [
        "Performs harder — more talk, more spin, less substance",
        "Scatters across too many conversations and commitments",
        "Avoids the person or problem that carries the conflict",
      ],
      recovery: [
        "One honest conversation with a safe person, not a crowd",
        "Close three open loops completely before opening any new ones",
        "Get specific: write down what was actually promised, to whom, by when",
      ],
    },
    idealEnvironment: [
      "People-facing work where persuasion is the product",
      "Public goals, public wins, public recognition",
      "Variety over repetition; conversations over documents",
      "A detail-strong partner who closes what you open",
      "Freedom to build relationships across boundaries",
    ],
    communicationStyle: [
      "Opens with connection, lands the ask once the room is warm",
      "Stories and examples over frameworks and data",
      "Thinks out loud — the first version is a draft, not a decision",
      "Generous with praise, sparing with paperwork",
    ],
    conflictResponse: {
      headline: "Defuses first, resolves if pressed",
      description:
        "Your instinct is to lower the temperature — humor, warmth, reframing. It keeps teams intact, but conflicts you charm to sleep tend to wake up bigger.",
      tips: [
        "Name the actual disagreement in one sentence before smoothing it",
        "Tolerate ten seconds of discomfort; it buys real resolution",
        "Follow up in writing so warmth doesn't erase the terms",
      ],
    },
    motivators: [
      "Rooms full of people to win over",
      "Public recognition, given and received",
      "Variety and motion in the work",
      "Being trusted as the face of the mission",
    ],
    drainers: [
      "Solo deep work with no audience",
      "Reconciliation, documentation, and fine print",
      "Cold, purely transactional cultures",
      "Delivering criticism without a relationship to cushion it",
    ],
    coaching:
      "Your leverage is trust; your liability is follow-through. Institute a personal close-the-loop ritual — three open commitments finished before any new yes — and practice one plainly delivered hard message per week. Warmth plus truth is your executive form.",
    complementaryTypes: [
      {
        code: "C",
        reason:
          "Grounds your momentum in evidence and catches the fine print you charm past.",
      },
      {
        code: "SC",
        reason:
          "Quietly finishes and stabilizes everything your energy sets in motion.",
      },
    ],
  },

  I: {
    code: "I",
    name: "The Connector",
    tagline: "Makes people believe — in the idea, the team, and themselves.",
    summary:
      "Your instrument is people. You generate warmth the way others generate analysis, and it is not decoration — it is how work actually gets unblocked, funded, and forgiven around you. You are the person who knows someone everywhere, who turns a tense meeting with one well-timed story, who makes newcomers feel like insiders by lunch. Optimism is your default setting and your genuine conviction: things can work, people can change, the pitch can land. The cost side of the ledger is focus and follow-through — enthusiasm spreads you thin, conflict tempts you to smooth rather than solve, and the disciplined solitude some work demands feels like punishment. Your growth is not becoming serious; it is becoming selective.",
    strengths: [
      {
        title: "Builds trust effortlessly",
        detail:
          "People open up to you and pull for you. Your network is a working asset, not a contact list.",
      },
      {
        title: "Contagious optimism",
        detail:
          "You reframe setbacks into next chapters and keep teams emotionally solvent through hard stretches.",
      },
      {
        title: "Natural storyteller",
        detail:
          "You translate strategy into meaning. People remember what you said long after the slide deck dies.",
      },
      {
        title: "Defuses tension",
        detail:
          "You lower the temperature of a room by instinct, making hard conversations survivable.",
      },
      {
        title: "Champions others",
        detail:
          "You spotlight people generously, and they do their best work in that light.",
      },
    ],
    blindSpots: [
      {
        title: "Enthusiasm outruns capacity",
        detail:
          "You say yes with your heart and reconcile with your calendar later — often too late.",
      },
      {
        title: "Harmony over honesty",
        detail:
          "You soften hard messages until they stop being messages at all.",
      },
      {
        title: "Details slip through",
        detail:
          "Follow-ups, numbers, and fine print bore you — and quietly define how you're evaluated.",
      },
      {
        title: "Approval as fuel",
        detail:
          "When the room goes cold, your confidence goes with it, and decisions start chasing applause.",
      },
    ],
    communication: {
      do: [
        "Start with the person, then the business",
        "Let them talk their way to the idea; think out loud together",
        "Make feedback warm, specific, and forward-looking",
        "Put decisions and dates in a friendly written recap",
        "Invite them where the people and energy are",
      ],
      dont: [
        "Lead with a wall of data or a list of what's wrong",
        "Take verbal enthusiasm as a project plan",
        "Criticize them in public — the wound outlasts the lesson",
        "Force week-long solo deep work without human contact",
        "Be cold or purely transactional; they'll disengage quietly",
      ],
    },
    leadershipStyle: {
      headline: "Leads hearts first, then minds",
      description:
        "You build teams people don't want to leave. Culture, morale, and loyalty flourish under you — the discipline to protect is accountability, so warmth doesn't become a place where standards go soft.",
      bullets: [
        "Pair your vision-casting with a rhythm of written commitments",
        "Deliver the hard message yourself; delegating it corrodes trust",
        "Recruit a finisher and treat their rigor as a gift, not friction",
      ],
    },
    stressResponse: {
      triggers: [
        "Social rejection or a room that's turned against you",
        "Rigid detail-work marathons with no human contact",
        "Being cast as the bad guy in a conflict",
      ],
      behaviors: [
        "Talks more and commits faster to win the room back",
        "Avoids the difficult person while venting to everyone else",
        "Loses the thread — focus scatters across a dozen conversations",
      ],
      recovery: [
        "One real conversation with one trusted person",
        "Physically finish something small; completion restores footing",
        "Re-read actual commitments and prune half of them",
      ],
    },
    idealEnvironment: [
      "Collaborative, people-dense work with visible impact",
      "Recognition culture — appreciation said out loud",
      "Variety and motion over routine and repetition",
      "A partner or system that owns the follow-through",
      "Freedom to communicate across the whole organization",
    ],
    communicationStyle: [
      "Warm, expressive, and fast — energy is part of the message",
      "Persuades through stories and belief, not spreadsheets",
      "Thinks by talking; ideas improve in company",
      "Remembers the personal details and uses them kindly",
    ],
    conflictResponse: {
      headline: "Smooths before it solves",
      description:
        "Conflict feels like relationship failure, so you move fast to restore the mood. The mood usually recovers; the underlying issue often doesn't.",
      tips: [
        "Treat the issue and the relationship as separate tracks",
        "Say the uncomfortable sentence early — it's smaller now than later",
        "Recruit a fact-anchor when disputes turn technical",
      ],
    },
    motivators: [
      "People-dense, collaborative work",
      "Appreciation said out loud",
      "New faces, new rooms, new stories",
      "A mission worth evangelizing",
    ],
    drainers: [
      "Extended solitude and silence",
      "Detail marathons and reconciliation work",
      "Cultures where enthusiasm is read as naivety",
      "Being disliked — even by people whose opinion shouldn't count",
    ],
    coaching:
      "Become selective, not serious. Choose the three relationships and two projects where your energy compounds, and protect them from the twenty that merely consume it. Pair with a finisher, put commitments in writing, and let optimism be a decision you make rather than a reflex you obey.",
    complementaryTypes: [
      {
        code: "C",
        reason:
          "Supplies the rigor and skepticism that keep your enthusiasm honest.",
      },
      {
        code: "CS",
        reason:
          "Builds the systems and continuity your relationships deserve.",
      },
    ],
  },

  IS: {
    code: "IS",
    name: "The Advocate",
    tagline: "Warmth with staying power.",
    summary:
      "You pair genuine people-magnetism with the patience to stay — and that combination is rarer than either half. Where pure enthusiasm burns bright and moves on, you keep showing up: for the colleague, the customer, the cause. People trust you quickly and then discover the trust was warranted, which makes you a natural in roles where relationships compound — customer success, team leadership, community building, teaching. You default to encouragement, remember what matters to people, and absorb friction so others can work in peace. Your risks live in the same warmth: you avoid necessary conflict, over-accommodate loud voices, and can burn quietly while insisting you're fine. Learning to disappoint people in small honest doses is your highest-leverage skill.",
    strengths: [
      {
        title: "Trust that compounds",
        detail:
          "You win people quickly and keep them for years. Retention — of customers and colleagues — follows you.",
      },
      {
        title: "Steady encouragement",
        detail:
          "Your support isn't a mood; it's a reliable structure people build confidence on.",
      },
      {
        title: "Translator between worlds",
        detail:
          "You carry messages between leadership and the front line without losing the humanity in either direction.",
      },
      {
        title: "Calms and connects",
        detail:
          "You make groups feel safe enough to be honest and warm enough to be generous.",
      },
      {
        title: "Loyal under pressure",
        detail:
          "When things get hard, you don't trade people away for convenience.",
      },
    ],
    blindSpots: [
      {
        title: "Conflict postponed is conflict grown",
        detail:
          "You delay hard conversations to protect the relationship — and the delay damages it more.",
      },
      {
        title: "Yes by default",
        detail:
          "Your accommodation trains others to over-ask, and your own priorities pay the bill.",
      },
      {
        title: "Silent overload",
        detail:
          "You absorb strain without signaling it. People find out you were drowning after the fact.",
      },
      {
        title: "Loyal past the evidence",
        detail:
          "You give people third and fourth chances the data stopped supporting.",
      },
    ],
    communication: {
      do: [
        "Warm up before getting down to business",
        "Ask for their read on people dynamics — it's usually accurate",
        "Give them time to process big changes before demanding a position",
        "Appreciate them specifically and privately as well as publicly",
        "Make it explicitly safe to disagree with you",
      ],
      dont: [
        "Force on-the-spot confrontation in a group",
        "Read their agreeableness as full agreement",
        "Pile on urgent asks without acknowledging the load",
        "Spring drastic change without a bridge",
        "Exploit their reliability with the work no one else will do",
      ],
    },
    leadershipStyle: {
      headline: "Leadership as stewardship",
      description:
        "You lead by caring visibly and consistently. Teams under you feel personally safe and rarely churn — the edge to build is candor, so kindness never becomes the reason problems live long lives.",
      bullets: [
        "Set a personal rule: no concern held longer than 48 hours unspoken",
        "Practice small refusals weekly; protect capacity before it breaks",
        "Let others carry their own discomfort — rescue less, coach more",
      ],
    },
    stressResponse: {
      triggers: [
        "Open interpersonal conflict, especially between people you like",
        "Sudden change imposed without consultation",
        "Being taken for granted after long accommodation",
      ],
      behaviors: [
        "Smooths and appeases while resentment accrues underneath",
        "Says yes faster while meaning it less",
        "Withdraws warmth quietly rather than naming the injury",
      ],
      recovery: [
        "Name the strain to one safe person in plain words",
        "Restore one boundary — a real no, kindly delivered",
        "Time completely off the emotional caretaking of others",
      ],
    },
    idealEnvironment: [
      "Relationship-centered work with long time horizons",
      "A culture that says thank you and means it",
      "Change introduced with consultation and runway",
      "Leadership that shields the team from whiplash",
      "Room to develop people, not just process them",
    ],
    communicationStyle: [
      "Leads with empathy — the relationship is the channel",
      "Listens more than speaks, then speaks for the room's quiet half",
      "Softens hard messages, sometimes past the point of hearing",
      "Consistent tone: what you get today is what you get in a crisis",
    ],
    conflictResponse: {
      headline: "Absorbs before it addresses",
      description:
        "You give people the benefit of the doubt, then more of it. You'll carry friction privately for weeks to spare the group — and call it patience.",
      tips: [
        "Set a 48-hour rule: concerns get voiced within two days",
        "Small honest no's beat one large resentful yes",
        "Let the other party own their share of the discomfort",
      ],
    },
    motivators: [
      "Long-horizon relationships that compound",
      "Being genuinely useful to specific people",
      "Teams that feel like teams",
      "Quiet, sincere recognition",
    ],
    drainers: [
      "Open interpersonal warfare",
      "Churn that resets relationships every quarter",
      "Being taken for granted",
      "Zero-sum, elbows-out cultures",
    ],
    coaching:
      "Practice graduated candor: start with low-stakes disagreements and work up. Your warmth gives you more permission to be direct than you currently use — people can take hard truth from you precisely because they trust you. Spend that credit.",
    complementaryTypes: [
      {
        code: "D",
        reason:
          "Carries the confrontations you'd rather avoid and converts your care into decisions.",
      },
      {
        code: "CD",
        reason:
          "Adds structural rigor and hard prioritization to your people-first instincts.",
      },
    ],
  },

  SI: {
    code: "SI",
    name: "The Harmonizer",
    tagline: "The quiet center that keeps the whole thing human.",
    summary:
      "You are steadiness first, warmth a close second — the person who makes a team feel like a place rather than a schedule. You prefer rhythm to rush, listen more than you speak, and notice the human weather of a room long before it becomes a storm. People bring you things they don't bring anyone else, because you receive them without drama or judgment. You rarely demand credit and are chronically under-thanked, yet remove you from a team and everyone feels the temperature change. Your risks are self-erasure and inertia: you accommodate until you disappear, and you can defend a comfortable rhythm past the point it stopped working. Your voice is worth more than you charge for it.",
    strengths: [
      {
        title: "Emotional ballast",
        detail:
          "Your calm is contagious. Volatile weeks bend around you instead of breaking the team.",
      },
      {
        title: "Listens people whole",
        detail:
          "You hear what's under the words. People leave conversations with you feeling repaired.",
      },
      {
        title: "Reliability as love language",
        detail:
          "You do what you said, quietly, again and again — the foundation everyone builds on.",
      },
      {
        title: "Keeps groups cohesive",
        detail:
          "You tend the seams of the team — the small repairs that prevent the big ruptures.",
      },
      {
        title: "Grace under provocation",
        detail:
          "You de-escalate by nature and rarely hand a conflict fresh ammunition.",
      },
    ],
    blindSpots: [
      {
        title: "Your needs go unheard",
        detail:
          "You advocate for everyone but yourself; the org learns to plan around your silence.",
      },
      {
        title: "Comfort defends itself",
        detail:
          "You can protect a familiar rhythm long after the situation demanded a new one.",
      },
      {
        title: "Slow to confront",
        detail:
          "Real problems get patience they don't deserve because naming them feels violent.",
      },
      {
        title: "Change lands as loss",
        detail:
          "Reorganizations and pivots hit you harder than you let on, and recovery is invisible labor.",
      },
    ],
    communication: {
      do: [
        "Slow down; give the conversation room to breathe",
        "Ask directly for their opinion — then wait for it",
        "Flag changes early and explain the why",
        "Thank them for the invisible work, by name",
        "Check in privately; the group setting mutes them",
      ],
      dont: [
        "Fill their silence with your own conclusions",
        "Force instant decisions on things that deserve thought",
        "Assume their calm means everything is fine",
        "Reward their reliability with everyone else's leftovers",
        "Turn disagreements into public showdowns",
      ],
    },
    leadershipStyle: {
      headline: "Leads by making it safe",
      description:
        "You lead the way a keel steers — mostly unseen, constantly correcting. Teams under you are loyal, honest, and unhurried into error. The muscle to build is assertion: your judgment deserves the same airtime you give everyone else's.",
      bullets: [
        "Speak first in one meeting a week — your read is data",
        "Convert one private concern into a public agenda item each sprint",
        "Delegate the peacekeeping sometimes; not every fire is yours",
      ],
    },
    stressResponse: {
      triggers: [
        "Sustained conflict in your inner circle",
        "Abrupt change with no consultation",
        "Being talked over or planned around repeatedly",
      ],
      behaviors: [
        "Goes quieter, absorbs more, signals less",
        "Overworks in the background to hold things together",
        "Avoids the source of conflict while carrying its full weight",
      ],
      recovery: [
        "Protected quiet time — genuine solitude, not just absence",
        "One honest disclosure to someone safe",
        "Reduce the load you never admitted to carrying",
      ],
    },
    idealEnvironment: [
      "Stable teams with real relationships and low churn",
      "Predictable rhythms punctuated by manageable change",
      "Leaders who ask for your view and wait for the answer",
      "A culture where care counts as contribution",
      "Conflict handled early, privately, and like adults",
    ],
    communicationStyle: [
      "Quiet, warm, and deliberate — speaks when there's something to say",
      "Asks the questions that let others feel heard",
      "Prefers one-on-one to the open floor",
      "Understatement by default; strong feelings arrive in soft packaging",
    ],
    conflictResponse: {
      headline: "De-escalates by presence",
      description:
        "You cool rooms down without being asked. But your own grievances get filed, not voiced — and quiet withdrawal is your loudest signal.",
      tips: [
        "Say the thing at sixty percent intensity rather than not at all",
        "Don't mediate conflicts you're actually a party to",
        "Count your own needs as one of the interests at stake",
      ],
    },
    motivators: [
      "Stable teams with real bonds",
      "Predictable rhythms and honored commitments",
      "Care recognized as contribution",
      "Leaders who ask — and then actually wait",
    ],
    drainers: [
      "Sustained conflict in the inner circle",
      "Whiplash pivots without consultation",
      "Being planned around rather than consulted",
      "Loud, self-promoting cultures",
    ],
    coaching:
      "Your read on the room is data the team needs — publish it. Commit to speaking first once per week and converting one private concern into an agenda item per sprint. You don't need more empathy; you need more airtime.",
    complementaryTypes: [
      {
        code: "D",
        reason:
          "Provides the push and the difficult conversations that complete your care.",
      },
      {
        code: "DC",
        reason:
          "Challenges comfortable rhythms with standards and drive — kept humane by your presence.",
      },
    ],
  },

  S: {
    code: "S",
    name: "The Anchor",
    tagline: "The reason the wheels stay on.",
    summary:
      "You are the constant other people navigate by. Consistency isn't a habit for you — it's a value: you believe follow-through is a form of respect, that teams outperform heroes, and that most emergencies were preventable rhythms someone abandoned. You work with patience others mistake for slowness until they watch your output over a quarter instead of a day. Under pressure, you get quieter and more deliberate while others get louder and more erratic — which is precisely when teams discover what you're worth. Your risks are absorbed strain and resistance to necessary change: you carry too much silently, and you can guard a stable system past its expiry date. You don't need to become louder; you need to become more expensive to overlook.",
    strengths: [
      {
        title: "Relentless follow-through",
        detail:
          "What you accept, you finish. People stake plans on your word and win those bets.",
      },
      {
        title: "Composure that scales",
        detail:
          "Your calm sets the team's ceiling for panic. Crises stay smaller around you.",
      },
      {
        title: "Long-game endurance",
        detail:
          "You sustain quality across the stretches where sprinters fade and quit.",
      },
      {
        title: "Team-first instincts",
        detail:
          "You optimize for the group's success without needing the spotlight as payment.",
      },
      {
        title: "Institutional memory",
        detail:
          "You remember how things actually work — and why the last three shortcuts failed.",
      },
    ],
    blindSpots: [
      {
        title: "Silence reads as consent",
        detail:
          "You don't volunteer disagreement, so bad plans sail past the person best placed to stop them.",
      },
      {
        title: "Absorbs until it breaks",
        detail:
          "You take on load without flagging it; the first visible symptom is often the serious one.",
      },
      {
        title: "Change feels like threat",
        detail:
          "You defend proven rhythms even when the world that proved them is gone.",
      },
      {
        title: "Underpriced contribution",
        detail:
          "Because you don't market your work, others set your value — lower than it should be.",
      },
    ],
    communication: {
      do: [
        "Give context and runway before asking for change",
        "Ask specific questions; open-ended prompts get modest answers",
        "Honor their routines when scheduling and planning",
        "Acknowledge steady work explicitly — it's rarely self-advertising",
        "Follow up one-on-one after group discussions",
      ],
      dont: [
        "Spring last-minute pivots and expect cheerfulness",
        "Interpret quiet as having nothing to say",
        "Overload them because they never refuse",
        "Dismiss their caution as fear of progress",
        "Rush decisions that deserve deliberation",
      ],
    },
    leadershipStyle: {
      headline: "Leads by being dependable at scale",
      description:
        "You lead through consistency — teams under you know the standards, keep the promises, and skip the drama. Your development edge is initiative in conflict and change: naming problems early and championing the pivots you'd instinctively resist.",
      bullets: [
        "Schedule the hard conversation the week it becomes necessary",
        "Sponsor one change per quarter yourself — be its advocate, not its brake",
        "Report your capacity honestly before accepting new load",
      ],
    },
    stressResponse: {
      triggers: [
        "Chaotic pivots with no explanation or runway",
        "Sustained interpersonal conflict",
        "Having reliability rewarded with more weight",
      ],
      behaviors: [
        "Withdraws and goes procedurally quiet",
        "Absorbs strain silently while morale erodes inside",
        "Passive resistance — slower yes, softer commitment",
      ],
      recovery: [
        "Restore one familiar rhythm completely",
        "Say the true number out loud: what you're actually carrying",
        "Negotiate scope before accepting the next request",
      ],
    },
    idealEnvironment: [
      "Clear expectations and stable priorities",
      "Change managed with explanation and transition time",
      "A team that values finishing over flash",
      "Low-politics culture where words match actions",
      "Recognition tied to reliability, not volume",
    ],
    communicationStyle: [
      "Measured and consistent — says less, means all of it",
      "Asks the practical questions others skip",
      "Prefers advance notice to on-the-spot reactions",
      "A yes is a schedule, not a sentiment",
    ],
    conflictResponse: {
      headline: "Endures, then addresses",
      description:
        "You outlast most conflict rather than engage it, absorbing strain to protect the team's rhythm. The cost accrues silently — and surfaces late.",
      tips: [
        "Flag friction while it's still small enough to be boring",
        "Ask for time deliberately: 'I'll respond tomorrow' beats silence",
        "Don't confuse keeping the peace with keeping quiet",
      ],
    },
    motivators: [
      "Clear expectations and stable priorities",
      "Finishing what was started",
      "Loyalty repaid in kind",
      "Change introduced with runway",
    ],
    drainers: [
      "Chaotic pivots and moving goalposts",
      "Conflict-heavy environments",
      "Reliability rewarded with more load",
      "Flash prioritized over follow-through",
    ],
    coaching:
      "Make your capacity visible before it's exceeded — report the true number of what you're carrying. And sponsor one change per quarter yourself: advocating for a pivot, once, will do more for how the organization reads you than a year of silent excellence.",
    complementaryTypes: [
      {
        code: "D",
        reason:
          "Supplies urgency and confrontation; you supply the endurance that makes them sustainable.",
      },
      {
        code: "DI",
        reason:
          "Generates the motion and optimism you stabilize into lasting results.",
      },
    ],
  },

  SC: {
    code: "SC",
    name: "The Craftsman",
    tagline: "Does it right, does it quietly, does it every time.",
    summary:
      "You combine patience with precision — the temperament of someone who would rather do one thing excellently than five things adequately. You distrust flash, respect mastery, and measure yourself against the work itself rather than the applause it gets. Teams learn to route their most fragile, most consequential work to you, because your output arrives complete, tested, and on time, without drama. You prefer depth to breadth, familiar tools honed sharp, and standards that don't flex with moods. Your risks are invisibility and rigidity: you under-communicate progress until people mistake quiet for absence, and you can polish past the point of diminishing returns while faster hands ship. Your craft deserves a voice, not just a workbench.",
    strengths: [
      {
        title: "Quality as a default",
        detail:
          "Excellence isn't an occasion for you; it's the only way you know how to finish.",
      },
      {
        title: "Deep, durable focus",
        detail:
          "You sustain concentration across the long technical middle where others fragment.",
      },
      {
        title: "Trustworthy with the fragile",
        detail:
          "The systems that must not break end up in your hands — and don't break.",
      },
      {
        title: "Methodical improvement",
        detail:
          "You sharpen processes incrementally until they're quietly world-class.",
      },
      {
        title: "Steady under technical pressure",
        detail:
          "Complex failures make you more systematic, not less.",
      },
    ],
    blindSpots: [
      {
        title: "Perfection vs. shipped",
        detail:
          "Your 95% is the market's 110% — and sometimes late. Knowing when good enough is right is a skill.",
      },
      {
        title: "Progress goes unreported",
        detail:
          "You surface work when it's done; stakeholders panic in the silence before.",
      },
      {
        title: "Rigid about method",
        detail:
          "Your proven way can crowd out a better one arriving from outside.",
      },
      {
        title: "Conflict-avoidant precision",
        detail:
          "You'd rather quietly fix others' sloppiness than confront it — subsidizing the problem.",
      },
    ],
    communication: {
      do: [
        "Be specific: exact requirements, exact deadlines, exact priorities",
        "Give them uninterrupted time and defend it",
        "Ask their standard-of-quality opinion — it's expert testimony",
        "Warn about changes early and explain the reasoning",
        "Respect the craft: acknowledge the invisible difficulty",
      ],
      dont: [
        "Reshuffle their priorities casually or often",
        "Demand rough drafts from someone wired for finished work without framing why",
        "Read their quiet as disengagement",
        "Publicly compare their pace to someone shipping rougher work",
        "Skip the details in briefs and expect them to improvise",
      ],
    },
    leadershipStyle: {
      headline: "Standards embodied, not announced",
      description:
        "You lead by demonstration — the bar is wherever your work is. People calibrate to you silently. Your growth is in translation: narrating progress, teaching your judgment, and letting urgency amend (not erase) your standards.",
      bullets: [
        "Publish progress at fixed intervals, even mid-imperfection",
        "Define 'good enough for this purpose' with stakeholders up front",
        "Mentor deliberately — your judgment scales only if you speak it",
      ],
    },
    stressResponse: {
      triggers: [
        "Forced shortcuts on quality you'll be blamed for later",
        "Constant interruption and priority churn",
        "Vague direction from people who won't commit to specifics",
      ],
      behaviors: [
        "Slows down and narrows in, missing the burning bigger picture",
        "Goes silent about slippage until it's undeniable",
        "Digs into the proven method as the world demands a new one",
      ],
      recovery: [
        "Finish one piece of work to your own standard, uninterrupted",
        "Renegotiate scope explicitly rather than absorbing it",
        "A conversation with someone who respects the craft",
      ],
    },
    idealEnvironment: [
      "Deep work with protected focus time",
      "Quality genuinely valued, not just cited in retrospectives",
      "Stable priorities and specific briefs",
      "Ownership of a domain end to end",
      "Colleagues who do what they say they'll do",
    ],
    communicationStyle: [
      "Precise and economical — writes better than meetings allow",
      "Reports when finished; silence usually means progress",
      "Asks specification questions others find pedantic and later needed",
      "Understates achievements — the work is the statement",
    ],
    conflictResponse: {
      headline: "Withdraws into the work",
      description:
        "You'd rather quietly fix the problem than confront its author. Disputes about quality feel personal because your standards are personal.",
      tips: [
        "Critique the artifact and invite critique of yours — trade in specifics",
        "Escalate slippage when it's a fact, not once it's a crisis",
        "Someone else's sloppiness is their bill; stop paying it silently",
      ],
    },
    motivators: [
      "Protected deep-focus time",
      "Mastery visible in the artifact",
      "Specific briefs and stable priorities",
      "Respect from people who know the craft",
    ],
    drainers: [
      "Interrupt-driven days and priority churn",
      "Being compared to faster, rougher output",
      "Vague direction from uncommitted stakeholders",
      "Quality debt imposed from above",
    ],
    coaching:
      "Narrate the invisible work: publish progress at fixed intervals, even mid-imperfection, and define 'good enough for this purpose' with stakeholders up front. Your standards should be a spec others can meet — not a private bar only you can see.",
    complementaryTypes: [
      {
        code: "DI",
        reason:
          "Brings the urgency and external push that turn your standards into shipped impact.",
      },
      {
        code: "I",
        reason:
          "Advertises the excellence you produce and refuse to market.",
      },
    ],
  },

  CS: {
    code: "CS",
    name: "The Systemizer",
    tagline: "Order out of chaos, every time.",
    summary:
      "You think in systems the way others think in tasks. Where colleagues see a pile of work, you see flow, dependencies, failure points, and the one process change that would fix half of it. Precision leads and patience backs it: you not only design the correct procedure, you have the temperament to run it consistently until it becomes culture. You distrust improvisation that calls itself agility and heroics that call themselves commitment — you've watched both create the messes you're later asked to clean. Organizations lean on you hardest during scale-ups and audits, when 'we've always done it this way' meets reality. Your risks are over-engineering, change-resistance, and letting process become the point. The system serves the mission; you're at your best when you keep that order straight.",
    strengths: [
      {
        title: "Sees the system behind the symptoms",
        detail:
          "You fix root causes while others are still rescheduling the fire drill.",
      },
      {
        title: "Documentation that actually works",
        detail:
          "Your procedures survive contact with new hires, audits, and 2 a.m. incidents.",
      },
      {
        title: "Consistency at scale",
        detail:
          "You make quality reproducible — the difference between a good week and a good company.",
      },
      {
        title: "Risk radar",
        detail:
          "You spot the failure mode in the plan while it's still cheap to fix.",
      },
      {
        title: "Calm, methodical delivery",
        detail:
          "Deadlines approach and your process just keeps ticking.",
      },
    ],
    blindSpots: [
      {
        title: "Process for its own sake",
        detail:
          "A checklist that no longer serves the outcome is still a checklist you'll defend.",
      },
      {
        title: "Slow to exception",
        detail:
          "Genuine emergencies sometimes need the rulebook closed, and that costs you visible effort.",
      },
      {
        title: "Innovation feels like risk",
        detail:
          "New approaches read as unproven approaches, and you price them accordingly.",
      },
      {
        title: "People are not workflows",
        detail:
          "Humans in your systems have moods, politics, and pride — variables your diagrams omit.",
      },
    ],
    communication: {
      do: [
        "Bring data, sequence, and a clear problem statement",
        "Give lead time; their best answers are considered answers",
        "Respect existing process — propose changes as versioned improvements",
        "Put agreements and specs in writing",
        "Credit the prevention work: disasters that didn't happen",
      ],
      dont: [
        "Announce sweeping change with no migration path",
        "Argue from vibes against their spreadsheet",
        "Treat their caution as obstruction",
        "Skip steps and expect them to bless the result",
        "Drown their calendar in unstructured brainstorm meetings",
      ],
    },
    leadershipStyle: {
      headline: "Governance as a form of care",
      description:
        "You lead by building machinery that makes good outcomes routine. Teams under you know the standard, the process, and the escalation path. Your development edge is adaptability — treating change as a system requirement, not a system failure.",
      bullets: [
        "Sunset one process per quarter as deliberately as you create them",
        "Budget explicit slack for exceptions and label it as design, not defeat",
        "Pair with a change-agent and give their experiments protected lanes",
      ],
    },
    stressResponse: {
      triggers: [
        "Improvised decisions overriding agreed process",
        "Accountability without authority over the system",
        "Chronic ambiguity from leadership",
      ],
      behaviors: [
        "Tightens control and multiplies checkpoints",
        "Retreats into documentation while the human problem grows",
        "Becomes the bottleneck by insisting everything route through review",
      ],
      recovery: [
        "Restore one system fully to spec — visible order is oxygen",
        "Separate what you can control from what you must merely survive",
        "Time with the mission the process serves, not the process",
      ],
    },
    idealEnvironment: [
      "Clear authority over the systems you're accountable for",
      "Leadership that plans further ahead than this quarter",
      "Change managed through versions, not upheavals",
      "Colleagues who respect procedure enough to follow or formally amend it",
      "Quality and compliance treated as strategy, not overhead",
    ],
    communicationStyle: [
      "Structured and sequenced — context, evidence, recommendation",
      "Documents decisions; conversation is input, writing is record",
      "Precise language, precisely meant",
      "Flags risk early, takes credit late, brings drama never",
    ],
    conflictResponse: {
      headline: "Proceduralizes the dispute",
      description:
        "You take conflict to process: criteria, precedents, documentation. It keeps things fair — and can feel bloodless to people who needed to be heard first.",
      tips: [
        "Hear the feeling before citing the framework",
        "Not every exception is an attack on the system",
        "Time-box process disputes; some fights cost more than the rule protects",
      ],
    },
    motivators: [
      "Authority over the systems they're accountable for",
      "Order visibly emerging from chaos",
      "Prevention valued like firefighting",
      "Leadership that plans beyond the quarter",
    ],
    drainers: [
      "Improvisation overriding agreed process",
      "Chronic ambiguity from above",
      "Heroics celebrated over reliability",
      "Accountability without authority",
    ],
    coaching:
      "Treat adaptability as a system requirement: sunset one process per quarter as deliberately as you create them, and budget explicit slack for exceptions. Pair with a change-agent and give their experiments a protected lane — the mission is the point; the system is the means.",
    complementaryTypes: [
      {
        code: "DI",
        reason:
          "Injects speed and bold bets; your systems make their bets survivable.",
      },
      {
        code: "ID",
        reason:
          "Handles the persuasion and politics your diagrams can't capture.",
      },
    ],
  },

  C: {
    code: "C",
    name: "The Strategist",
    tagline: "Right answers, verified twice.",
    summary:
      "You run on evidence. Where others form opinions, you build cases — and you hold your own work to the same cross-examination you apply to everyone else's. Accuracy is not perfectionism to you; it is basic professional honesty. You see the flaw in the plan, the gap in the data, the sentence in the contract everyone else skimmed — and you're usually right, which is why the organization's hardest analytical problems migrate to your desk. You prefer working depth-first, alone or with a few respected minds, and you'd rather be correct than popular in any room where those diverge. Your risks are analysis without end, standards that read as contempt, and a habit of winning arguments while losing allies. Your rigor changes outcomes only when it ships — and only when people can hear it.",
    strengths: [
      {
        title: "Analytical depth",
        detail:
          "You take problems apart to first principles and rebuild them correctly.",
      },
      {
        title: "Error detection",
        detail:
          "Mistakes that would cost quarters get caught by you at the draft stage.",
      },
      {
        title: "Intellectual honesty",
        detail:
          "You follow the data where it goes, including against your own prior position.",
      },
      {
        title: "Quality that survives audit",
        detail:
          "Your work is checked before it's submitted — by you, harder than they will.",
      },
      {
        title: "Immune to hype",
        detail:
          "Charisma doesn't move your estimate. Evidence does. Teams need at least one of you.",
      },
    ],
    blindSpots: [
      {
        title: "Analysis as procrastination",
        detail:
          "There is a point where more data stops changing the decision. You pass it quietly and often.",
      },
      {
        title: "Precision reads as coldness",
        detail:
          "Your corrections are accurate and remembered as attacks. Relationship is a data channel too.",
      },
      {
        title: "Perfect as enemy of shipped",
        detail:
          "Version three of the analysis arrives after the meeting that needed version one.",
      },
      {
        title: "Critique outweighs credit",
        detail:
          "You flag ten risks per encouragement, and people begin editing what they show you.",
      },
    ],
    communication: {
      do: [
        "Come prepared; sloppy claims lose you the room instantly",
        "Give questions in advance and time to research",
        "Engage the substance of their objections, point by point",
        "Be precise about scope, criteria, and success measures",
        "Deliver feedback privately, with specifics",
      ],
      dont: [
        "Oversell, round up, or hand-wave the numbers",
        "Force snap decisions on matters with real stakes",
        "Take their scrutiny personally — it's how they respect ideas",
        "Interrupt deep work for status theater",
        "Mistake their reserve for absence of conviction",
      ],
    },
    leadershipStyle: {
      headline: "Authority through accuracy",
      description:
        "You lead by being right in ways that hold up. People trust your judgment because it's earned per decision. The stretch is warmth and tempo: pairing your standards with visible belief in people, and shipping judgment at the speed decisions actually happen.",
      bullets: [
        "Set decision deadlines and honor them at 80% certainty",
        "Deliver one specific, genuine appreciation per critique session",
        "Translate analyses into one-page recommendations — depth on request",
      ],
    },
    stressResponse: {
      triggers: [
        "Being forced to endorse work below your standard",
        "Decisions made on politics against your evidence",
        "Public criticism of your accuracy",
      ],
      behaviors: [
        "Retreats into research as the deadline burns",
        "Sharpens critique into something that draws blood",
        "Withdraws from the messy human process entirely",
      ],
      recovery: [
        "Uninterrupted deep work on a problem that yields to rigor",
        "Write out the worst credible case; measured, it usually shrinks",
        "One conversation with a peer who argues honestly",
      ],
    },
    idealEnvironment: [
      "Complex problems that reward depth over theater",
      "Time to do it right, protected from meeting sprawl",
      "Decisions genuinely made on merit and data",
      "A few sharp colleagues over many loud ones",
      "Standards enforced consistently, including upward",
    ],
    communicationStyle: [
      "Precise, prepared, and economical with claims",
      "Prefers written arguments with time to verify",
      "Questions are quality control, not hostility",
      "Reserved until sure — then quietly immovable",
    ],
    conflictResponse: {
      headline: "Litigates on the evidence",
      description:
        "You depersonalize conflict into a question of facts — which works until the other party needed acknowledgment more than accuracy. You rarely lose the argument; check what the win cost.",
      tips: [
        "Concede valid fragments early; it makes your case credible",
        "State your confidence level instead of projecting certainty",
        "When it turns emotional, pause the data and hear the person",
      ],
    },
    motivators: [
      "Hard problems that reward depth",
      "Decisions genuinely made on merit",
      "Time to do it right",
      "A few rigorous colleagues",
    ],
    drainers: [
      "Deadlines that force endorsing sloppy work",
      "Decisions made on politics against evidence",
      "Meeting sprawl and status theater",
      "Hype outranking analysis",
    ],
    coaching:
      "Ship judgment at decision speed: set explicit deadlines and deliver at eighty percent certainty with confidence levels attached. And pair every critique with one genuine, specific acknowledgment — accuracy people can't hear is accuracy the organization doesn't get.",
    complementaryTypes: [
      {
        code: "I",
        reason:
          "Carries your conclusions into rooms and hearts your data can't reach alone.",
      },
      {
        code: "DI",
        reason:
          "Forces tempo and commitment where your thoroughness would keep deliberating.",
      },
    ],
  },

  CD: {
    code: "CD",
    name: "The Architect",
    tagline: "Designs the machine, then makes it run.",
    summary:
      "You pair analytical depth with executive force — a builder of systems who also has the will to impose them on reality. Pure analysts stop at the correct answer; you push through to the implemented one. You design with rigor, decide with evidence, and then drive the build with an intensity that surprises people who mistook your quiet for softness. You're at your strongest owning complex domains end to end: technical architecture, operational overhauls, anything where being right and being relentless must coexist. Your risks are impatience with less rigorous minds, control that crowds out ownership in others, and a tendency to optimize the system while under-investing in the people running it. The machine you're really building is the team — design it with the same care.",
    strengths: [
      {
        title: "Rigor with teeth",
        detail:
          "Your analysis ends in a decision and your decision ends in delivery.",
      },
      {
        title: "Complexity is home turf",
        detail:
          "You hold entire architectures in your head and still see the detail that breaks them.",
      },
      {
        title: "Immune to wishful thinking",
        detail:
          "You plan from base rates and evidence, not enthusiasm — your projects land closer to their estimates.",
      },
      {
        title: "High-agency problem solving",
        detail:
          "You don't wait for permission to fix what's structurally broken.",
      },
      {
        title: "Standards that raise ceilings",
        detail:
          "People do career-best technical work under your bar — once they survive calibrating to it.",
      },
    ],
    blindSpots: [
      {
        title: "Suffers fools not at all",
        detail:
          "Your impatience with weaker reasoning is visible, and it teaches people to hide their thinking from you.",
      },
      {
        title: "Control vs. ownership",
        detail:
          "You'd rather redo it right than coach it right — and your team's growth pays the difference.",
      },
      {
        title: "People as second-order effects",
        detail:
          "Morale, politics, and feelings are load-bearing components you tend to model last.",
      },
      {
        title: "Certainty compounds",
        detail:
          "Being usually right makes the rare wrong expensive — you double down where others would recheck.",
      },
    ],
    communication: {
      do: [
        "Bring your A-game reasoning; they engage arguments, not appeals",
        "Be direct about disagreement with evidence attached",
        "Give them hard problems and real authority",
        "Keep updates tight: status, risk, decision needed",
        "Challenge conclusions on the merits — they respect it",
      ],
      dont: [
        "Pitch with charisma where substance is thin",
        "Micromanage their domain after delegating it",
        "Take terseness as hostility; it's compression",
        "Hide problems to manage their reaction — they'll trust you less",
        "Waste their focus on ceremony and status theater",
      ],
    },
    leadershipStyle: {
      headline: "Architecture applied to organizations",
      description:
        "You lead by designing systems in which competence wins — clear standards, clean interfaces, decisions traceable to evidence. The stretch is warmth and delegation: letting people own imperfect versions of what you'd build, and saying out loud the respect your standards imply.",
      bullets: [
        "Delegate outcomes with explicit quality bars, then stay out of the how",
        "Say the appreciation you think is obvious — it isn't",
        "Review your own strongest conviction quarterly as if it were a subordinate's",
      ],
    },
    stressResponse: {
      triggers: [
        "Incompetence rewarded or protected above you",
        "Being overruled by politics against the evidence",
        "Accountability for a system you weren't allowed to design",
      ],
      behaviors: [
        "Centralizes control and reviews everything personally",
        "Cutting precision — critiques that demoralize instead of correct",
        "Disengages into contemptuous compliance",
      ],
      recovery: [
        "Autonomous ownership of one meaningful build",
        "Deep work stretch with zero meetings",
        "A technical peer who can genuinely argue back",
      ],
    },
    idealEnvironment: [
      "Complex, consequential problems with end-to-end ownership",
      "Merit-driven decisions and low political overhead",
      "Authority proportional to accountability",
      "Sharp colleagues who bring evidence to arguments",
      "Long horizons — time to build things properly",
    ],
    communicationStyle: [
      "Compressed and technical — status, risk, decision needed",
      "Argues from evidence and expects the same in return",
      "Terse by efficiency, not hostility",
      "Praise is rare, specific, and therefore currency",
    ],
    conflictResponse: {
      headline: "Engineers the outcome",
      description:
        "You treat conflict as a design problem: find the actual constraint, apply force there. Efficient — but people are not load paths, and some need the slow route to yes.",
      tips: [
        "Give opponents a face-saving path; you want the outcome, not the surrender",
        "Signal which battles are preferences, not requirements",
        "Check whether being right is landing as being contemptuous",
      ],
    },
    motivators: [
      "End-to-end ownership of consequential systems",
      "Arguments decided on merit",
      "Sharp colleagues who push back with evidence",
      "Long horizons to build properly",
    ],
    drainers: [
      "Incompetence protected above them",
      "Politics overriding evidence",
      "Approval theater and ceremony",
      "Delegation without authority",
    ],
    coaching:
      "Delegate outcomes, not methods: define the quality bar, then stay out of the how — your team's growth compounds faster than your corrections do. And say the respect your standards imply; the people meeting your bar can't hear the approval you think is obvious.",
    complementaryTypes: [
      {
        code: "IS",
        reason:
          "Keeps the human system healthy while you optimize the technical one.",
      },
      {
        code: "I",
        reason:
          "Wins hearts and coalitions for designs that are right but unloved.",
      },
    ],
  },

  DC: {
    code: "DC",
    name: "The Challenger",
    tagline: "Attacks the problem, and sometimes the room.",
    summary:
      "You lead with force and back it with facts — the rare combination that makes you devastating in negotiation, turnarounds, and any arena where comfortable assumptions need breaking. You ask the question everyone was avoiding, then follow the answer wherever it goes, regardless of whose project it embarrasses. Results and rigor are your twin loyalties; sentiment rarely gets a vote. Organizations deploy you against their hardest, most entrenched problems because you combine the drive to breach walls with the analysis to find the weak brick. Your risks are collateral damage and isolation: your standards can read as contempt, your directness as aggression, and you can win every argument in the building while support for your agenda quietly evaporates. Aim the challenge at problems, and you're unstoppable.",
    strengths: [
      {
        title: "Fearless scrutiny",
        detail:
          "You question sacred cows on the record — and half of them turn out to be expensive myths.",
      },
      {
        title: "Force multiplied by facts",
        detail:
          "Your pushes are aimed. When you apply pressure, it's where the analysis says it will break through.",
      },
      {
        title: "Elite negotiator",
        detail:
          "Prepared, unemotional, and willing to walk — the counterparty feels it in the first five minutes.",
      },
      {
        title: "Cuts through denial",
        detail:
          "You say the unsayable number out loud and force real planning to start.",
      },
      {
        title: "Independent spine",
        detail:
          "Consensus doesn't move you; evidence does. You'll stand alone and be right.",
      },
    ],
    blindSpots: [
      {
        title: "Wins arguments, loses allies",
        detail:
          "Every public dismantling is remembered by its target — and their friends.",
      },
      {
        title: "Skepticism as reflex",
        detail:
          "You stress-test ideas so hard at birth that fragile good ones die in your hands.",
      },
      {
        title: "Empathy priced at zero",
        detail:
          "You treat feelings as noise in the data — but people execute your plans, and people have feelings.",
      },
      {
        title: "Trusts almost no one's work",
        detail:
          "Re-verifying everything makes you the bottleneck and tells your team they're auditors' subjects.",
      },
    ],
    communication: {
      do: [
        "State your case directly with the evidence in hand",
        "Hold your ground under their pressure-testing — it earns standing",
        "Separate the decision question from the relationship question",
        "Be exact about commitments; they keep score",
        "Bring problems with proposed solutions attached",
      ],
      dont: [
        "Pad the message; they hear padding as weakness or spin",
        "Appeal to feelings against their facts",
        "Take the challenge personally — it's their default handshake",
        "Overpromise to end an uncomfortable meeting",
        "Ambush them politically; they retaliate with receipts",
      ],
    },
    leadershipStyle: {
      headline: "Standards enforced from the front",
      description:
        "You lead by attacking the hardest problem personally and expecting the team to match your intensity and honesty. Performance rises; comfort doesn't. The stretch is protection — making it safe to bring you bad news and half-formed ideas.",
      bullets: [
        "Reward the messenger visibly, especially when the news is bad",
        "Critique in draft-stage privately; save public rigor for public claims",
        "Recruit one trusted translator who softens transmission, not substance",
      ],
    },
    stressResponse: {
      triggers: [
        "Being managed by someone whose competence you doubt",
        "Emotional appeals overriding documented evidence",
        "Constraints that protect incumbents from scrutiny",
      ],
      behaviors: [
        "Escalates confrontation past the productive point",
        "Isolates — trusts no one's work, reviews everything",
        "Contempt leaks into tone and everyone feels it",
      ],
      recovery: [
        "A worthy problem that fights back — rigor as decompression",
        "Physical intensity to burn the charge off",
        "One counterpart who can absorb the heat and return honesty",
      ],
    },
    idealEnvironment: [
      "Hard problems with entrenched resistance",
      "License to question anything with evidence",
      "Leadership that values truth over comfort",
      "Compensation and standing tied to results",
      "Few meetings, fewer pep talks, no theater",
    ],
    communicationStyle: [
      "Direct challenge as a handshake — questions arrive sharp",
      "States positions with evidence attached and expects rebuttal",
      "Zero padding; hears padding as spin",
      "Keeps score on commitments — theirs and yours",
    ],
    conflictResponse: {
      headline: "Runs toward the fight",
      description:
        "Conflict is your native competence: you pressure-test people the way you pressure-test claims. You win arguments at a rate that quietly empties the room of honest input.",
      tips: [
        "Calibrate force to the stakes — not every disagreement is a siege",
        "Protect messengers visibly, especially bearers of bad news",
        "After winning, repair: the argument ended; their memory didn't",
      ],
    },
    motivators: [
      "Entrenched problems that fight back",
      "License to question anything",
      "Standing and stakes tied to results",
      "Truth valued over comfort",
    ],
    drainers: [
      "Being managed by the less competent",
      "Feelings overriding documented facts",
      "Pep talks, ceremony, and theater",
      "Rules that shield incumbents from scrutiny",
    ],
    coaching:
      "Aim the challenge at problems and protect the people. Recruit one trusted translator who softens your transmission without diluting substance, and track a new metric: how much bad news reaches you first. Fear is expensive; make honesty cheap.",
    complementaryTypes: [
      {
        code: "SI",
        reason:
          "Repairs and maintains the relationships your campaigns strain.",
      },
      {
        code: "IS",
        reason:
          "Converts your hard truths into messages people can act on without bleeding.",
      },
    ],
  },

  BAL: {
    code: "BAL",
    name: "The Integrator",
    tagline: "Fluent in all four languages of the team.",
    summary:
      "Your profile has no dominant spike — and that is a capability, not an absence. You speak Dominant when a call must be made, Influence when a room needs winning, Stable when a team needs holding, and Analytical when a claim needs checking. You are the translator between the forceful and the careful, the enthusiastic and the skeptical — often the only person in the room who genuinely understands what each side is optimizing for. Versatility makes you an exceptional generalist: chief of staff, product owner, team lead, founder. The risks are dilution and drift: without a spike, you can lack a signature edge people remember you by, and your ability to see every side can slow your commitment to one. Choose your battles deliberately — your range means you'll win most of the ones you actually pick.",
    strengths: [
      {
        title: "Situational range",
        detail:
          "You flex your style to what the moment needs instead of forcing the moment to fit your style.",
      },
      {
        title: "Native translator",
        detail:
          "You broker understanding between drivers and stabilizers, sellers and skeptics.",
      },
      {
        title: "Balanced judgment",
        detail:
          "Your decisions weigh people, evidence, momentum, and risk without a house bias.",
      },
      {
        title: "Low ego, high utility",
        detail:
          "You fill whatever role the team is missing this quarter — competently and without drama.",
      },
      {
        title: "Steady in mixed weather",
        detail:
          "No single stressor owns you; your resilience is diversified like your style.",
      },
    ],
    blindSpots: [
      {
        title: "Edge without a signature",
        detail:
          "Specialists get remembered; integrators get relied on quietly. Manage your visibility deliberately.",
      },
      {
        title: "Every side has a point",
        detail:
          "Your empathy for all positions can postpone the moment you must take one.",
      },
      {
        title: "Adaptation as camouflage",
        detail:
          "Mirroring the room too well, you can lose track of what you independently think.",
      },
      {
        title: "Utility-player trap",
        detail:
          "Filling every gap keeps you from compounding mastery in any single arena.",
      },
    ],
    communication: {
      do: [
        "Engage them as a thinking partner across the whole problem",
        "Ask what they'd do — then ask what they think, separately",
        "Use them to pressure-test messages for different audiences",
        "Give them integrative roles in conflicts and negotiations",
        "Push them to declare a position once options are mapped",
      ],
      dont: [
        "Box them into one narrow style and judge them by it",
        "Read their flexibility as absence of conviction",
        "Let them permanently absorb whatever role is vacant",
        "Skip their input because they didn't fight for airtime",
        "Assume they'll self-promote; their work rarely shouts",
      ],
    },
    leadershipStyle: {
      headline: "Leadership as integration",
      description:
        "You lead by making different kinds of excellent people work as one system — translating, balancing, and unblocking. The stretch is decisive identity: your team knows you understand everything; make sure they also know where you stand.",
      bullets: [
        "State your own position first in one decision per week",
        "Pick one domain for deliberate, compounding depth",
        "Make your integrative work visible — narrate what you prevented",
      ],
    },
    stressResponse: {
      triggers: [
        "Being pulled in all four directions by competing stakeholders",
        "Pressure to be someone's caricature instead of yourself",
        "Chronic invisibility of your balancing work",
      ],
      behaviors: [
        "Over-adapts until your own signal disappears",
        "Defers commitment while mapping yet another perspective",
        "Quietly absorbs whatever dysfunction no one else will hold",
      ],
      recovery: [
        "Solitude to hear your own opinion again",
        "One unambiguous personal commitment, publicly made",
        "Prune roles: name what you're no longer willing to absorb",
      ],
    },
    idealEnvironment: [
      "Cross-functional work that rewards range",
      "A seat at decisions, not just translations of them",
      "Teams diverse enough to need a bridge",
      "Leaders who value glue work out loud",
      "Room to go deep in one chosen domain",
    ],
    communicationStyle: [
      "Matches register to the listener — data for the skeptic, story for the room",
      "Translates between styles that talk past each other",
      "Strong opinions delivered with genuine openness",
      "Sometimes so adaptive the personal position goes unstated",
    ],
    conflictResponse: {
      headline: "Mediates by instinct",
      description:
        "You see every side early and move to broker. It resolves most conflicts well — and hides the fact that sometimes you were a party, not the mediator.",
      tips: [
        "Declare when you're a stakeholder, then advocate as one",
        "Don't split differences that deserve a winner",
        "Your synthesis is a position — defend it like one",
      ],
    },
    motivators: [
      "Cross-functional problems that need range",
      "A seat at the decision, not just the translation",
      "Diverse teams that need a bridge",
      "Space to go deep in one chosen domain",
    ],
    drainers: [
      "Being pulled in four directions by competing stakeholders",
      "Glue work rendered invisible",
      "Pressure to become someone's caricature",
      "Chronic role ambiguity",
    ],
    coaching:
      "Choose a signature: one domain where you compound depth, and one meeting per week where you state your position first. Your range is already rare — anchored to a visible edge and a declared point of view, it becomes leadership.",
    complementaryTypes: [
      {
        code: "D",
        reason:
          "Provides the unambiguous edge and forcing function your balance tempers.",
      },
      {
        code: "C",
        reason:
          "Anchors your versatility with depth and uncompromising standards.",
      },
    ],
  },
};

export function getInsight(code: ArchetypeCode): ArchetypeInsight {
  return insightMap[code];
}
