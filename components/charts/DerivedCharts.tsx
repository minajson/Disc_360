import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSION_KEY, DIMENSIONS, type DiscScores } from "@/lib/types";

/**
 * Small server-safe SVG/CSS charts derived purely from normalized scores.
 * Nothing here invents data — every mark is arithmetic on the profile.
 */

function SpectrumRow({
  leftLabel,
  rightLabel,
  /** −100 … +100 (positive → right pole). */
  value,
  color,
}: {
  leftLabel: string;
  rightLabel: string;
  value: number;
  color: string;
}) {
  const percent = ((value + 100) / 200) * 100;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div
        className="relative h-2 rounded-full bg-ink/8"
        role="img"
        aria-label={`${leftLabel} to ${rightLabel}: ${Math.round(percent)}% toward ${percent >= 50 ? rightLabel : leftLabel}`}
      >
        <span aria-hidden className="absolute left-1/2 top-1/2 h-3.5 w-px -translate-y-1/2 bg-ink/20" />
        <span
          aria-hidden
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper"
          style={{ left: `${percent}%`, background: color }}
        />
      </div>
    </div>
  );
}

/** Where the profile sits on the two DISC axes: pace and orientation. */
export function BehavioralBalanceChart({ scores }: { scores: DiscScores }) {
  const pace = (scores.d + scores.i - scores.s - scores.c) / 2;
  const orientation = (scores.i + scores.s - scores.d - scores.c) / 2;
  return (
    <div className="flex flex-col gap-5">
      <SpectrumRow
        leftLabel="Reflective"
        rightLabel="Fast-paced"
        value={pace}
        color="var(--color-botanical)"
      />
      <SpectrumRow
        leftLabel="Task-focused"
        rightLabel="People-focused"
        value={orientation}
        color="var(--color-teal)"
      />
    </div>
  );
}

const commLabels: Record<string, string> = {
  D: "Direct",
  I: "Expressive",
  S: "Steady",
  C: "Precise",
};

/** Communication register mix — the four voices, weighted by score. */
export function CommunicationPreferenceChart({ scores }: { scores: DiscScores }) {
  return (
    <div className="flex flex-col gap-3">
      {DIMENSIONS.map((dim) => {
        const value = scores[DIMENSION_KEY[dim]];
        return (
          <div key={dim} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-slate">{commLabels[dim]}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-sm bg-ink/8">
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${value}%`,
                  background: `var(--color-${dimensionMeta[dim].colorVar})`,
                }}
              />
            </div>
            <span className="w-7 text-right font-mono text-xs text-ink">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Which pressure behaviors are most likely, weighted by dimension strength. */
export function PressureResponseChart({ scores }: { scores: DiscScores }) {
  const ranked = [...DIMENSIONS].sort(
    (a, b) => scores[DIMENSION_KEY[b]] - scores[DIMENSION_KEY[a]],
  );
  return (
    <div className="flex flex-col gap-3">
      {ranked.map((dim, index) => {
        const meta = dimensionMeta[dim];
        const value = scores[DIMENSION_KEY[dim]];
        return (
          <div key={dim} className={cn("flex items-start gap-3", index > 1 && "opacity-60")}>
            <span
              aria-hidden
              className="mt-1 h-8 w-1.5 shrink-0 rounded-full"
              style={{
                background: `var(--color-${meta.colorVar})`,
                opacity: Math.max(0.25, value / 100),
              }}
            />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-ink">
                {meta.label} · {value}
              </span>
              <span className="text-xs leading-relaxed text-slate">{meta.underPressure}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Development focus: the least-expressed dimensions are the stretch zones. */
export function DevelopmentFocusChart({ scores }: { scores: DiscScores }) {
  const ranked = [...DIMENSIONS].sort(
    (a, b) => scores[DIMENSION_KEY[a]] - scores[DIMENSION_KEY[b]],
  );
  return (
    <div className="flex flex-col gap-3">
      {ranked.map((dim, index) => {
        const meta = dimensionMeta[dim];
        const stretch = 100 - scores[DIMENSION_KEY[dim]];
        return (
          <div key={dim} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-slate">{meta.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-sm bg-ink/8">
              <div
                className={cn("h-full rounded-sm", index < 2 ? "" : "opacity-40")}
                style={{
                  width: `${stretch}%`,
                  background: `var(--color-${meta.colorVar})`,
                }}
              />
            </div>
            <span className="w-16 text-right font-mono text-[10px] uppercase tracking-wide text-faint">
              {index < 2 ? "stretch" : "native"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
