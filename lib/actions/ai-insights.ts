"use server";

import { revalidatePath } from "next/cache";
import { requireTeamAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { getTeamInsights } from "@/lib/insights/team-insights";
import { aiConfigured } from "@/lib/ai/client";
import { generateTeamNarrative } from "@/lib/ai/generate";
import { RATE_WINDOW_MS, checkNarrative, rateDecision } from "@/lib/ai/policy";
import { narrativeSchema } from "@/lib/ai/schema";
import { screenBrief, screenSummary } from "@/lib/ai/narrative";
import {
  deleteNarrative,
  generationsInWindow,
  readNarrative,
  saveEditedNarrative,
  shareNarrative,
  writeNarrative,
} from "@/lib/ai/store";

/**
 * Facilitator actions for the AI narrative layer.
 *
 * Order of operations is the same in every action and is the whole security
 * story: authorize the team first, then act, then audit. Nothing here trusts a
 * team id, a scope or a role from the client — requireTeamAdmin resolves
 * membership server-side and redirects if the caller does not administer this
 * team, so a forged teamId reaches nothing.
 *
 * What is deliberately absent: any path that publishes a narrative to
 * participants. "Share" marks a draft approved for the people who already
 * administer the team; a member has no policy granting them the row at all.
 */

export interface NarrativeActionResult {
  ok: boolean;
  error?: string;
  /** Present after a generation that fell back, for an honest notice. */
  fellBack?: string[];
  source?: "model" | "rules" | "edited";
}

/** Safe metadata only — never prose, never participant data, never the key. */
async function audit(
  actorId: string,
  action: string,
  teamId: string,
  metadata: Record<string, string | number | boolean | string[]>,
) {
  const admin = createSupabaseAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: "ai_insight_narrative",
    entity_id: teamId,
    metadata,
  });
}

/**
 * Generates (or regenerates) the narrative for one team.
 *
 * The rate limit is checked before the model is called and counted from
 * durable audit rows, so it holds across serverless instances. A refused
 * request is not an error state for the page: the deterministic insights are
 * already rendered and stay exactly as they are.
 */
export async function generateNarrative(teamId: string): Promise<NarrativeActionResult> {
  const { user } = await requireTeamAdmin(teamId);

  const used = await generationsInWindow(user.id, RATE_WINDOW_MS);
  const decision = rateDecision(used);
  if (!decision.allowed) {
    await audit(user.id, "ai_narrative.rate_limited", teamId, { used: decision.used });
    return { ok: false, error: decision.reason ?? "Rate limit reached" };
  }

  const payload = await getTeamInsights(teamId);
  if ("error" in payload) return { ok: false, error: payload.error };
  if (payload.set.suppressed) {
    return {
      ok: false,
      error:
        "There is not enough completed data in this team to write a narrative. Insights appear once more participants finish.",
    };
  }

  const outcome = await generateTeamNarrative(payload.set);

  const stored = await writeNarrative({
    teamId,
    actorId: user.id,
    narrative: outcome.narrative,
    source: outcome.source,
    model: outcome.model,
    sampleSize: payload.completedCount,
    populationSize: payload.memberCount,
    fellBack: outcome.fellBack,
  });
  if (!stored) return { ok: false, error: "Could not save the narrative" };

  await audit(user.id, "ai_narrative.generated", teamId, {
    source: outcome.source,
    model: outcome.model ?? "none",
    fell_back: outcome.fellBack,
    reason: outcome.reason ?? "ok",
    sample_size: payload.completedCount,
    population_size: payload.memberCount,
    input_tokens: outcome.usage?.input ?? 0,
    output_tokens: outcome.usage?.output ?? 0,
  });

  revalidatePath(`/app/teams/${teamId}/insights`);
  return {
    ok: true,
    source: outcome.source,
    fellBack: outcome.fellBack,
    error:
      outcome.source === "rules"
        ? aiConfigured()
          ? "The model was unavailable, so the evidence-based narrative was kept."
          : "AI narration is not configured on this deployment, so the evidence-based narrative was kept."
        : undefined,
  };
}

/**
 * Saves a facilitator's edits.
 *
 * Edited prose goes through exactly the same register checks as generated
 * prose. That is not distrust of the facilitator — it is the guarantee that
 * what the platform displays under its own name stays inside the boundaries
 * the product promises, whoever typed it.
 */
export async function saveNarrativeEdits(input: {
  teamId: string;
  narrative: unknown;
}): Promise<NarrativeActionResult> {
  const { user } = await requireTeamAdmin(input.teamId);

  const parsed = narrativeSchema.safeParse(input.narrative);
  if (!parsed.success) return { ok: false, error: "That narrative could not be read" };

  const problems = [
    ...parsed.data.cards.flatMap((card) =>
      checkNarrative({
        headline: card.headline,
        observation: card.observation,
        interpretation: card.interpretation,
      }).problems,
    ),
    ...screenBrief(parsed.data.brief),
    ...screenSummary(parsed.data.summary),
  ];
  if (problems.length > 0) {
    return {
      ok: false,
      error: `This wording is outside what the platform will publish: ${problems[0]}`,
    };
  }

  const saved = await saveEditedNarrative({
    teamId: input.teamId,
    actorId: user.id,
    narrative: parsed.data,
  });
  if (!saved) return { ok: false, error: "Could not save your edits" };

  await audit(user.id, "ai_narrative.edited", input.teamId, {
    cards: parsed.data.cards.length,
  });

  revalidatePath(`/app/teams/${input.teamId}/insights`);
  return { ok: true, source: "edited" };
}

/** Approves the draft for use by the team's other facilitators, or withdraws it. */
export async function setNarrativeShared(input: {
  teamId: string;
  shared: boolean;
}): Promise<NarrativeActionResult> {
  const { user } = await requireTeamAdmin(input.teamId);

  const existing = await readNarrative(input.teamId);
  if (!existing) return { ok: false, error: "There is no narrative to share" };

  const updated = await shareNarrative({
    teamId: input.teamId,
    actorId: user.id,
    shared: input.shared,
  });
  if (!updated) return { ok: false, error: "Could not update sharing" };

  await audit(
    user.id,
    input.shared ? "ai_narrative.shared" : "ai_narrative.unshared",
    input.teamId,
    { source: existing.source },
  );

  revalidatePath(`/app/teams/${input.teamId}/insights`);
  return { ok: true };
}

/** Discards the draft. The deterministic insights are unaffected. */
export async function discardNarrative(teamId: string): Promise<NarrativeActionResult> {
  const { user } = await requireTeamAdmin(teamId);

  const removed = await deleteNarrative(teamId);
  if (!removed) return { ok: false, error: "Could not discard the narrative" };

  await audit(user.id, "ai_narrative.discarded", teamId, {});
  revalidatePath(`/app/teams/${teamId}/insights`);
  return { ok: true };
}
