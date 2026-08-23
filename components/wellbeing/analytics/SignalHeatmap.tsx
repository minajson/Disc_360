import type { SignalRow } from "@/lib/wellbeing/analytics";
import { ITEM_SIGNAL_NOTE } from "@/data/wellbeing-content";
import { SuppressionNotice } from "./SuppressionNotice";

/**
 * Item-level aggregate signal, by cohort.
 *
 * Twelve columns, one per questionnaire item, each showing the share of
 * responses indicating more difficulty than usual. Columns are labelled by
 * item number and nothing else: naming any subset "sleep", "confidence",
 * "depression" or "anxiety" would assert a factor structure this product has
 * not validated and is not licensed to claim.
 *
 * Restrained tone ramp — one hue, varying weight. A red-to-green heat table
 * would read as a scoreboard of which department is doing worst, which is
 * precisely the use this data must not be put to.
 */
export function SignalHeatmap({
  rows,
  minCohort,
}: {
  rows: SignalRow[];
  minCohort: number;
}) {
  const published = rows.filter((row) => !row.suppressed && row.signals);
  const itemCount = published[0]?.signals?.length ?? 12;

  return (
    <figure className="flex flex-col gap-4">
      {/* Wide content scrolls inside its own container; the page never does. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">
            Share of responses indicating more difficulty than usual, by cohort and questionnaire
            item.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="pb-3 text-left text-xs font-medium tracking-wide text-faint uppercase">
                Cohort
              </th>
              {Array.from({ length: itemCount }, (_, index) => (
                <th
                  key={index}
                  scope="col"
                  className="pb-3 text-center font-mono text-[11px] font-normal text-faint"
                >
                  {index + 1}
                </th>
              ))}
              <th scope="col" className="pb-3 pl-3 text-right text-xs font-medium tracking-wide text-faint uppercase">
                n
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-[rgba(31,78,95,0.12)]">
                <th scope="row" className="py-2.5 pr-4 text-left text-sm font-medium text-ink">
                  {row.label}
                </th>
                {row.suppressed || !row.signals ? (
                  <td colSpan={itemCount} className="py-2.5 text-center">
                    <SuppressionNotice compact />
                  </td>
                ) : (
                  row.signals.map((signal) => (
                    <td key={signal.itemId} className="px-[2px] py-2.5">
                      <div
                        className="flex h-8 items-center justify-center rounded-[3px] font-mono text-[10px]"
                        style={{
                          // One hue, varying weight — attention, not alarm.
                          background: `color-mix(in srgb, var(--color-pulse) ${Math.round(
                            Math.min(signal.elevatedShare, 100) * 0.85,
                          )}%, var(--color-pulse-mist))`,
                          color: signal.elevatedShare > 45 ? "#F4F8F9" : "var(--color-pulse-deep)",
                        }}
                        title={`Item ${signal.position + 1}: ${signal.elevatedShare}% of ${signal.completed} responses`}
                      >
                        {Math.round(signal.elevatedShare)}
                      </div>
                    </td>
                  ))
                )}
                <td className="py-2.5 pl-3 text-right font-mono text-xs text-slate">
                  {row.completed ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {published.length === 0 && <SuppressionNotice minCohort={minCohort} />}

      <figcaption className="text-xs leading-relaxed text-slate">{ITEM_SIGNAL_NOTE}</figcaption>
    </figure>
  );
}
