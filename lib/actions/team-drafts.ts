"use server";

import { z } from "zod";
import { requireOnboarded } from "@/lib/auth/guards";

/**
 * Team-creation draft persistence.
 *
 * The wizard writes each completed step here rather than holding it in the
 * browser, so the journey survives the two boundaries that used to destroy it:
 * signing in, and paying. Everything is owner-scoped through the caller's own
 * RLS-bound client — a draft is never addressed by id from the client without
 * the database re-checking ownership.
 */

export interface TeamDraft {
  id: string;
  organizationName: string;
  teamName: string;
  sessionName: string;
  department: string;
  approximateSize: number | null;
  timezone: string;
  deadlineAt: string;
  resultsNamed: boolean;
  membersCanViewSummary: boolean;
  participantLimit: number | null;
  assessmentType: "disc" | "focus" | "combined";
}

const stepOneSchema = z.object({
  assessment_type: z.enum(["disc", "focus", "combined"]),
  team_name: z.string().trim().min(2, "Give the team a name.").max(120),
  organization_name: z
    .string()
    .trim()
    .min(2, "Add the organization or company name.")
    .max(120),
  session_name: z.string().trim().max(120).optional().or(z.literal("")),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  approximate_size: z.coerce
    .number()
    .int()
    .min(2, "A team needs at least 2 people.")
    .max(500)
    .optional(),
});

const stepTwoSchema = z.object({
  deadline_at: z.string().optional().or(z.literal("")),
  timezone: z.string().trim().max(80).optional().or(z.literal("")),
  results_named: z.enum(["named", "anonymized"]),
  members_can_view_summary: z.string().optional(),
  participant_limit: z.coerce.number().int().min(1).max(1000).optional(),
});

export interface DraftState {
  status: "idle" | "error";
  message: string;
}

const EMPTY_DRAFT: TeamDraft = {
  id: "",
  organizationName: "",
  teamName: "",
  sessionName: "",
  department: "",
  approximateSize: null,
  timezone: "",
  deadlineAt: "",
  resultsNamed: false,
  membersCanViewSummary: true,
  participantLimit: null,
  assessmentType: "disc",
};

interface DraftRow {
  id: string;
  organization_name: string;
  team_name: string;
  session_name: string | null;
  department: string | null;
  approximate_size: number | null;
  timezone: string | null;
  deadline_at: string | null;
  results_named: boolean;
  members_can_view_summary: boolean;
  participant_limit: number | null;
  assessment_type: "disc" | "focus" | "combined";
}

const toDraft = (row: DraftRow): TeamDraft => ({
  id: row.id,
  organizationName: row.organization_name,
  teamName: row.team_name,
  sessionName: row.session_name ?? "",
  department: row.department ?? "",
  approximateSize: row.approximate_size,
  timezone: row.timezone ?? "",
  // A date input needs YYYY-MM-DD, not an ISO timestamp.
  deadlineAt: row.deadline_at ? row.deadline_at.slice(0, 10) : "",
  resultsNamed: row.results_named,
  membersCanViewSummary: row.members_can_view_summary,
  participantLimit: row.participant_limit,
  assessmentType: row.assessment_type,
});

const DRAFT_COLUMNS =
  "id, organization_name, team_name, session_name, department, approximate_size, timezone, deadline_at, results_named, members_can_view_summary, participant_limit, assessment_type";

/**
 * The caller's open draft, or an empty one. Only the newest live draft is
 * used: an abandoned older draft must never silently repopulate the wizard.
 */
export async function getOrCreateDraft(): Promise<TeamDraft> {
  const { supabase, user } = await requireOnboarded();

  const { data: existing } = await supabase
    .from("team_creation_drafts")
    .select(DRAFT_COLUMNS)
    .eq("owner_profile_id", user.id)
    .eq("status", "draft")
    .gt("expires_at", new Date().toISOString())
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return toDraft(existing as DraftRow);

  const { data: created } = await supabase
    .from("team_creation_drafts")
    .insert({ owner_profile_id: user.id })
    .select(DRAFT_COLUMNS)
    .single();

  return created ? toDraft(created as DraftRow) : EMPTY_DRAFT;
}

/** Saves step 1. Returns the field-level message on failure. */
export async function saveDraftStepOne(
  _prev: DraftState,
  formData: FormData,
): Promise<DraftState> {
  const parsed = stepOneSchema.safeParse({
    assessment_type: formData.get("assessment_type"),
    team_name: formData.get("team_name"),
    organization_name: formData.get("organization_name"),
    session_name: formData.get("session_name"),
    department: formData.get("department"),
    approximate_size: formData.get("approximate_size") || undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the team details.",
    };
  }

  const { supabase, user } = await requireOnboarded();
  const draftId = String(formData.get("draft_id") ?? "");

  const { error } = await supabase
    .from("team_creation_drafts")
    .update({
      team_name: parsed.data.team_name,
      organization_name: parsed.data.organization_name,
      session_name: parsed.data.session_name || null,
      department: parsed.data.department || null,
      approximate_size: parsed.data.approximate_size ?? null,
      assessment_type: parsed.data.assessment_type,
    })
    .eq("id", draftId)
    // Ownership re-checked in the predicate, not assumed from the client id.
    .eq("owner_profile_id", user.id)
    .eq("status", "draft");

  if (error) return { status: "error", message: "Could not save — please try again." };
  return { status: "idle", message: "" };
}

/** Saves step 2. */
export async function saveDraftStepTwo(
  _prev: DraftState,
  formData: FormData,
): Promise<DraftState> {
  const parsed = stepTwoSchema.safeParse({
    deadline_at: formData.get("deadline_at"),
    timezone: formData.get("timezone"),
    results_named: formData.get("results_named"),
    members_can_view_summary: formData.get("members_can_view_summary") ?? undefined,
    participant_limit: formData.get("participant_limit") || undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the assessment settings.",
    };
  }

  const { supabase, user } = await requireOnboarded();
  const draftId = String(formData.get("draft_id") ?? "");

  const { error } = await supabase
    .from("team_creation_drafts")
    .update({
      deadline_at: parsed.data.deadline_at
        ? new Date(parsed.data.deadline_at).toISOString()
        : null,
      timezone: parsed.data.timezone || null,
      results_named: parsed.data.results_named === "named",
      members_can_view_summary: parsed.data.members_can_view_summary === "on",
      participant_limit: parsed.data.participant_limit ?? null,
    })
    .eq("id", draftId)
    .eq("owner_profile_id", user.id)
    .eq("status", "draft");

  if (error) return { status: "error", message: "Could not save — please try again." };
  return { status: "idle", message: "" };
}
