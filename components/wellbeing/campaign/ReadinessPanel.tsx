import Link from "next/link";
import type { CampaignReadiness } from "@/lib/wellbeing/readiness";

/**
 * What a facilitator sees when a campaign is not yet open.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ACTIONABLE, OR IT IS NOISE.
 *
 * Each issue names one thing that is missing and one thing to do about it.
 * There is no aggregate "configuration incomplete" state, because that tells
 * somebody a problem exists without telling them what it is — and the person
 * looking at this screen is exactly the person who can fix it in a minute.
 *
 * Shown prominently rather than tucked into Settings: a facilitator who has
 * already printed a QR code needs to know before they hand it out, not after
 * somebody scans it.
 * ─────────────────────────────────────────────────────────────────────
 */
export function ReadinessPanel({ readiness }: { readiness: CampaignReadiness }) {
  if (readiness.ready) return null;

  return (
    <section
      aria-labelledby="campaign-readiness-heading"
      className="flex flex-col gap-5 rounded-2xl border border-[rgba(138,106,47,0.35)] bg-pulse-attention-soft/50 p-6 sm:p-7"
    >
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[11px] tracking-[0.16em] text-[#7a5510] uppercase">
          Not open to participants
        </p>
        <h2 id="campaign-readiness-heading" className="font-display text-h3 font-semibold text-ink">
          {readiness.issues.length === 1
            ? "One thing to finish first"
            : `${readiness.issues.length} things to finish first`}
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-slate">
          Anyone scanning this campaign&rsquo;s code is told it is not open yet, rather than
          meeting a form they cannot complete.
        </p>
      </div>

      <ol className="flex flex-col divide-y divide-[rgba(138,106,47,0.22)]">
        {readiness.issues.map((issue) => (
          <li key={issue.code} className="flex flex-col gap-1.5 py-3.5 first:pt-0 last:pb-0">
            <p className="text-sm font-medium text-ink">{issue.message}</p>
            <p className="text-sm leading-relaxed text-slate">{issue.fix}</p>
            {issue.href && (
              <Link
                href={issue.href}
                className="pulse-focus w-fit text-sm font-medium text-pulse underline underline-offset-4"
              >
                Open →
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
