import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { acceptInvitationToken } from "@/lib/actions/invitations";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { JoinByCodeForm } from "@/components/teams/JoinByCodeForm";

export const metadata: Metadata = { title: "Invitations" };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

async function acceptAndGo(token: string): Promise<void> {
  "use server";
  const result = await acceptInvitationToken(token);
  if (result.ok && result.teamId) redirect(`/app/teams/${result.teamId}`);
  redirect("/app/invitations");
}

export default async function InvitationsPage() {
  const { supabase, profile } = await requireOnboarded();

  // Pending invitations addressed to this account's email (RLS self-view).
  const { data: invitations } = await supabase
    .from("invitations")
    .select("id, email, status, expires_at, teams (id, name)")
    .eq("email", profile.email)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  // Tokens are read with the service role — the token itself never renders
  // to other users, and this page is scoped to the signed-in user's email.
  const admin = createSupabaseAdminClient();
  const ids = (invitations ?? []).map((i) => i.id);
  const { data: tokens } = ids.length
    ? await admin.from("invitations").select("id, token").in("id", ids)
    : { data: [] as { id: string; token: string }[] };
  const tokenById = new Map((tokens ?? []).map((row) => [row.id, row.token]));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 py-12 sm:px-8">
      <div className="flex flex-col gap-2">
        <Eyebrow>Invitations</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">Team invitations</h1>
      </div>

      {(invitations ?? []).length > 0 ? (
        <div className="paper-card divide-y divide-hairline p-0">
          {(invitations ?? []).map((invitation) => {
            const team = Array.isArray(invitation.teams)
              ? invitation.teams[0]
              : invitation.teams;
            const token = tokenById.get(invitation.id);
            return (
              <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
                <div className="flex flex-col gap-0.5">
                  <span className="font-display text-base font-semibold text-ink">
                    {team?.name ?? "A team"}
                  </span>
                  <span className="text-xs text-faint">
                    expires {formatDate(invitation.expires_at)}
                  </span>
                </div>
                {token ? (
                  <form action={acceptAndGo.bind(null, token)}>
                    <button
                      type="submit"
                      className="rounded-full bg-botanical px-6 py-2.5 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
                    >
                      Accept invitation
                    </button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="paper-card p-7 text-sm text-slate">
          No pending invitations for {profile.email}.
        </div>
      )}

      <section className="paper-card flex flex-col gap-4 p-7" aria-label="Join with a code">
        <h2 className="font-display text-base font-semibold">
          Have a team code instead?
        </h2>
        <JoinByCodeForm />
      </section>
    </div>
  );
}
