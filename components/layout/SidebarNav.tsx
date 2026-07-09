"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export interface SidebarLink {
  href: string;
  label: string;
  exact?: boolean;
}

export function SidebarNav({ links }: { links: SidebarLink[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard" className="flex gap-1 lg:flex-col">
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-xl px-4 py-2.5 text-sm transition-colors",
              active
                ? "bg-white/8 font-medium text-ink"
                : "text-ink-muted hover:bg-white/4 hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
