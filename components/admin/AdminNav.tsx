"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, SUPER_ADMIN_NAV } from "@/lib/navigation/app-nav";
import { cn } from "@/lib/utils/cn";

/**
 * Platform administration nav. Kept structurally separate from the product
 * experiences: nothing here appears in an individual's, facilitator's or
 * coach's navigation, so a super admin always knows which context they are in.
 *
 * The way back to the product ("Return to DISC360") lives in the admin header
 * (app/admin/layout.tsx) rather than here — it is always visible, including on
 * mobile where this nav collapses to a horizontal scroller.
 */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5">
      {SUPER_ADMIN_NAV.map((link) => {
        const active = isActive(link, pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-xl px-4 py-2 text-sm transition-colors",
              active ? "bg-ink text-mineral" : "text-slate hover:bg-ink/5 hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
