import type { Metadata } from "next";
import { requireTeamAdmin } from "@/lib/auth/guards";
import {
  removeMember,
  resendInvitation,
  revokeInvitation,
} from "@/lib/actions/teams";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  AddMemberForm,
  ImportCsvForm,
  MemberEditor,
} from "@/components/teams/MemberForms";

export const metadata: Metadata = { title: "Members" };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function TeamMembersPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { supabase } = await requireTeamAdmin(teamId);

  const [{ data: team }, { data: members }, { data: invitations }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("team_code, invite_token")
        .eq("id", teamId)
        .single(),
      supabase
        .from("team_members")
        .select("id, display_name, email, department, role, profile_id")
        .eq("team_id", teamId)
        .order("display_name"),
      supabase
        .from("invitations")
        .select("id, email, status, send_count, last_sent_at, expires_at")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false }),
    ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const inviteLink = `${siteUrl}/join/${team?.invite_token}`;
  const pending = (invitations ?? []).filter((i) => i.status === "pending");
  const inactive = (invitations ?? []).filter((i) => i.status !== "pending" && i.status !== "accepted");

  return (
    <>
      {/* invite surface */}
      <section aria-label="Invitation link and code" className="paper-card flex flex-wrap items-center gap-3 p-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Reusable invitation
          </span>
          <span className="truncate text-sm text-slate">{inviteLink}</span>
        </div>
        <CopyButton value={inviteLink} label="Copy invite link" />
        <CopyButton value={team?.team_code ?? ""} label={`Code ${team?.team_code}`} />
      </section>

      {/* roster */}
      <section aria-labelledby="roster-heading" className="flex flex-col gap-4">
        <h2 id="roster-heading" className="font-display text-h3 font-semibold">
          Roster · {members?.length ?? 0}
        </h2>
        <div className="paper-card divide-y divide-hairline p-0">
          {(members ?? []).map((member) => (
            <div key={member.id} className="relative flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4">
              <div className="flex min-w-0 flex-1 basis-48 flex-col">
                <span className="truncate text-sm font-medium text-ink">
                  {member.display_name}
                </span>
                <span className="truncate text-xs text-slate">{member.email}</span>
              </div>
              <span className="hidden w-32 truncate text-xs text-slate sm:block">
                {member.department ?? "—"}
              </span>
              <span className="w-16 font-mono text-[11px] text-faint">
                {member.role === "team_admin" ? "ADMIN" : member.profile_id ? "JOINED" : "INVITED"}
              </span>
              <div className="flex items-center gap-2">
                <MemberEditor teamId={teamId} member={member} />
                <form action={removeMember.bind(null, teamId, member.id)}>
                  <button
                    type="submit"
                    className="rounded-full border border-hairline px-3.5 py-1.5 text-xs text-slate transition-colors hover:border-disc-d hover:text-disc-d"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* add + import */}
      <section aria-labelledby="add-heading" className="grid gap-5 lg:grid-cols-2">
        <div className="paper-card flex flex-col gap-4 p-7">
          <h2 id="add-heading" className="font-display text-base font-semibold">
            Add a member
          </h2>
          <AddMemberForm teamId={teamId} />
        </div>
        <div className="paper-card flex flex-col gap-4 p-7">
          <ImportCsvForm teamId={teamId} />
        </div>
      </section>

      {/* invitations */}
      <section aria-labelledby="invitations-heading" className="flex flex-col gap-4">
        <h2 id="invitations-heading" className="font-display text-h3 font-semibold">
          Email invitations
        </h2>
        {pending.length > 0 ? (
          <div className="paper-card divide-y divide-hairline p-0">
            {pending.map((invitation) => (
              <div key={invitation.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4">
                <span className="min-w-0 flex-1 basis-48 truncate text-sm text-ink">
                  {invitation.email}
                </span>
                <span className="font-mono text-[11px] text-faint">
                  sent ×{invitation.send_count} · expires {formatDate(invitation.expires_at)}
                </span>
                <div className="flex items-center gap-2">
                  <form action={resendInvitation.bind(null, teamId, invitation.id)}>
                    <button
                      type="submit"
                      className="rounded-full border border-hairline px-3.5 py-1.5 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
                    >
                      Resend
                    </button>
                  </form>
                  <form action={revokeInvitation.bind(null, teamId, invitation.id)}>
                    <button
                      type="submit"
                      className="rounded-full border border-hairline px-3.5 py-1.5 text-xs text-slate transition-colors hover:border-disc-d hover:text-disc-d"
                    >
                      Revoke
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="paper-card p-6 text-sm text-slate">
            No pending email invitations.
          </div>
        )}
        {inactive.length > 0 ? (
          <details>
            <summary className="cursor-pointer text-sm text-slate hover:text-ink">
              {inactive.length} expired or revoked invitation{inactive.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {inactive.map((invitation) => (
                <li key={invitation.id} className="font-mono text-xs text-faint">
                  {invitation.email} · {invitation.status}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </>
  );
}
