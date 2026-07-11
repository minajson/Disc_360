import type { Metadata } from "next";
import { getTeamIntelligence } from "@/lib/insights/team";
import { PresentationDeck } from "@/components/teams/PresentationDeck";

export const metadata: Metadata = { title: "Presentation" };

export default async function TeamPresentationPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  // Presenter scope: team admins only (enforced inside with presentation: true).
  const data = await getTeamIntelligence(teamId, { presentation: true });

  if ("error" in data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <p className="paper-card max-w-md p-8 text-sm leading-relaxed text-slate">
          {data.error}
        </p>
      </div>
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return (
    <PresentationDeck
      data={data}
      resultsUrl={`${siteUrl}/app/teams/${teamId}/results`}
    />
  );
}
