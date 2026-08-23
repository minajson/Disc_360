import { SUPPRESSION_EXPLANATION, SUPPRESSION_NOTICE } from "@/data/wellbeing-content";

/**
 * What a reader sees instead of a figure.
 *
 * Calm and explanatory rather than an error state: suppression is the product
 * working correctly, and a facilitator who understands why a number is missing
 * is far less likely to go looking for it another way.
 */
export function SuppressionNotice({
  minCohort,
  detail,
  compact = false,
}: {
  minCohort?: number;
  detail?: string;
  compact?: boolean;
}) {
  if (compact) {
    return <span className="text-xs text-faint italic">{SUPPRESSION_NOTICE}</span>;
  }
  return (
    <div className="rounded-2xl border border-dashed border-[rgba(31,78,95,0.3)] bg-pulse-mist/70 px-5 py-5">
      <p className="text-sm font-medium text-ink">{SUPPRESSION_NOTICE}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate">{detail ?? SUPPRESSION_EXPLANATION}</p>
      {minCohort !== undefined && (
        <p className="mt-2 font-mono text-xs text-faint">
          Minimum reporting group: {minCohort} completed responses
        </p>
      )}
    </div>
  );
}
