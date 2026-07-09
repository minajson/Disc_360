import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { HistoryTable } from "@/components/dashboard/HistoryTable";
import { getCurrentUser } from "@/lib/auth";
import { getHistory } from "@/lib/insights/history";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "History",
};

export default async function HistoryPage() {
  const user = await getCurrentUser();
  const { items, total } = await getHistory(user.id);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <DashboardShell
          title="History"
          description={
            total > 0
              ? `${total} completed assessment${total === 1 ? "" : "s"}, newest first`
              : undefined
          }
        >
          {items.length > 0 ? (
            <HistoryTable items={items} />
          ) : (
            <EmptyState
              title="No assessments yet"
              description="Your completed profiles will appear here — take the assessment to create your first."
              action={{ href: "/assessment", label: "Take the assessment" }}
            />
          )}
        </DashboardShell>
      </main>
      <SiteFooter />
    </>
  );
}
