import Link from "next/link";
import { BrandMark } from "@/components/marketing/BrandMark";
import { signOut } from "@/lib/actions/auth";

const navLinks = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/assessments", label: "Assessments" },
  { href: "/app/history", label: "History" },
  { href: "/app/reports", label: "Reports" },
  { href: "/app/teams", label: "Teams" },
  { href: "/app/settings", label: "Settings" },
];

interface AppHeaderProps {
  preferredName: string;
}

export function AppHeader({ preferredName }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/85 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-8">
          <BrandMark />
          <nav aria-label="Application" className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-4 py-2 text-sm text-slate transition-colors hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-xs text-faint sm:inline">
            {preferredName}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-hairline px-4 py-2 text-sm text-slate transition-colors hover:border-hairline-strong hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
      <nav aria-label="Application mobile" className="flex gap-1 overflow-x-auto border-t border-hairline px-4 py-2 md:hidden">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm text-slate hover:text-ink"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
