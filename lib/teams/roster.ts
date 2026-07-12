import "server-only";
import { requireTeamAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { insightMap } from "@/data/insight-maps";
import {
  deriveParticipantStatus,
  type ParticipantStatus,
} from "@/lib/teams/status";
import type { ArchetypeCode, Dimension } from "@/lib/types";

export interface ParticipantRow {
  memberId: string;
  name: string;
  email: string;
  department: string | null;
  role: string;
  status: ParticipantStatus;
  archetypeCode: ArchetypeCode | null;
  archetypeName: string | null;
  primary: Dimension | null;
  secondary: Dimension | null;
  resultId: string | null;
  completedAt: string | null;
  invitationId: string | null;
}

export interface TeamRoster {
  participants: ParticipantRow[];
  metrics: {
    invited: number;
    started: number;
    completed: number;
    pending: number;
    completionRate: number;
  };
}

/**
 * Admin-facing roster with derived statuses. Service role after the
 * requireTeamAdmin guard — the admin legitimately manages these
 * participants; raw answers are never read here.
 */
export async function getTeamRoster(teamId: string): Promise<TeamRoster> {
  await requireTeamAdmin(teamId);
  const admin = createSupabaseAdminClient();

  const { data: members } = await admin
    .from("team_members")
    .select("id, profile_id, display_name, email, department, role")
    .eq("team_id", teamId)
    .order("display_name");

  const profileIds = (members ?? [])
    .map((m) => m.profile_id)
    .filter((id): id is string => Boolean(id));
  const emails = (members ?? []).map((m) => m.email);

  const [{ data: results }, { data: sessions }, { data: reportLogs }, { data: invitations }] =
    await Promise.all([
      profileIds.length
        ? admin
            .from("assessment_results")
            .select("id, profile_id, archetype_code, primary_dimension, secondary_dimension, created_at")
            .in("profile_id", profileIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as never[] }),
      profileIds.length
        ? admin
            .from("assessment_sessions")
            .select("profile_id, status")
            .in("profile_id", profileIds)
            .eq("status", "in_progress")
        : Promise.resolve({ data: [] as never[] }),
      emails.length
        ? admin
            .from("notification_logs")
            .select("email")
            .eq("template", "report_ready")
            .in("status", ["sent", "logged"])
            .in("email", emails)
        : Promise.resolve({ data: [] as never[] }),
      admin
        .from("invitations")
        .select("id, team_member_id, status")
        .eq("team_id", teamId)
        .eq("status", "pending"),
    ]);

  const latestResultByProfile = new Map<string, NonNullable<typeof results>[number]>();
  for (const row of results ?? []) {
    if (!latestResultByProfile.has(row.profile_id)) {
      latestResultByProfile.set(row.profile_id, row);
    }
  }
  const openSessionProfiles = new Set((sessions ?? []).map((s) => s.profile_id));
  const reportedEmails = new Set((reportLogs ?? []).map((log) => log.email));
  const invitationByMember = new Map(
    (invitations ?? [])
      .filter((invitation) => invitation.team_member_id)
      .map((invitation) => [invitation.team_member_id as string, invitation.id]),
  );

  const participants: ParticipantRow[] = (members ?? []).map((member) => {
    const result = member.profile_id
      ? latestResultByProfile.get(member.profile_id)
      : undefined;
    const status = deriveParticipantStatus({
      hasProfile: Boolean(member.profile_id),
      hasOpenSession: member.profile_id
        ? openSessionProfiles.has(member.profile_id)
        : false,
      hasResult: Boolean(result),
      reportEmailed: reportedEmails.has(member.email),
    });
    const code = (result?.archetype_code as ArchetypeCode | undefined) ?? null;
    return {
      memberId: member.id,
      name: member.display_name,
      email: member.email,
      department: member.department,
      role: member.role,
      status,
      archetypeCode: code,
      archetypeName: code ? insightMap[code].name : null,
      primary: (result?.primary_dimension as Dimension | undefined) ?? null,
      secondary: (result?.secondary_dimension as Dimension | undefined) ?? null,
      resultId: result?.id ?? null,
      completedAt: result?.created_at ?? null,
      invitationId: invitationByMember.get(member.id) ?? null,
    };
  });

  const completed = participants.filter(
    (p) => p.status === "completed" || p.status === "report_sent",
  ).length;
  const started = participants.filter((p) => p.status === "started").length;
  const total = participants.length;

  return {
    participants,
    metrics: {
      invited: total,
      started,
      completed,
      pending: total - completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    },
  };
}
