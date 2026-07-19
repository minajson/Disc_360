import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/server";
import { getJoinContext } from "@/lib/join/context";
import {
  acceptInvitationToken,
  acceptTeamLink,
} from "@/lib/actions/invitations";
import { mediaUrl } from "@/lib/utils/media";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { LinkButton } from "@/components/ui/LinkButton";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import { JoinForm } from "@/components/join/JoinForm";

export const metadata: Metadata = {
  title: "Join team",
  robots: { index: false, follow: false },
};

const formatDeadline = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });

export default async function JoinTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await getJoinContext(token);

  // Signed-in visitors never re-register. A not-yet-onboarded account (e.g.
  // fresh Google sign-in) carries the invitation into onboarding — consent
  // comes BEFORE membership, and the team code is never asked for. An
  // onboarded account joins directly and lands on the session.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && context && !context.blocked) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", user.id)
      .single();
    if (!profile?.onboarded_at) redirect(`/onboarding?join=${token}`);

    let result = await acceptInvitationToken(token);
    if (!result.ok && result.error === "This invitation link is not valid.") {
      result = await acceptTeamLink(token);
    }
    if (result.ok && result.teamId) redirect("/app");
  }

  if (!context || context.blocked) {
    return (
      <JoinShell token={token}>
        <div className="paper-card mx-auto flex w-full max-w-md flex-col items-center gap-5 p-10 text-center">
          <h1 className="font-display text-h3 font-semibold">
            This link can&rsquo;t be used
          </h1>
          <p className="text-sm leading-relaxed text-slate">
            {context?.blocked ??
              "This join link is not valid — check it with the person who shared it."}
          </p>
          <LinkButton href="/">Go to DISC360</LinkButton>
        </div>
      </JoinShell>
    );
  }

  const cover = mediaUrl(context.coverPath);

  return (
    <JoinShell token={token}>
      <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-start">
        {/* team identity */}
        <div className="flex flex-col gap-6">
          {cover ? (
            <figure className="relative aspect-video w-full overflow-hidden rounded-editorial">
              <Image src={cover} alt="" fill className="object-cover" sizes="(max-width:1024px) 100vw, 40vw" />
            </figure>
          ) : (
            <MediaPlaceholder
              mediaId="MEDIA-TEAM-COVER-01"
              label="Optional organisation or team event cover"
              ratio="16/9"
              kind="photo"
              dimensions="1600×900"
            />
          )}

          <div className="flex flex-col gap-3">
            <Eyebrow>You&rsquo;re invited</Eyebrow>
            <h1 className="font-display text-h1 font-semibold">{context.teamName}</h1>
            <div className="flex flex-col gap-0.5 font-mono text-xs text-faint">
              {context.organizationName ? <span>{context.organizationName}</span> : null}
              {context.clientOrganization ? <span>for {context.clientOrganization}</span> : null}
              {context.sessionName ? <span>{context.sessionName}</span> : null}
              {context.presenterName ? (
                <span>
                  Facilitated by {context.presenterName}
                  {context.presenterTitle ? ` · ${context.presenterTitle}` : ""}
                </span>
              ) : null}
              {context.deadlineAt ? (
                <span>Please complete by {formatDeadline(context.deadlineAt)}</span>
              ) : null}
            </div>
            <p className="max-w-md text-sm leading-relaxed text-slate">
              You have been invited to complete the DISC360 assessment for
              this team. 24 quick scenarios, about seven minutes — your
              individual answers stay private.
            </p>
          </div>
        </div>

        {/* registration */}
        <JoinForm token={token} invitedEmail={context.invitedEmail} />
      </div>
    </JoinShell>
  );
}

function JoinShell({ token, children }: { token?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-[72px] w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <BrandLogo />
        {/* The pending invitation must survive sign-in (incl. Google OAuth). */}
        <Link
          href={token ? `/sign-in?next=/join/${token}` : "/sign-in"}
          className="text-sm text-slate hover:text-ink"
        >
          Have an account? Sign in
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-5 py-10 sm:px-8">
        {children}
      </main>
      <footer className="pb-8 text-center font-mono text-[11px] text-faint">
        DISC360 · a development tool, not a diagnostic instrument
      </footer>
    </div>
  );
}
