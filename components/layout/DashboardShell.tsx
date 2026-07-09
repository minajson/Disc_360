import { PageContainer } from "@/components/layout/PageContainer";
import { SidebarNav, type SidebarLink } from "@/components/layout/SidebarNav";

const dashboardLinks: SidebarLink[] = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/history", label: "History" },
  { href: "/team", label: "Team" },
];

interface DashboardShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

/** Two-pane executive dashboard layout with side navigation. */
export function DashboardShell({
  title,
  description,
  children,
}: DashboardShellProps) {
  return (
    <PageContainer className="flex flex-col gap-8 py-12 sm:py-14 lg:grid lg:grid-cols-[200px_1fr] lg:gap-12">
      <aside className="lg:pt-2">
        <SidebarNav links={dashboardLinks} />
      </aside>

      <div className="flex min-w-0 flex-col gap-8">
        <header className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-ink-secondary">{description}</p>
          ) : null}
        </header>
        {children}
      </div>
    </PageContainer>
  );
}
