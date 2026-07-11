import Link from "next/link";
import { BrandMark } from "@/components/marketing/BrandMark";

const columns = [
  {
    heading: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/resources", label: "Resources" },
      { href: "/sign-up", label: "Take the assessment" },
    ],
  },
  {
    heading: "Audiences",
    links: [
      { href: "/individuals", label: "Individuals" },
      { href: "/teams", label: "Teams" },
      { href: "/coaches", label: "Coaches" },
      { href: "/organizations", label: "Organizations" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="rule-t bg-mineral">
      <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
          <div className="flex flex-col gap-5">
            <BrandMark />
            <p className="max-w-xs text-sm leading-relaxed text-slate">
              Personality intelligence for people and teams — practical
              guidance on how people lead, communicate, decide and respond
              under pressure.
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading} className="flex flex-col gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
                {column.heading}
              </span>
              {column.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-slate transition-colors hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 rule-t pt-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} DISC360. All rights reserved.</span>
          <span className="max-w-md text-pretty">
            DISC360 supports self-awareness and team development. It is not a
            medical, clinical or employment-selection instrument.
          </span>
        </div>
      </div>
    </footer>
  );
}
