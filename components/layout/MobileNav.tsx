"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { navLinks } from "@/components/layout/nav-links";
import { LinkButton } from "@/components/ui/LinkButton";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="flex size-10 items-center justify-center rounded-full border border-line text-ink-secondary transition-colors hover:text-ink"
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

      <AnimatePresence>
        {open ? (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="glass-panel glass-panel-raised absolute inset-x-5 top-[72px] z-50 flex flex-col gap-1 p-3"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-sm text-ink-secondary transition-colors hover:bg-white/5 hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
            <LinkButton
              href="/assessment"
              size="md"
              className="mt-2"
              onClick={() => setOpen(false)}
            >
              Start assessment
            </LinkButton>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
