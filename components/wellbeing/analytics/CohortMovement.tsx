import type { CohortMovementView } from "@/lib/wellbeing/analytics";
import { SUPPRESSION_NOTICE } from "@/data/wellbeing-content";

/**
 * Cohort medians as small multiples, one sparkline per group.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY SMALL MULTIPLES RATHER THAN ONE OVERLAID CHART.
 *
 * Seven cohorts on one set of axes is seven crossing lines, and the only thing
 * a reader can extract from it is which line is highest — which is the one
 * reading this product refuses to encourage. Separate panels on a SHARED scale
 * let the eye compare shapes: which groups moved, which held steady, which
 * moved together. Nobody comes away with a ranking.
 *
 * A withheld cell is a gap in its own panel and nothing else. It is never
 * interpolated across, because a line drawn through a hidden wave states a
 * figure that was deliberately not published.
 * ─────────────────────────────────────────────────────────────────────
 */
export function CohortMovement({ view }: { view: CohortMovementView }) {
  const publishable = view.rows.filter(
    (row) => !row.suppressed && row.cells.some((cell) => cell.median !== null),
  );
  const withheld = view.rows.length - publishable.length;

  if (view.waves.length < 2) {
    return (
      <p className="text-sm leading-relaxed text-slate">
        Only one wave has been recorded, so no group has anything to move between yet.
      </p>
    );
  }

  const span = Math.max(1, view.scoreMax - view.scoreMin);
  const width = 180;
  const height = 56;
  const pad = 6;

  const x = (index: number) =>
    view.waves.length === 1
      ? width / 2
      : pad + (index / (view.waves.length - 1)) * (width - pad * 2);
  const y = (value: number) =>
    height - pad - ((value - view.scoreMin) / span) * (height - pad * 2);

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-x-6 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
        {publishable.map((row) => {
          // Contiguous runs only. A gap is a gap.
          const runs: { index: number; median: number }[][] = [];
          let run: { index: number; median: number }[] = [];
          row.cells.forEach((cell, index) => {
            if (cell.median === null) {
              if (run.length > 0) runs.push(run);
              run = [];
              return;
            }
            run.push({ index, median: cell.median });
          });
          if (run.length > 0) runs.push(run);

          const published = row.cells.filter((cell) => cell.median !== null);
          const first = published[0]?.median ?? null;
          const last = published[published.length - 1]?.median ?? null;
          // A movement needs two published waves. With one, `first` and `last`
          // are the same cell and the delta reads "no change" — which asserts
          // that nothing moved across a period the group was withheld from.
          const delta =
            published.length >= 2 && first !== null && last !== null
              ? Math.round((last - first) * 10) / 10
              : null;

          return (
            <li key={row.key} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="truncate text-sm font-medium text-ink">{row.label}</span>
                <span className="ml-auto font-mono text-xs text-slate tabular-nums">
                  {last !== null && (
                    <strong className="font-display text-base text-ink">{last}</strong>
                  )}
                  {delta !== null && (
                    <span className="text-faint">
                      {" "}
                      {delta === 0 ? "no change" : `${delta > 0 ? "+" : ""}${delta}`}
                    </span>
                  )}
                </span>
              </div>

              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="h-auto w-full"
                role="img"
                aria-label={`${row.label}: ${row.cells
                  .map((cell) =>
                    cell.median === null
                      ? `${cell.waveLabel}, withheld`
                      : `${cell.waveLabel}, median ${cell.median}`,
                  )
                  .join("; ")}`}
              >
                <line
                  x1={pad}
                  x2={width - pad}
                  y1={height - pad}
                  y2={height - pad}
                  stroke="rgba(31,78,95,0.12)"
                />
                {runs.map((segment, segmentIndex) => (
                  <polyline
                    key={segmentIndex}
                    points={segment
                      .map((entry) => `${x(entry.index)},${y(entry.median)}`)
                      .join(" ")}
                    fill="none"
                    stroke="var(--color-pulse)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {row.cells.map((cell, index) =>
                  cell.median === null ? (
                    <circle
                      key={cell.waveKey}
                      cx={x(index)}
                      cy={height / 2}
                      r="2"
                      fill="rgba(31,78,95,0.22)"
                    />
                  ) : (
                    <circle
                      key={cell.waveKey}
                      cx={x(index)}
                      cy={y(cell.median)}
                      r="3"
                      fill="var(--color-pulse)"
                    />
                  ),
                )}
              </svg>

              <p className="font-mono text-[10px] text-faint">
                {published.length < 2
                  ? "one publishable wave — no movement to report"
                  : `${view.waves[0]!.label} → ${view.waves[view.waves.length - 1]!.label}`}{" "}
                · scale {view.scoreMin}–{view.scoreMax}
              </p>
            </li>
          );
        })}
      </ul>

      {publishable.length === 0 && (
        <p className="text-sm leading-relaxed text-slate">
          No group in this view has enough responses in enough waves for a movement to be
          published.
        </p>
      )}

      {withheld > 0 && (
        <p className="border-t border-hairline pt-4 text-xs leading-relaxed text-faint">
          {withheld} group{withheld === 1 ? " is" : "s are"} not shown. {SUPPRESSION_NOTICE}. A
          faint mark inside a panel is a wave withheld for the same reason — the line is broken
          rather than drawn through it, because a line across a hidden wave would state the figure
          that was withheld.
        </p>
      )}
    </div>
  );
}
