import Link from "next/link";
import { Eyebrow } from "@/components/ui/Eyebrow";

const pathways = [
  {
    eyebrow: "For yourself",
    title: "Language for how you actually operate",
    description:
      "Your strengths, your pressure behavior, and how to be heard — free.",
    href: "/individuals",
    cta: "Explore the individual path",
  },
  {
    eyebrow: "For your team",
    title: "See the whole team on one map",
    description:
      "Invite your team, watch submissions arrive, present the culture map. $8.",
    href: "/teams",
    cta: "Explore the team path",
  },
];

export function PathwaysSplit() {
  return (
    <section className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:py-24">
      {pathways.map((pathway) => (
        <Link key={pathway.href} href={pathway.href} className="group">
          <article className="paper-card flex h-full flex-col gap-5 p-8 transition-all duration-300 ease-[var(--ease-meridian)] group-hover:-translate-y-1 group-hover:shadow-[0_28px_48px_-30px_rgba(23,32,29,0.35)] sm:p-10">
            <Eyebrow>{pathway.eyebrow}</Eyebrow>
            <h2 className="max-w-md font-display text-h3 font-semibold text-balance">
              {pathway.title}
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-slate">
              {pathway.description}
            </p>
            <span className="mt-auto inline-flex items-center gap-2 pt-2 text-sm font-medium text-botanical">
              {pathway.cta}
              <svg
                viewBox="0 0 16 16"
                className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 8h12M9 3l5 5-5 5" />
              </svg>
            </span>
          </article>
        </Link>
      ))}
    </section>
  );
}
