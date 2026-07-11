import "server-only";
import { requireTeamAccess, requireTeamAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { dimensionMeta } from "@/data/dimension-meta";
import { insightMap } from "@/data/insight-maps";
import {
  DIMENSION_KEY,
  DIMENSIONS,
  type ArchetypeCode,
  type Dimension,
  type DiscScores,
} from "@/lib/types";

/**
 * Team intelligence built from completed member profiles.
 * Runs with the service role — justified: cross-member reporting is
 * deliberately impossible under RLS. Authorization happens here first
 * (team access + summary visibility), and anonymization is applied in this
 * module before anything reaches a page.
 */

export interface TeamMemberProfile {
  /** Anonymized alias or real name depending on team settings. */
  label: string;
  /** Always-available anonymous alias (Member A, B, …) for presenter toggling. */
  anonLabel: string;
  department: string | null;
  roleTitle: string | null;
  scores: DiscScores;
  archetypeCode: ArchetypeCode;
  archetypeName: string;
  primary: Dimension;
}

export interface TeamPairing {
  /** Indexes into `profiles`, so views can render named or anonymous labels. */
  aIndex: number;
  bIndex: number;
  reason: string;
}

export interface TeamNarrativeItem {
  kind: "strength" | "gap" | "balance";
  title: string;
  detail: string;
}

export interface CommunicationGap {
  between: [string, string];
  friction: string;
  bridge: string;
}

export interface RiskZone {
  severity: "high" | "watch";
  title: string;
  detail: string;
}

export interface TeamAction {
  audience: "team" | "coach";
  action: string;
}

export interface TeamIntelligence {
  teamId: string;
  teamName: string;
  named: boolean;
  viewerIsAdmin: boolean;
  departments: string[];
  memberCount: number;
  completedCount: number;
  profiles: TeamMemberProfile[];
  composition: Record<Dimension, number>;
  averages: DiscScores;
  pressureShift: string;
  cultureSummary: string;
  narrative: TeamNarrativeItem[];
  communicationGaps: CommunicationGap[];
  riskZones: RiskZone[];
  complementaryPairs: TeamPairing[];
  frictionPairs: TeamPairing[];
  actions: TeamAction[];
}

const HIGH_SCORE = 60;

function rankByScore(scores: DiscScores): Dimension[] {
  return [...DIMENSIONS].sort(
    (a, b) => scores[DIMENSION_KEY[b]] - scores[DIMENSION_KEY[a]],
  );
}

const strengthCopy: Record<Dimension, string> = {
  D: "This team pushes. Decisions get made, stalls get broken, and ambitious targets feel normal. Guard against speed outrunning verification.",
  I: "This team sells. Energy, persuasion and morale are abundant — ideas get momentum fast. Guard against enthusiasm being mistaken for commitment.",
  S: "This team holds. Follow-through, loyalty and calm are its baseline — long projects land. Guard against comfort delaying necessary change.",
  C: "This team verifies. Standards are high and errors die young. Guard against analysis stretching past the moment a decision was needed.",
};

const gapCopy: Record<Dimension, string> = {
  D: "Low Dominant coverage: confrontation and fast unilateral calls are under-supplied. Decisions may drift toward consensus by exhaustion — assign deadlock-breaking explicitly.",
  I: "Low Influence coverage: the team's work may be better than its story. Evangelism, morale and stakeholder warmth need deliberate owners.",
  S: "Low Stable coverage: plenty of spark, less ballast. Long projects risk mid-flight abandonment and quiet burnout — protect rhythms deliberately.",
  C: "Low Analytical coverage: speed and warmth without enough scrutiny. Fine print and edge cases need an explicit champion before they find you in production.",
};

const cultureTone: Record<Dimension, string> = {
  D: "a direct, outcome-first culture where pace is a value and hesitation is expensive",
  I: "an expressive, relationship-rich culture where ideas travel on enthusiasm",
  S: "a steady, loyal culture that finishes what it starts and protects its people",
  C: "a rigorous, evidence-first culture where quality is identity",
};

const pressureCopy: Record<Dimension, string> = {
  D: "expect sharper directness, unilateral calls and rising impatience — decisions accelerate while listening drops",
  I: "expect more talk and bigger promises — energy goes up while follow-through and focus scatter",
  S: "expect quiet — objections go unvoiced, strain gets absorbed silently and surfaces late",
  C: "expect retreat into analysis — more verification, slower commitment, resistance to improvised calls",
};

export async function getTeamIntelligence(
  teamId: string,
  options: { presentation?: boolean } = {},
): Promise<TeamIntelligence | { error: string }> {
  // Authorization first — presentation mode requires admin.
  const context = options.presentation
    ? await requireTeamAdmin(teamId)
    : await requireTeamAccess(teamId);

  const { data: team } = await context.supabase
    .from("teams")
    .select("id, name, results_named, members_can_view_summary")
    .eq("id", teamId)
    .single();
  if (!team) return { error: "Team not found" };

  const { data: isAdminData } = await context.supabase.rpc("is_team_admin", {
    team: teamId,
  });
  const viewerIsAdmin = Boolean(isAdminData);

  if (!viewerIsAdmin && !team.members_can_view_summary) {
    return { error: "The team summary isn't shared with members on this team." };
  }

  // Service role: cross-member results are unreadable by design under RLS.
  // Access was authorized above; anonymization is applied below.
  const admin = createSupabaseAdminClient();
  const { data: members } = await admin
    .from("team_members")
    .select("id, profile_id, display_name, department")
    .eq("team_id", teamId)
    .order("display_name");

  const profileIds = (members ?? [])
    .map((m) => m.profile_id)
    .filter((id): id is string => Boolean(id));

  const { data: results } = profileIds.length
    ? await admin
        .from("assessment_results")
        .select("profile_id, score_d, score_i, score_s, score_c, archetype_code, primary_dimension, created_at, profiles (profession)")
        .in("profile_id", profileIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Latest result per member
  const latestByProfile = new Map<string, NonNullable<typeof results>[number]>();
  for (const row of results ?? []) {
    if (!latestByProfile.has(row.profile_id)) latestByProfile.set(row.profile_id, row);
  }

  const named = team.results_named;
  let anonymousIndex = 0;

  const profiles: TeamMemberProfile[] = [];
  for (const member of members ?? []) {
    const result = member.profile_id ? latestByProfile.get(member.profile_id) : undefined;
    if (!result) continue;
    anonymousIndex += 1;
    const profileRow = Array.isArray(result.profiles) ? result.profiles[0] : result.profiles;
    const anonLabel = `Member ${String.fromCharCode(64 + anonymousIndex)}`;
    profiles.push({
      label: named ? member.display_name : anonLabel,
      anonLabel,
      department: member.department,
      roleTitle: named ? (profileRow?.profession ?? null) : null,
      scores: {
        d: result.score_d,
        i: result.score_i,
        s: result.score_s,
        c: result.score_c,
      },
      archetypeCode: result.archetype_code as ArchetypeCode,
      archetypeName: insightMap[result.archetype_code as ArchetypeCode].name,
      primary: result.primary_dimension as Dimension,
    });
  }

  const composition: Record<Dimension, number> = { D: 0, I: 0, S: 0, C: 0 };
  const totals: DiscScores = { d: 0, i: 0, s: 0, c: 0 };
  for (const profile of profiles) {
    composition[profile.primary] += 1;
    for (const dim of DIMENSIONS) {
      totals[DIMENSION_KEY[dim]] += profile.scores[DIMENSION_KEY[dim]];
    }
  }
  const count = Math.max(1, profiles.length);
  const averages: DiscScores = {
    d: Math.round(totals.d / count),
    i: Math.round(totals.i / count),
    s: Math.round(totals.s / count),
    c: Math.round(totals.c / count),
  };

  const ranked = rankByScore(averages);
  const lead = ranked[0]!;
  const second = ranked[1]!;
  const weakest = ranked[3]!;
  const spread = averages[DIMENSION_KEY[lead]] - averages[DIMENSION_KEY[weakest]];

  const cultureSummary =
    profiles.length === 0
      ? "No completed profiles yet — the culture read appears once members finish their assessments."
      : `Across ${profiles.length} completed profile${profiles.length === 1 ? "" : "s"}, this reads as ${cultureTone[lead]}, seasoned with ${dimensionMeta[second].label.toLowerCase()} energy. ${
          spread <= 15
            ? "Styles are evenly distributed, so most situations find a native speaker — the culture flexes rather than dominates."
            : `${dimensionMeta[lead].label} energy sets the tone, and the ${dimensionMeta[weakest].label.toLowerCase()} perspective has to fight for airtime.`
        }${composition[weakest] === 0 ? ` No one carries ${dimensionMeta[weakest].label} as a primary style — treat that voice as an explicit agenda item.` : ""}`;

  const narrative: TeamNarrativeItem[] = profiles.length
    ? [
        {
          kind: "strength",
          title: `Center of gravity: ${dimensionMeta[lead].label}`,
          detail: strengthCopy[lead],
        },
        {
          kind: "gap",
          title: `Coverage gap: ${dimensionMeta[weakest].label}`,
          detail: gapCopy[weakest],
        },
        {
          kind: "balance",
          title: spread <= 15 ? "Well-distributed styles" : "Concentrated style mix",
          detail:
            spread <= 15
              ? `All four dimensions sit within ${spread} points of each other — this team can meet most situations with a native speaker. The risk is dilution: make ownership of each mode explicit.`
              : `Team averages span ${spread} points between ${dimensionMeta[lead].label} and ${dimensionMeta[weakest].label}. Expect fast agreement inside the majority style — and blind spots where the minority would have objected.`,
        },
      ]
    : [];

  const highCount = (dim: Dimension) =>
    profiles.filter((p) => p.scores[DIMENSION_KEY[dim]] >= HIGH_SCORE).length;

  const communicationGaps: CommunicationGap[] = [];
  if (highCount("D") > 0 && highCount("S") > 0) {
    communicationGaps.push({
      between: ["Dominant", "Stable"],
      friction: `${highCount("D")} member${highCount("D") === 1 ? "" : "s"} run high Dominant and ${highCount("S")} run high Stable. Directness lands as aggression in one direction; deliberateness lands as resistance in the other. Watch for Stable members going quiet in rooms the Dominant members think went well.`,
      bridge:
        "Agree on decision runway: Dominant voices give advance notice of big calls; Stable voices commit to voicing objections within 48 hours instead of absorbing them.",
    });
  }
  if (highCount("I") > 0 && highCount("C") > 0) {
    communicationGaps.push({
      between: ["Influence", "Analytical"],
      friction: `${highCount("I")} member${highCount("I") === 1 ? "" : "s"} run high Influence and ${highCount("C")} run high Analytical. Enthusiasm reads as hand-waving to the Analytical side; scrutiny reads as negativity to the Influence side.`,
      bridge:
        "Split the pipeline: Influence members open doors and frame the story; Analytical members get the numbers before the meeting — and their sign-off is announced as part of the win.",
    });
  }
  if (profiles.length > 0 && communicationGaps.length === 0) {
    communicationGaps.push({
      between: ["Aligned styles", "Missing counterweights"],
      friction:
        "No high-tension style pairs sit on this roster — communication friction will be low, but so is productive friction. Agreement may come too easily.",
      bridge:
        "Import the missing voice deliberately: rotate a devil's-advocate role, or borrow a reviewer from another team for consequential decisions.",
    });
  }

  const riskZones: RiskZone[] = [];
  if (highCount("D") >= 2 && highCount("S") >= 2) {
    riskZones.push({
      severity: "high",
      title: "Conflict-style mismatch",
      detail: `A block of high-Dominant members (${highCount("D")}) shares this team with a block of high-Stable members (${highCount("S")}). Conflict will be loud on one side and silent on the other — the silent side is where resentment compounds. Make space for asynchronous, written dissent.`,
    });
  }
  if (profiles.length > 0 && (composition[weakest] === 0 || averages[DIMENSION_KEY[weakest]] <= 40)) {
    riskZones.push({
      severity: composition[weakest] === 0 ? "high" : "watch",
      title: `Low ${dimensionMeta[weakest].label} coverage`,
      detail: gapCopy[weakest],
    });
  }
  const maxPrimaries = Math.max(...DIMENSIONS.map((dim) => composition[dim]));
  const dominantStyle = DIMENSIONS.find((dim) => composition[dim] === maxPrimaries)!;
  if (profiles.length >= 4 && maxPrimaries >= Math.ceil(profiles.length / 2)) {
    riskZones.push({
      severity: "watch",
      title: `${dimensionMeta[dominantStyle].label} homogeneity`,
      detail: `${maxPrimaries} of ${profiles.length} completed profiles share ${dimensionMeta[dominantStyle].label} as their primary style. Expect fast internal agreement — and shared blind spots.`,
    });
  }
  if (profiles.length > 0 && riskZones.length === 0) {
    riskZones.push({
      severity: "watch",
      title: `Thinnest coverage: ${dimensionMeta[weakest].label}`,
      detail: `No acute risks detected — the nearest watch item is ${dimensionMeta[weakest].label} (team average ${averages[DIMENSION_KEY[weakest]]}). Assign that perspective an explicit owner on major decisions.`,
    });
  }

  // Pairings: complementary via archetype complements; friction via opposing highs.
  const complementaryPairs: TeamPairing[] = [];
  const frictionPairs: TeamPairing[] = [];
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const a = profiles[i]!;
      const b = profiles[j]!;
      const complement = insightMap[a.archetypeCode].complementaryTypes.find(
        (c) => c.code === b.archetypeCode,
      );
      if (complement && complementaryPairs.length < 4) {
        complementaryPairs.push({ aIndex: i, bIndex: j, reason: complement.reason });
      }
      const dOpposition =
        (a.scores.d >= HIGH_SCORE && b.scores.s >= HIGH_SCORE) ||
        (a.scores.s >= HIGH_SCORE && b.scores.d >= HIGH_SCORE);
      const iOpposition =
        (a.scores.i >= HIGH_SCORE && b.scores.c >= HIGH_SCORE) ||
        (a.scores.c >= HIGH_SCORE && b.scores.i >= HIGH_SCORE);
      if (dOpposition && frictionPairs.length < 4) {
        frictionPairs.push({
          aIndex: i,
          bIndex: j,
          reason:
            "Pace mismatch: one pushes for the fast call, the other protects stability. Agree decision runway up front.",
        });
      } else if (iOpposition && frictionPairs.length < 4) {
        frictionPairs.push({
          aIndex: i,
          bIndex: j,
          reason:
            "Proof mismatch: one sells the story, the other audits it. Share the data before the pitch, not during.",
        });
      }
    }
  }

  const weakestChampion = [...profiles].sort(
    (a, b) => b.scores[DIMENSION_KEY[weakest]] - a.scores[DIMENSION_KEY[weakest]],
  )[0];

  const leadActions: Record<Dimension, string> = {
    D: "Adopt a decision protocol: every major call records who was consulted and what dissent said — speed stays, silent casualties don't.",
    I: "Convert enthusiasm to commitments: every energized meeting ends with written owners, dates and a definition of done.",
    S: "Schedule deliberate change reps: one process or tool gets consciously revisited each quarter so stability doesn't harden into stagnation.",
    C: "Time-box analysis: consequential decisions get an explicit deadline and ship at 80% certainty with confidence levels attached.",
  };

  const actions: TeamAction[] = profiles.length
    ? [
        {
          audience: "team",
          action: `Give the ${dimensionMeta[weakest].label} perspective a named owner in every consequential decision${weakestChampion ? ` — ${weakestChampion.label} scores highest (${weakestChampion.scores[DIMENSION_KEY[weakest]]}) and is the natural champion` : ""}.`,
        },
        { audience: "team", action: leadActions[lead] },
        {
          audience: "team",
          action:
            "Share profiles internally: each member presents their communication do's and don'ts in one team session — style becomes vocabulary instead of friction.",
        },
        {
          audience: "coach",
          action: `Coach the ${dimensionMeta[lead].label}-leaning majority on the cost of their default: run one retrospective focused on decisions where the minority style would have changed the outcome.`,
        },
        {
          audience: "coach",
          action:
            "Pair complementary opposites on one real deliverable per quarter — pace-setters with finishers, evangelists with verifiers — and debrief what each surprised the other with.",
        },
      ]
    : [];

  return {
    teamId: team.id,
    teamName: team.name,
    named,
    viewerIsAdmin,
    departments: [...new Set((members ?? []).map((m) => m.department).filter((d): d is string => Boolean(d)))].sort(),
    memberCount: (members ?? []).length,
    completedCount: profiles.length,
    profiles,
    composition,
    averages,
    pressureShift: profiles.length
      ? `When pressure arrives, this team's center of gravity (${dimensionMeta[lead].label}) concentrates: ${pressureCopy[lead]}. The counterweight is the ${dimensionMeta[weakest].label.toLowerCase()} voice — smallest here, and most needed then.`
      : "",
    cultureSummary,
    narrative,
    communicationGaps,
    riskZones,
    complementaryPairs,
    frictionPairs,
    actions,
  };
}
