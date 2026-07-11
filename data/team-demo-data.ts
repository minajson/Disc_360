import { segmentAllIntensities } from "@/lib/scoring/intensity";
import {
  DIMENSION_KEY,
  DIMENSIONS,
  type ArchetypeCode,
  type Dimension,
  type DiscScores,
  type Result,
  type Team,
  type TeamMember,
} from "@/lib/types";

/**
 * Seeded demo team — lets the team view and results report render with
 * realistic data before any real members exist.
 */

export const DEMO_USER_ID = "usr_demo";
export const DEMO_TEAM_ID = "tem_demo";
const SEED_DATE = "2026-06-01T09:00:00.000Z";

interface DemoMemberSpec {
  slug: string;
  displayName: string;
  roleTitle: string;
  department: string;
  normalized: DiscScores;
  archetypeCode: ArchetypeCode;
}

/** Archetype codes are authored to match the scoring thresholds. */
const memberSpecs: DemoMemberSpec[] = [
  {
    slug: "amara",
    displayName: "Amara Okafor",
    roleTitle: "Head of Product",
    department: "Product",
    normalized: { d: 86, i: 54, s: 24, c: 48 },
    archetypeCode: "D",
  },
  {
    slug: "leo",
    displayName: "Leo Marchetti",
    roleTitle: "Enterprise Sales Lead",
    department: "Go-to-Market",
    normalized: { d: 76, i: 64, s: 30, c: 36 },
    archetypeCode: "DI",
  },
  {
    slug: "priya",
    displayName: "Priya Shah",
    roleTitle: "Marketing Director",
    department: "Go-to-Market",
    normalized: { d: 52, i: 82, s: 44, c: 30 },
    archetypeCode: "I",
  },
  {
    slug: "daniel",
    displayName: "Daniel Kim",
    roleTitle: "Customer Success Manager",
    department: "Go-to-Market",
    normalized: { d: 34, i: 68, s: 60, c: 40 },
    archetypeCode: "IS",
  },
  {
    slug: "sofia",
    displayName: "Sofia Reyes",
    roleTitle: "People Operations Lead",
    department: "Operations & People",
    normalized: { d: 26, i: 48, s: 84, c: 52 },
    archetypeCode: "S",
  },
  {
    slug: "marcus",
    displayName: "Marcus Bell",
    roleTitle: "QA Engineering Lead",
    department: "Engineering",
    normalized: { d: 30, i: 36, s: 66, c: 58 },
    archetypeCode: "SC",
  },
  {
    slug: "elena",
    displayName: "Elena Volkov",
    roleTitle: "Data Science Lead",
    department: "Engineering",
    normalized: { d: 40, i: 28, s: 46, c: 88 },
    archetypeCode: "C",
  },
  {
    slug: "tomas",
    displayName: "Tomás Ferreira",
    roleTitle: "Engineering Manager",
    department: "Engineering",
    normalized: { d: 62, i: 44, s: 38, c: 70 },
    archetypeCode: "CD",
  },
  {
    slug: "nia",
    displayName: "Nia Thompson",
    roleTitle: "Program Manager",
    department: "Product",
    normalized: { d: 52, i: 56, s: 58, c: 50 },
    archetypeCode: "BAL",
  },
];

function primaryAndSecondary(spec: DemoMemberSpec): {
  primary: Dimension;
  secondary: Dimension | null;
} {
  if (spec.archetypeCode === "BAL") {
    const sorted = [...DIMENSIONS].sort(
      (a, b) =>
        spec.normalized[DIMENSION_KEY[b]] - spec.normalized[DIMENSION_KEY[a]],
    );
    return { primary: sorted[0] as Dimension, secondary: null };
  }
  const [first, second] = spec.archetypeCode.split("") as [
    Dimension,
    Dimension | undefined,
  ];
  return { primary: first, secondary: second ?? null };
}

/**
 * Reconstructs internally-consistent raw tallies from a normalized profile:
 * net = norm/100 * 48 − 24, then most/least chosen so that Σmost = Σleast = 24.
 */
function buildRawScores(normalized: DiscScores): {
  rawMost: DiscScores;
  rawLeast: DiscScores;
  net: DiscScores;
} {
  const net = Object.fromEntries(
    DIMENSIONS.map((dim) => [
      DIMENSION_KEY[dim],
      Math.round((normalized[DIMENSION_KEY[dim]] / 100) * 48 - 24),
    ]),
  ) as unknown as DiscScores;

  // least_i = base_i, most_i = base_i + net_i; Σbase must equal 24 − Σnet.
  const netValues = DIMENSIONS.map((dim) => net[DIMENSION_KEY[dim]]);
  const base = netValues.map((n) => Math.max(0, -n));
  let remaining =
    24 - netValues.reduce((a, b) => a + b, 0) - base.reduce((a, b) => a + b, 0);
  let cursor = 0;
  while (remaining > 0) {
    const index = cursor % 4;
    const most = (base[index] ?? 0) + 1 + (netValues[index] ?? 0);
    if ((base[index] ?? 0) + 1 <= 24 && most <= 24 && most >= 0) {
      base[index] = (base[index] ?? 0) + 1;
      remaining -= 1;
    }
    cursor += 1;
  }

  const rawLeast = {
    d: base[0] ?? 0,
    i: base[1] ?? 0,
    s: base[2] ?? 0,
    c: base[3] ?? 0,
  };
  const rawMost = {
    d: rawLeast.d + net.d,
    i: rawLeast.i + net.i,
    s: rawLeast.s + net.s,
    c: rawLeast.c + net.c,
  };
  return { rawMost, rawLeast, net };
}

export const demoTeam: Team = {
  id: DEMO_TEAM_ID,
  name: "Atlas Demo Team",
  ownerId: DEMO_USER_ID,
  createdAt: SEED_DATE,
};

export const demoResults: Result[] = memberSpecs.map((spec) => {
  const { primary, secondary } = primaryAndSecondary(spec);
  const { rawMost, rawLeast, net } = buildRawScores(spec.normalized);
  return {
    id: `res_demo_${spec.slug}`,
    sessionId: `ses_demo_${spec.slug}`,
    userId: `usr_demo_${spec.slug}`,
    rawMost,
    rawLeast,
    net,
    normalized: spec.normalized,
    archetypeCode: spec.archetypeCode,
    primaryDimension: primary,
    secondaryDimension: secondary,
    intensity: segmentAllIntensities(spec.normalized),
    createdAt: SEED_DATE,
  };
});

export const demoTeamMembers: TeamMember[] = memberSpecs.map((spec) => ({
  id: `tmm_demo_${spec.slug}`,
  teamId: DEMO_TEAM_ID,
  userId: null,
  displayName: spec.displayName,
  roleTitle: spec.roleTitle,
  department: spec.department,
  resultId: `res_demo_${spec.slug}`,
  archetypeCode: spec.archetypeCode,
  normalized: spec.normalized,
}));
