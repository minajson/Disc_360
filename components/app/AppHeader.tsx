"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/marketing/BrandMark";
import { signOut } from "@/lib/actions/auth";
import { isActive, type NavItem } from "@/lib/navigation/app-nav";
import { cn } from "@/lib/utils/cn";

interface AppHeaderProps {
  preferredName: string;
  links: NavItem[];
  accountLinks: NavItem[];
  /** Rendered as a distinct call-out; only ever passed for super admins. */
  showPlatformAdmin: boolean;
}

export function AppHeader({
  preferredName,
  links,
  accountLinks,
  showPlatformAdmin,
}: AppHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape — a menu that traps the user is
  // worse than no menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const navLinkClass = (item: NavItem) =>
    cn(
      "rounded-full px-4 py-2 text-sm transition-colors",
      isActive(item, pathname)
        ? "bg-ink/6 font-medium text-ink"
        : "text-slate hover:text-ink",
    );

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/85 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-8">
          <BrandMark />
          <nav aria-label="Application" className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link, pathname) ? "page" : undefined}
                className={navLinkClass(link)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {showPlatformAdmin ? (
            <Link
              href="/admin"
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              className="hidden items-center rounded-full border border-hairline-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-botanical hover:text-botanical md:inline-flex"
            >
              Platform Admin
            </Link>
          ) : null}

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
              className="flex items-center gap-2 rounded-full border border-hairline px-3 py-2 text-sm text-slate transition-colors hover:border-hairline-strong hover:text-ink"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-sage/50 font-mono text-[11px] font-medium text-botanical-deep">
                {preferredName.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-32 truncate sm:inline">{preferredName}</span>
              <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                <path
                  d="M2.5 4.5 6 8l3.5-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 flex w-56 flex-col gap-0.5 rounded-2xl border border-hairline bg-paper p-1.5 shadow-lift"
              >
                <span className="px-3 py-2 font-mono text-[11px] text-faint">
                  {preferredName}
                </span>
                {accountLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    // Client-side navigation keeps this mounted, so the menu
                    // has to close itself on selection.
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm transition-colors",
                      item.href.startsWith("/admin")
                        ? "font-medium text-botanical hover:bg-botanical/8"
                        : "text-slate hover:bg-ink/5 hover:text-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
                <form action={signOut} className="contents">
                  <button
                    type="submit"
                    role="menuitem"
                    className="rounded-xl px-3 py-2 text-left text-sm text-slate transition-colors hover:bg-ink/5 hover:text-ink"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <nav
        aria-label="Application mobile"
        className="flex gap-1 overflow-x-auto border-t border-hairline px-4 py-2 md:hidden"
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive(link, pathname) ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors",
              isActive(link, pathname)
                ? "bg-ink/6 font-medium text-ink"
                : "text-slate hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        ))}
        {showPlatformAdmin ? (
          <Link
            href="/admin"
            className="whitespace-nowrap rounded-full border border-hairline-strong px-4 py-1.5 text-sm font-medium text-botanical"
          >
            Platform Admin
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
