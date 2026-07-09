import Link from "next/link";
import { MiniDiscShape } from "@/components/charts/MiniDiscShape";
import type { HistoryItem } from "@/lib/insights/history";
import { DIMENSION_KEY, DIMENSIONS } from "@/lib/types";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export function HistoryRow({ item }: { item: HistoryItem }) {
  return (
    <tr className="group border-t border-line transition-colors hover:bg-white/3">
      <td className="py-3.5 pl-5 pr-3">
        <MiniDiscShape scores={item.normalized} size={36} />
      </td>
      <td className="px-3 py-3.5">
        <div className="flex flex-col">
          <span className="font-display text-sm font-semibold text-ink">
            {item.archetypeName}
          </span>
          <span className="font-mono text-[11px] text-ink-muted">
            {item.archetypeCode}
          </span>
        </div>
      </td>
      {DIMENSIONS.map((dim) => (
        <td key={dim} className="px-3 py-3.5 text-right font-mono text-xs text-ink-secondary">
          {item.normalized[DIMENSION_KEY[dim]]}
        </td>
      ))}
      <td className="px-3 py-3.5 text-right text-xs text-ink-muted">
        {formatDate(item.createdAt)}
      </td>
      <td className="py-3.5 pl-3 pr-5 text-right">
        <Link
          href={`/results/${item.resultId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-ink"
        >
          Report
          <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </Link>
      </td>
    </tr>
  );
}
