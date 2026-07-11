import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/db/server";
import {
  acceptInvitationToken,
  acceptTeamLink,
} from "@/lib/actions/invitations";
import { BrandMark } from "@/components/marketing/BrandMark";
import { LinkButton } from "@/components/ui/LinkButton";

export const metadata: Metadata = { title: "Join team" };

export default async function JoinTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-up?next=/join/${token}`);

  // The token may be a personal invitation or a team's reusable link.
  let result = await acceptInvitationToken(token);
  if (!result.ok && result.error === "This invitation link is not valid.") {
    result = await acceptTeamLink(token);
  }

  if (result.ok && result.teamId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", user.id)
      .single();
    redirect(profile?.onboarded_at ? `/app/teams/${result.teamId}` : "/onboarding");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-[72px] w-full max-w-7xl items-center px-5 sm:px-8">
        <BrandMark />
      </header>
      <main className="flex flex-1 items-center justify-center px-5">
        <div className="paper-card flex w-full max-w-md flex-col items-center gap-5 p-10 text-center">
          <h1 className="font-display text-h3 font-semibold">
            This invitation can&rsquo;t be used
          </h1>
          <p className="text-sm leading-relaxed text-slate">
            {result.error ?? "Something went wrong accepting this invitation."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <LinkButton href="/app">Go to your dashboard</LinkButton>
            <Link
              href="/contact"
              className="self-center text-sm text-slate hover:text-ink"
            >
              Contact support
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
