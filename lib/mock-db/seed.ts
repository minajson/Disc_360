import type { Result, Team, TeamMember, User } from "@/lib/types";
import {
  DEMO_USER_ID,
  demoResults,
  demoTeam,
  demoTeamMembers,
} from "@/data/team-demo-data";

/** Rows guaranteed to exist in the mock DB on first load. */
export const seedData: {
  user: User;
  team: Team;
  teamMembers: TeamMember[];
  results: Result[];
} = {
  user: {
    id: DEMO_USER_ID,
    email: "demo@disc360.app",
    name: "Demo User",
    role: "INDIVIDUAL",
    createdAt: "2026-06-01T09:00:00.000Z",
  },
  team: demoTeam,
  teamMembers: demoTeamMembers,
  results: demoResults,
};
