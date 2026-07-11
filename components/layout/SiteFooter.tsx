import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { dimensionList } from "@/data/dimension-meta";

const productLinks = [
  { href: "/assessment", label: "Take the assessment" },
  { href: "/dashboard", label: "Your dashboard" },
  { href: "/team", label: "Team intelligence" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-midnight-900 print:hidden">
      <PageContainer className="py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <span className="font-display text-lg font-bold tracking-tight">
              Disc<span className="text-accent">360</span>
            </span>
            <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
              Personality intelligence for individuals, teams, coaches, and
              organizations — decode how people lead, communicate, decide, and
              respond under pressure.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
              Platform
            </span>
            {productLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-ink-secondary transition-colors hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
              The four dimensions
            </span>
            <ul className="flex flex-col gap-2">
              {dimensionList.map((dim) => (
                <li
                  key={dim.code}
                  className="flex items-center gap-2 text-sm text-ink-secondary"
                >
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full"
                    style={{ background: `var(--color-${dim.colorVar})` }}
                  />
                  {dim.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-line pt-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Disc360. All rights reserved.</span>
          <span className="font-mono tracking-wide">
            Cognitive Atlas · Personality Intelligence
          </span>
        </div>
      </PageContainer>
    </footer>
  );
}
