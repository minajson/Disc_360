import Link from "next/link";

export const WELLBEING_WORKSPACE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "compare", label: "Compare" },
  { key: "field", label: "Field vs Office" },
  { key: "functions", label: "Sub Teams / Functions" },
  { key: "trends", label: "Trends" },
  { key: "signals", label: "Signals" },
  { key: "teams", label: "Teams" },
  { key: "locations", label: "Locations" },
  { key: "reports", label: "Reports" },
] as const;

export type WorkspaceTab = (typeof WELLBEING_WORKSPACE_TABS)[number]["key"];

export function parseWorkspaceTab(value: string | undefined): WorkspaceTab {
  return WELLBEING_WORKSPACE_TABS.some((tab) => tab.key === value)
    ? (value as WorkspaceTab)
    : "overview";
}

/** Horizontal on desktop, scrollable on a phone — never a wrapped pile. */
export function WorkspaceNav({
  active,
  organizationId,
  instrumentKey,
  source,
}: {
  active: WorkspaceTab;
  organizationId: string;
  /**
   * Carried for the same reason as the instrument: changing tab must not
   * silently move the reader between the live pilot and the illustrative
   * demo, which would be the one confusion this workspace cannot afford.
   */
  source: "live" | "demo";
  /**
   * Carried on every tab link. Without it, changing tab silently switched the
   * reader to a different instrument's numbers under the same heading — the
   * worst possible failure on a page whose whole rule is that instruments
   * never mix.
   */
  instrumentKey: string;
}) {
  return (
    <nav
      aria-label="Wellbeing analytics"
      className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex min-w-max items-center gap-1 border-b border-[rgba(31,78,95,0.16)]">
        {WELLBEING_WORKSPACE_TABS.map((tab) => {
          const current = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={`/wellbeing/analytics?org=${organizationId}&instrument=${instrumentKey}&tab=${tab.key}&source=${source}`}
                aria-current={current ? "page" : undefined}
                className={`pulse-focus -mb-px block rounded-t-lg border-b-2 px-3.5 py-2.5 text-sm transition-colors sm:px-4 ${
                  current
                    ? "border-pulse font-medium text-pulse"
                    : "border-transparent text-slate hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
