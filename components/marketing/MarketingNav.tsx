"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { BrandMark } from "@/components/marketing/BrandMark";
import { LinkButton } from "@/components/ui/LinkButton";

const links = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/individuals", label: "Individuals" },
  { href: "/teams", label: "Teams" },
  { href: "/coaches", label: "Coaches" },
  { href: "/organizations", label: "Organizations" },
  { href: "/pricing", label: "Pricing" },
];

export function MarketingNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => setOpen(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled || open
          ? "bg-canvas/85 shadow-[0_1px_0_var(--color-hairline)] backdrop-blur-md"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <BrandMark />

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-2 text-sm transition-colors",
                pathname === link.href
                  ? "text-botanical font-medium"
                  : "text-slate hover:text-ink",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LinkButton href="/sign-in" variant="ghost">
            Sign in
          </LinkButton>
          <LinkButton href="/sign-up">Take the assessment</LinkButton>
        </div>

        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="flex size-11 items-center justify-center rounded-full border border-hairline text-ink lg:hidden"
        >
          <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {open ? (
              <>
                <path d="M5 5l10 10" />
                <path d="M15 5L5 15" />
              </>
            ) : (
              <>
                <path d="M3 6h14" />
                <path d="M3 10h14" />
                <path d="M3 14h9" />
              </>
            )}
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.nav
            aria-label="Mobile"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.94, 0.6, 1] }}
            className="overflow-hidden border-t border-hairline bg-canvas lg:hidden"
          >
            <div className="flex flex-col gap-1 px-5 py-4">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={close}
                  className="rounded-xl px-4 py-3 text-base text-ink hover:bg-ink/5"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-hairline pt-4">
                <LinkButton href="/sign-up" size="lg" onClick={close}>
                  Take the assessment
                </LinkButton>
                <LinkButton href="/sign-in" variant="outline" size="lg" onClick={close}>
                  Sign in
                </LinkButton>
              </div>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
