import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { removeMember, resendInvitation } from "@/lib/actions/teams";
import { sendParticipantReport } from "@/lib/actions/reports";
import { participantStatusMeta } from "@/lib/teams/status";
import { displayArchetypeCode } from "@/lib/utils/display";
import type { ParticipantRow } from "@/lib/teams/roster";

const toneStyles: Record<string, string> = {
  neutral: "bg-ink/5 text-slate",
  blue: "bg-disc-c-soft text-disc-c",
  amber: "bg-disc-i-soft text-disc-i",
  green: "bg-disc-s-soft text-disc-s",
  teal: "bg-sage/50 text-botanical",
};

async function emailParticipantReport(teamId: string, resultId: string): Promise<void> {
  "use server";
  await sendParticipantReport(teamId, resultId);
  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/app/teams/${teamId}/dashboard`);
}

const actionChip =
  "rounded-full border border-hairline px-3 py-1 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical";

export function ParticipantTable({
  teamId,
  participants,
}: {
  teamId: string;
  participants: ParticipantRow[];
}) {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="paper-card overflow-x-auto p-0">
      <table className="w-full min-w-[860px] text-left text-sm">
        <caption className="sr-only">Participants and their assessment status</caption>
        <thead>
          <tr className="border-b border-hairline font-mono text-[11px] uppercase tracking-wide text-faint">
            <th className="px-5 py-3 font-medium">Participant</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 font-medium">Type</th>
            <th className="px-3 py-3 font-medium">Completed</th>
            <th className="px-3 py-3 font-medium">Report</th>
            <th className="px-5 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {participants.map((participant) => {
            const status = participantStatusMeta[participant.status];
            return (
              <tr key={participant.memberId}>
                <td className="px-5 py-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-ink">
                      {participant.name}
                      {participant.role === "team_admin" ? (
                        <span className="ml-2 font-mono text-[10px] text-faint">ADMIN</span>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-slate">{participant.email}</span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
                      toneStyles[status.tone],
                    )}
                  >
                    {status.label}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {participant.archetypeCode ? (
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-ink">
                        {participant.archetypeName}
                      </span>
                      <span className="font-mono text-[10px] text-faint">
                        {displayArchetypeCode(participant.archetypeCode)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-faint">—</span>
                  )}
                </td>
                <td className="px-3 py-3 font-mono text-xs text-faint">
                  {participant.completedAt ? formatDate(participant.completedAt) : "—"}
                </td>
                <td className="px-3 py-3">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-faint">
                    {participant.status === "report_sent"
                      ? "Sent"
                      : participant.resultId
                        ? "Not sent"
                        : "—"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {participant.resultId ? (
                      <>
                        <Link
                          href={`/app/teams/${teamId}/results`}
                          className={actionChip}
                        >
                          View result
                        </Link>
                        <form action={emailParticipantReport.bind(null, teamId, participant.resultId)}>
                          <button type="submit" className={actionChip}>
                            {participant.status === "report_sent" ? "Resend report" : "Email report"}
                          </button>
                        </form>
                      </>
                    ) : participant.invitationId ? (
                      <form action={resendInvitation.bind(null, teamId, participant.invitationId)}>
                        <button type="submit" className={actionChip}>
                          Resend invitation
                        </button>
                      </form>
                    ) : null}
                    <form action={removeMember.bind(null, teamId, participant.memberId)}>
                      <button
                        type="submit"
                        className="rounded-full border border-hairline px-3 py-1 text-xs text-slate transition-colors hover:border-disc-d hover:text-disc-d"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
