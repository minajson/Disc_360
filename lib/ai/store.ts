import "server-only";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { createSupabaseServerClient } from "@/lib/db/server";
import { narrativeSchema } from "./schema";
import type { Json } from "@/lib/db/types";
import type { Narrative } from "./narrative";

/**
 * Reading and writing the stored narrative.
 *
 * Every query runs through the RLS-scoped client, so a facilitator can only
 * reach a draft for a team they administer — the policy is the authorization,
 * not a check in this file that a future refactor could drop.
 *
 * The stored JSON is validated on the way out as well as on the way in. A row
 * written by an older version of the schema, or edited by hand, degrades to
 * "no narrative" and the deterministic surface renders — never a runtime crash
 * in front of a room.
 */

/**
 * A `Narrative` is a closed interface, so it is not structurally a `Json`
 * object even though every field in it is. Round-tripping is exactly what the
 * driver does on the way to Postgres, so this does no more than say so in the
 * type system.
 */
const asJson = (narrative: Narrative): Json => JSON.parse(JSON.stringify(narrative)) as Json;

export interface StoredNarrative {
  narrative: Narrative;
  status: "draft" | "shared";
  source: "model" | "rules" | "edited";
  model: string | null;
  sampleSize: number;
  populationSize: number;
  fellBack: string[];
  generatedAt: string;
  editedAt: string | null;
  sharedAt: string | null;
}

export async function readNarrative(teamId: string): Promise<StoredNarrative | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ai_insight_narratives")
    .select(
      "narrative, status, source, model, sample_size, population_size, fell_back, generated_at, edited_at, shared_at",
    )
    .eq("team_id", teamId)
    .maybeSingle();

  if (!data) return null;

  const parsed = narrativeSchema.safeParse(data.narrative);
  if (!parsed.success) return null;

  return {
    narrative: parsed.data,
    status: data.status,
    source: data.source,
    model: data.model,
    sampleSize: data.sample_size,
    populationSize: data.population_size,
    fellBack: data.fell_back ?? [],
    generatedAt: data.generated_at,
    editedAt: data.edited_at,
    sharedAt: data.shared_at,
  };
}

export interface WriteNarrativeInput {
  teamId: string;
  actorId: string;
  narrative: Narrative;
  source: "model" | "rules" | "edited";
  model: string | null;
  sampleSize: number;
  populationSize: number;
  fellBack: string[];
}

/**
 * Replaces the team's draft.
 *
 * Regenerating resets the lifecycle: a new draft is a draft, never silently
 * still "shared" — approval attaches to prose someone read, not to the row.
 */
export async function writeNarrative(input: WriteNarrativeInput): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("ai_insight_narratives").upsert(
    {
      team_id: input.teamId,
      status: "draft",
      source: input.source,
      model: input.model,
      narrative: asJson(input.narrative),
      sample_size: input.sampleSize,
      population_size: input.populationSize,
      fell_back: input.fellBack,
      generated_by: input.actorId,
      generated_at: new Date().toISOString(),
      edited_by: null,
      edited_at: null,
      shared_by: null,
      shared_at: null,
    },
    { onConflict: "team_id" },
  );
  return !error;
}

/** Saves a facilitator's edits. Marks the prose as edited, not as generated. */
export async function saveEditedNarrative(input: {
  teamId: string;
  actorId: string;
  narrative: Narrative;
}): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("ai_insight_narratives")
    .update({
      narrative: asJson(input.narrative),
      source: "edited",
      edited_by: input.actorId,
      edited_at: new Date().toISOString(),
    })
    .eq("team_id", input.teamId);
  return !error;
}

/** Marks the draft approved for use with other facilitators of this team. */
export async function shareNarrative(input: {
  teamId: string;
  actorId: string;
  shared: boolean;
}): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("ai_insight_narratives")
    .update({
      status: input.shared ? "shared" : "draft",
      shared_by: input.shared ? input.actorId : null,
      shared_at: input.shared ? new Date().toISOString() : null,
    })
    .eq("team_id", input.teamId);
  return !error;
}

export async function deleteNarrative(teamId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("ai_insight_narratives")
    .delete()
    .eq("team_id", teamId);
  return !error;
}

/**
 * Generations by one facilitator inside the rolling window.
 *
 * Counted from audit rows so the limit survives a cold start and holds across
 * every instance serving the app.
 */
export async function generationsInWindow(
  actorId: string,
  windowMs: number,
): Promise<number> {
  // RLS bypass justified: audit_logs is readable by platform admins only, and
  // this counts the caller's OWN rows for their own rate limit. actor_id is
  // the id the guard resolved server-side — never a value from the client —
  // so this cannot be pointed at anyone else's activity.
  const supabase = createSupabaseAdminClient();
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count } = await supabase
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", actorId)
    .eq("action", "ai_narrative.generated")
    .gte("created_at", since);
  return count ?? 0;
}
