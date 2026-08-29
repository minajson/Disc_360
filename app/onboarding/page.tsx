import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getJoinContext } from "@/lib/join/context";
import { campaignJoinPath, resolveCampaignByToken } from "@/lib/wellbeing/campaigns";
import { invitedJoinDestination } from "@/lib/join/destination";
import { ASSESSMENT_LABELS, type AssessmentProduct } from "@/lib/teams/session";
import { WELLBEING_PRODUCT_NAME } from "@/data/wellbeing-content";
import { BrandMark } from "@/components/marketing/BrandMark";
import { AssessmentTransitionScene } from "@/components/media/AssessmentTransitionScene";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; join?: string }>;
}) {
  const { profile } = await requireUser();
  const { intent, join } = await searchParams;

  /*
   * Arrived through a validated invitation (QR / join link → auth): resolve
   * the token again server-side and onboard into that exact campaign — the
   * team code is never asked for on this path.
   *
   * ─────────────────────────────────────────────────────────────────────
   * TWO CREDENTIAL SPACES, TRIED IN ORDER.
   *
   * A wellbeing campaign token is not a DISC team invite token, and this page
   * consulted only the DISC resolver. A participant who scanned a wellbeing QR
   * and signed up with Google therefore reached onboarding with a token that
   * resolved to nothing: no campaign name, no product label, and — worse — the
   * "already onboarded" branch below fell through to `/app`, delivering them
   * into DISC360.
   *
   * The campaign is resolved first. Only a token that is not a campaign token
   * is offered to DISC, so DISC invitations behave exactly as they did and a
   * wellbeing token never crosses into them.
   * ─────────────────────────────────────────────────────────────────────
   */
  const campaignResolution = join ? await resolveCampaignByToken(join) : null;
  const campaign = campaignResolution?.campaign ?? null;
  const joinContext = join && !campaign ? await getJoinContext(join) : null;

  // Somebody already onboarded has nothing to do on this page. Sending them to
  // /app is right for a DISC invitation and wrong for a wellbeing one — it
  // drops a Wellbeing Pulse participant onto another product's dashboard. The
  // invitation's own type decides, and the wellbeing path returns to the token,
  // which is what grants membership.
  if (profile.onboarded_at) {
    if (join && campaign) redirect(campaignJoinPath(join));
    redirect(
      join && joinContext && !joinContext.blocked
        ? invitedJoinDestination(joinContext.assessmentType, join)
        : "/app",
    );
  }

  const invitation = campaign
    ? {
        token: join!,
        teamName: campaign.organizationName ?? campaign.campaignName,
        presenterName: null,
        presenterTitle: null,
        // Named from the wellbeing product content — ASSESSMENT_LABELS covers
        // DISC and Focus only, so a wellbeing campaign indexed into it
        // produced `undefined`.
        sessionLabel: WELLBEING_PRODUCT_NAME,
        isWellbeing: true,
      }
    : joinContext && !joinContext.blocked && joinContext.teamId
      ? {
          token: join!,
          teamName: joinContext.teamName,
          presenterName: joinContext.presenterName,
          presenterTitle: joinContext.presenterTitle,
          // ASSESSMENT_LABELS names DISC and Focus products only, so a
          // wellbeing campaign indexed into it produced `undefined`. Naming it
          // from the wellbeing product content keeps the invitation honest
          // about what the person is being asked to take part in.
          sessionLabel:
            joinContext.assessmentType === "wellbeing"
              ? WELLBEING_PRODUCT_NAME
              : joinContext.assessmentType
                ? (ASSESSMENT_LABELS[joinContext.assessmentType as AssessmentProduct] ?? null)
                : null,
          isWellbeing: joinContext.assessmentType === "wellbeing",
        }
      : null;
  const mappedIntent =
    intent === "team" ? "create_team" : intent === "coach" ? "manage_clients" : intent;

  return (
    <div className="relative flex min-h-screen flex-col">
      <AssessmentTransitionScene />
      <header className="relative z-10 mx-auto flex h-[72px] w-full max-w-7xl items-center px-5 sm:px-8">
        <BrandMark />
      </header>
      <main className="relative z-10 flex flex-1 justify-center px-5 py-10">
        <OnboardingFlow
          defaultFullName={profile.full_name}
          defaultEmail={profile.email}
          initialIntent={mappedIntent}
          invitation={invitation}
        />
      </main>
    </div>
  );
}
