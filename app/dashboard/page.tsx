import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatsRow, type DashboardStat } from "@/components/dashboard/StatsRow";
import { LatestResultCard } from "@/components/dashboard/LatestResultCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { TrendPanel } from "@/components/dashboard/TrendPanel";
import { dimensionMeta } from "@/data/dimension-meta";
import { insightMap } from "@/data/insight-maps";
import { getCurrentUser } from "@/lib/auth";
import { getHistory, getLatestResult } from "@/lib/insights/history";
import { DIMENSION_KEY } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const [{ items, total }, latest] = await Promise.all([
    getHistory(user.id),
    getLatestResult(user.id),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <DashboardShell
          title="Overview"
          description={`Signed in as ${user.name}`}
        >
          {latest ? (
            <>
              <StatsRow
                stats={
                  [
                    { label: "Assessments completed", value: String(total) },
                    {
                      label: "Current archetype",
                      value: insightMap[latest.archetypeCode].name,
                      hint: latest.archetypeCode,
                    },
                    {
                      label: "Primary dimension",
                      value: dimensionMeta[latest.primaryDimension].label,
                      hint: `score ${latest.normalized[DIMENSION_KEY[latest.primaryDimension]]}`,
                    },
                    {
                      label: "Last completed",
                      value: formatDate(latest.createdAt),
                    },
                  ] satisfies DashboardStat[]
                }
              />
              <LatestResultCard result={latest} />
              {items.length >= 2 ? (
                <TrendPanel items={[...items].reverse()} />
              ) : null}
              <QuickActions />
            </>
          ) : (
            <>
              <EmptyState
                title="No profile yet"
                description="Take the seven-minute assessment and your dashboard comes alive — archetype, scores, trends, and a full working-style report."
                action={{ href: "/assessment", label: "Take the assessment" }}
              />
              <QuickActions />
            </>
          )}
        </DashboardShell>
      </main>
      <SiteFooter />
    </>
  );
}
