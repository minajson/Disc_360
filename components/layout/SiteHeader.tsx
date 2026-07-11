import Link from "next/link";
import { navLinks } from "@/components/layout/nav-links";
import { MobileNav } from "@/components/layout/MobileNav";
import { LinkButton } from "@/components/ui/LinkButton";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-midnight-950/70 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="relative flex size-7 items-center justify-center">
            <span className="absolute inset-0 rounded-full accent-gradient opacity-20" />
            <svg viewBox="0 0 24 24" className="size-5">
              <polygon
                points="12,3 21,12 12,18 4,12"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            Disc<span className="text-accent">360</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-white/5 hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <LinkButton href="/assessment">Start assessment</LinkButton>
        </div>

        <MobileNav />
      </div>
    </header>
  );
}
