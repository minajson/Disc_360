"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

interface TeamTabsProps {
  teamId: string;
  isAdmin: boolean;
}

export function TeamTabs({ teamId, isAdmin }: TeamTabsProps) {
  const pathname = usePathname();
  const base = `/app/teams/${teamId}`;

  const tabs = isAdmin
    ? [
        { href: `${base}/dashboard`, label: "Dashboard", exact: false },
        { href: `${base}/results`, label: "Results", exact: false },
        { href: `${base}/presentation`, label: "Presentation", exact: false },
        { href: `${base}/settings`, label: "Settings", exact: false },
      ]
    : [
        { href: base, label: "Overview", exact: true },
        { href: `${base}/results`, label: "Results", exact: false },
      ];

  return (
    <nav aria-label="Team sections" className="flex gap-1 overflow-x-auto rule-b pb-px">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors",
              active
                ? "border-botanical font-medium text-botanical"
                : "border-transparent text-slate hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
