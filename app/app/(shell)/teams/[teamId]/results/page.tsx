import type { Metadata } from "next";
import { getTeamIntelligence } from "@/lib/insights/team";
import {
  balanceVerdict,
  behaviourDistribution,
  communicationTendencies,
  decisionStyle,
  strengthDistribution,
  type BoardProfile,
} from "@/lib/insights/board";
import { TeamIntelligenceReport } from "@/components/teams/TeamIntelligenceReport";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { mediaUrl } from "@/lib/utils/media";
import { TeamIntelligenceView } from "@/components/teams/TeamIntelligenceView";

export const metadata: Metadata = { title: "Team intelligence" };

export default async function TeamResultsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const data = await getTeamIntelligence(teamId);

  if ("error" in data) {
    return (
      <div className="paper-card p-8 text-sm leading-relaxed text-slate">
        {data.error}
      </div>
    );
  }

  // Optional facilitator credit: the team creator's coach profile.
  const admin = createSupabaseAdminClient();
  const { data: team } = await admin
    .from("teams")
    .select("created_by")
    .eq("id", teamId)
    .single();
  const { data: coach } = team
    ? await admin
        .from("coach_profiles")
        .select("title, organization, photo_path, show_in_presentation, profiles (full_name)")
        .eq("profile_id", team.created_by)
        .maybeSingle()
    : { data: null };
  const coachName = Array.isArray(coach?.profiles)
    ? coach?.profiles[0]?.full_name
    : coach?.profiles?.full_name;
  const facilitatorPhoto = mediaUrl(coach?.photo_path);

  // Every figure in the report comes from the same pure, tested board metrics
  // the executive brief uses, so the two can never disagree — and nothing is
  // recomputed inside a component.
  const boardProfiles: BoardProfile[] = data.profiles.map((profile) => ({
    scores: profile.scores,
    primary: profile.primary,
    archetypeCode: profile.archetypeCode,
    department: profile.department,
  }));

  return (
    <>
      {/* Screen: the interactive report, unchanged. */}
      <div className="print:hidden">
        <TeamIntelligenceView data={data} />
      </div>

      {/* Print: the designed seven-page document. Rendered here rather than
          swapped in by JavaScript so an export is deterministic — and kept
          out of the accessibility tree on screen, where the live view is the
          real thing. */}
      <div className="hidden print:block" aria-hidden>
        <TeamIntelligenceReport
          data={{
            teamName: data.teamName,
            named: data.named,
            memberCount: data.memberCount,
            completedCount: data.completedCount,
            averages: data.averages,
            composition: data.composition,
            profiles: data.profiles,
            cultureSummary: data.cultureSummary,
            pressureShift: data.pressureShift,
            narrative: data.narrative,
            communicationGaps: data.communicationGaps,
            riskZones: data.riskZones,
            actions: data.actions,
            balance: balanceVerdict(data.averages),
            distribution: behaviourDistribution(boardProfiles),
            strength: strengthDistribution(boardProfiles),
            tendencies: communicationTendencies(boardProfiles),
            decision: decisionStyle(data.averages),
          }}
        />
      </div>
      {coach?.show_in_presentation && coachName ? (
        <footer className="flex items-center gap-3 rule-t pt-6 print:hidden">
          {facilitatorPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- storage-hosted
            <img src={facilitatorPhoto} alt="" className="size-10 rounded-full object-cover" />
          ) : null}
          <p className="text-sm text-slate">
            Facilitated by <span className="font-medium text-ink">{coachName}</span>
            {coach.title ? ` · ${coach.title}` : ""}
            {coach.organization ? ` · ${coach.organization}` : ""}
          </p>
        </footer>
      ) : null}
    </>
  );
}
