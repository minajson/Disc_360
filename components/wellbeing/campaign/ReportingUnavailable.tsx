import Link from "next/link";

/**
 * What a reporting tab shows to someone who may not read it.
 *
 * Explanatory rather than an error. Wellbeing reporting is governed separately
 * from the rest of the platform on purpose, and a facilitator who understands
 * that they run the campaign without seeing its figures is far less likely to
 * go looking for those figures another way.
 */
export function ReportingUnavailable({
  campaignId,
  reason,
}: {
  campaignId: string;
  reason: "no_role" | "no_instrument";
}) {
  if (reason === "no_instrument") {
    return (
      <section className="pulse-card flex flex-col gap-4 p-6 sm:p-9">
        <h2 className="font-display text-h3 font-semibold">Nothing to report yet</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-slate">
          This campaign has no questionnaire selected, so no measurement exists to report on.
        </p>
        <Link
          href={`/wellbeing/admin/campaigns/${campaignId}/settings`}
          className="pulse-focus w-fit rounded-full bg-pulse-deep px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink"
        >
          Choose a questionnaire
        </Link>
      </section>
    );
  }

  return (
    <section className="pulse-card flex flex-col gap-4 p-6 sm:p-9">
      <h2 className="font-display text-h3 font-semibold">Reporting is separately governed</h2>
      <p className="max-w-2xl text-sm leading-relaxed text-slate">
        You administer this campaign, which is what lets you run it, chase completion and share
        its join link. Reading its wellbeing figures is a different privilege: it is granted
        explicitly, per organisation, and recorded. Team administration does not carry it, and
        neither does platform administration.
      </p>
      <p className="max-w-2xl text-sm leading-relaxed text-slate">
        Your organisation&rsquo;s wellbeing governance contact can arrange access.
      </p>
      <Link
        href={`/wellbeing/admin/campaigns/${campaignId}`}
        className="pulse-focus w-fit rounded-full border border-hairline px-5 py-2.5 text-sm font-medium text-pulse transition-colors hover:border-pulse"
      >
        Back to the campaign
      </Link>
    </section>
  );
}
