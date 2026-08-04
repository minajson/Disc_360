import type { Metadata } from "next";
import { getTeamInsights } from "@/lib/insights/team-insights";
import { FacilitatorInsightsView } from "@/components/teams/insights/FacilitatorInsightsView";
import { NarrativePanel } from "@/components/teams/insights/NarrativePanel";
import { aiConfigured } from "@/lib/ai/client";
import { readNarrative } from "@/lib/ai/store";
import {
  applyNarrative,
  rulesBrief,
  rulesNarrative,
  rulesSummary,
} from "@/lib/ai/narrative";

export const metadata: Metadata = { title: "Facilitator insights" };

/**
 * Facilitator scope, single team. getTeamInsights authorizes the viewer and
 * resolves every profile from this teamId alone.
 *
 * The deterministic set is computed first and is what the page falls back to.
 * A stored narrative is then laid over it card by card — prose only, and only
 * where the prose still passes the register check. So the page is correct
 * before any model is consulted, and stays correct if one wrote something it
 * should not have.
 */
export default async function TeamInsightsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const payload = await getTeamInsights(teamId);

  if ("error" in payload) {
    return (
      <div className="paper-card p-8 text-sm leading-relaxed text-slate">
        {payload.error}
      </div>
    );
  }

  const stored = payload.set.suppressed ? null : await readNarrative(teamId);
  const applied = stored ? applyNarrative(payload.set, stored.narrative) : null;
  const set = applied?.set ?? payload.set;
  // Marked on the provenance of the stored draft, not on how many cards
  // survived screening: if a model wrote any part of what is on this page, the
  // page says so. Erring towards labelling is the only safe direction.
  const narrated = stored !== null && stored.source !== "rules";

  return (
    <FacilitatorInsightsView
      set={set}
      departments={payload.departments}
      teamName={payload.teamName}
      memberCount={payload.memberCount}
      completedCount={payload.completedCount}
      aiGenerated={narrated}
      brief={stored?.narrative.brief ?? rulesBrief(payload.set)}
      summary={stored?.narrative.summary ?? rulesSummary(payload.set)}
      controls={
        payload.set.suppressed ? null : (
          <NarrativePanel
            teamId={teamId}
            configured={aiConfigured()}
            narrative={stored?.narrative ?? rulesNarrative(payload.set)}
            state={
              stored
                ? {
                    source: stored.source,
                    status: stored.status,
                    model: stored.model,
                    generatedAt: stored.generatedAt,
                    editedAt: stored.editedAt,
                    sharedAt: stored.sharedAt,
                    fellBack: stored.fellBack,
                    // Prose written against a smaller cohort is stale the
                    // moment another participant finishes, and the page says
                    // so rather than pairing new figures with old sentences.
                    stale:
                      stored.sampleSize !== payload.completedCount ||
                      stored.populationSize !== payload.memberCount,
                  }
                : null
            }
          />
        )
      }
    />
  );
}
