import { GlassPanel } from "@/components/ui/GlassPanel";
import { HistoryRow } from "@/components/dashboard/HistoryRow";
import { dimensionMeta } from "@/data/dimension-meta";
import type { HistoryItem } from "@/lib/insights/history";
import { DIMENSIONS } from "@/lib/types";

export function HistoryTable({ items }: { items: HistoryItem[] }) {
  return (
    <GlassPanel className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <caption className="sr-only">
            Assessment history — one row per completed profile
          </caption>
          <thead>
            <tr className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
              <th scope="col" className="py-3 pl-5 pr-3 font-medium">
                Shape
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Archetype
              </th>
              {DIMENSIONS.map((dim) => (
                <th key={dim} scope="col" className="px-3 py-3 text-right font-medium">
                  <abbr title={dimensionMeta[dim].label} className="no-underline">
                    {dim}
                  </abbr>
                </th>
              ))}
              <th scope="col" className="px-3 py-3 text-right font-medium">
                Date
              </th>
              <th scope="col" className="py-3 pl-3 pr-5">
                <span className="sr-only">Open report</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <HistoryRow key={item.resultId} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    </GlassPanel>
  );
}
