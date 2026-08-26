import Link from "next/link";
import { ILLUSTRATIVE_DATA_BANNER } from "@/lib/wellbeing/demo-population";
import { LOCAL_FIXTURE_BANNER } from "@/lib/wellbeing/local-fixture";
import type { AnalyticsSource } from "@/lib/wellbeing/analytics";

/**
 * The Reports tab.
 *
 * One primary action — download the aggregate report — and an honest account
 * of what that document contains and what it deliberately does not. The other
 * entries describe the sections inside that report rather than pretending to
 * be separate downloads: offering four buttons that all produce the same file
 * would be padding, and a management audience notices.
 *
 * There is no individual export here, and no roster. A facilitator's route to
 * a participant's own result does not exist anywhere in this workspace, so it
 * cannot exist on this tab either.
 */
export function ReportsPanel({
  organizationId,
  instrumentKey,
  instrumentName,
  source,
  suppressed,
  minCohort,
}: {
  organizationId: string;
  instrumentKey: string;
  instrumentName: string;
  source: AnalyticsSource;
  suppressed: boolean;
  minCohort: number;
}) {
  const href = `/api/wellbeing/aggregate-report?org=${organizationId}&instrument=${instrumentKey}&source=${source}`;

  return (
    <section className="pulse-card flex flex-col gap-7 p-6 sm:p-9">
      <div>
        <h2 className="font-display text-h3 font-semibold">Reports</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate">
          A single aggregate document for {instrumentName}, suitable for circulating internally.
          {source === "demo"
            ? ` It is generated from the illustrative population and is labelled ${ILLUSTRATIVE_DATA_BANNER} on the cover, in its metadata and in its method section.`
            : source === "fixture"
              ? ` It is generated from the local development population and is labelled ${LOCAL_FIXTURE_BANNER} on the cover, in its metadata and in its method section.`
              : ""}
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-[rgba(31,78,95,0.16)] bg-pulse-mist/50 p-5 sm:p-6">
        <div>
          <h3 className="font-display text-base font-semibold text-ink">Aggregate Wellbeing report</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate">
            Campaign snapshot · overall pattern · cohort comparison
            {" · "}dimensions where the instrument supports them · movement across waves · areas to
            explore · method and privacy.
          </p>
        </div>

        <a
          href={href}
          className="pulse-focus w-fit rounded-full bg-pulse-deep px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink"
        >
          Download aggregate report
        </a>

        {suppressed && (
          <p className="text-xs leading-relaxed text-faint">
            Fewer than {minCohort} people have completed this pulse, so the report will explain that
            no group figure can be published yet rather than producing empty pages.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-hairline pt-6">
        <h3 className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">
          What this document never contains
        </h3>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed text-slate">
          {[
            "No participant roster, and no name beside any figure.",
            "No individual score, individual history or raw response.",
            "No email address or contact detail.",
            `Nothing for a group smaller than ${minCohort} people — suppression applies to this document exactly as it applies on screen, and a withheld figure is absent from the file rather than hidden inside it.`,
          ].map((line) => (
            <li key={line} className="flex gap-2.5">
              <span aria-hidden="true" className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-pulse-teal" />
              {line}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs leading-relaxed text-faint">
        Participants receive their own private report through{" "}
        <Link href="/wellbeing/history" className="underline underline-offset-2">
          My History
        </Link>
        . That route is theirs alone and is not reachable from this workspace.
      </p>
    </section>
  );
}
