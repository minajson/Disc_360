import { Eyebrow } from "@/components/ui/Eyebrow";
import { DimensionMark } from "@/components/ui/DimensionMark";
import { DiscRadarChart } from "@/components/charts/DiscRadarChart";
import { DimensionBarChart } from "@/components/charts/DimensionBarChart";
import { dimensionMeta } from "@/data/dimension-meta";
import { insightMap, type ArchetypeInsight } from "@/data/insight-maps";
import { intensityLabels } from "@/lib/scoring/intensity";
import { displayArchetypeCode } from "@/lib/utils/display";
import {
  DIMENSION_KEY,
  DIMENSIONS,
  type ArchetypeCode,
  type Dimension,
  type DiscScores,
  type IntensityBand,
} from "@/lib/types";

/* ── shared section chrome ──────────────────────────────────────────── */

export function ReportSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="font-display text-h3 font-semibold">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-slate">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/* ── scores ─────────────────────────────────────────────────────────── */

export function ScorePanel({
  scores,
  intensity,
  archetypeCode,
  primary,
  secondary,
}: {
  scores: DiscScores;
  intensity: Record<Dimension, IntensityBand>;
  archetypeCode: ArchetypeCode;
  primary: Dimension;
  secondary: Dimension | null;
}) {
  const primaryScore = scores[DIMENSION_KEY[primary]];
  const secondaryScore = secondary ? scores[DIMENSION_KEY[secondary]] : 0;
  const blendTotal = primaryScore + secondaryScore;

  return (
    <div className="paper-card grid gap-10 p-7 sm:p-10 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="flex items-center justify-center">
        <DiscRadarChart scores={scores} className="max-w-[320px]" />
      </div>
      <div className="flex flex-col justify-center gap-7">
        <DimensionBarChart scores={scores} />

        {secondary ? (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Hybrid blend · {displayArchetypeCode(archetypeCode)}
            </span>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full" role="img"
              aria-label={`Blend: ${dimensionMeta[primary].label} ${Math.round((primaryScore / blendTotal) * 100)}%, ${dimensionMeta[secondary].label} ${Math.round((secondaryScore / blendTotal) * 100)}%`}>
              <div
                className="h-full"
                style={{
                  width: `${(primaryScore / blendTotal) * 100}%`,
                  background: `var(--color-${dimensionMeta[primary].colorVar})`,
                }}
              />
              <div
                className="h-full"
                style={{
                  width: `${(secondaryScore / blendTotal) * 100}%`,
                  background: `var(--color-${dimensionMeta[secondary].colorVar})`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate">
              <span>{dimensionMeta[primary].label} leads</span>
              <span>{dimensionMeta[secondary].label} supports</span>
            </div>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DIMENSIONS.map((dim) => (
            <div key={dim} className="flex flex-col gap-1 rounded-xl border border-hairline bg-mineral px-3 py-2.5">
              <dt className="text-xs text-faint">{dimensionMeta[dim].label}</dt>
              <dd className="font-mono text-xs text-ink">
                {intensityLabels[intensity[dim]]}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/* ── list panels ────────────────────────────────────────────────────── */

export function BulletPanel({
  items,
  tone = "neutral",
  columns = 2,
}: {
  items: string[];
  tone?: "neutral" | "positive" | "caution";
  columns?: 1 | 2;
}) {
  const markColor =
    tone === "positive"
      ? "var(--color-disc-s)"
      : tone === "caution"
        ? "var(--color-disc-d)"
        : "var(--color-teal)";
  return (
    <div className="paper-card p-7">
      <ul className={columns === 2 ? "grid gap-x-10 gap-y-3 sm:grid-cols-2" : "grid gap-3"}>
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-slate">
            <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ background: markColor }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TitledCards({
  entries,
  accent = "neutral",
}: {
  entries: { title: string; detail: string }[];
  accent?: "neutral" | "caution";
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {entries.map((entry) => (
        <div key={entry.title} className="paper-card flex flex-col gap-2 p-6">
          <h3 className={accent === "caution" ? "font-display text-base font-semibold text-disc-d" : "font-display text-base font-semibold text-ink"}>
            {entry.title}
          </h3>
          <p className="text-sm leading-relaxed text-slate">{entry.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function DoDontPanel({
  communication,
}: {
  communication: ArchetypeInsight["communication"];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(
        [
          { heading: "Do", items: communication.do, color: "var(--color-disc-s)" },
          { heading: "Avoid", items: communication.dont, color: "var(--color-disc-d)" },
        ] as const
      ).map((column) => (
        <div key={column.heading} className="paper-card flex flex-col gap-4 p-7">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: column.color }}>
            {column.heading}
          </h3>
          <ul className="flex flex-col gap-3">
            {column.items.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-slate">
                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ background: column.color }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function TriColumnPanel({
  stressResponse,
}: {
  stressResponse: ArchetypeInsight["stressResponse"];
}) {
  const columns = [
    { heading: "Triggers", items: stressResponse.triggers },
    { heading: "Under pressure", items: stressResponse.behaviors },
    { heading: "Recovery", items: stressResponse.recovery },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {columns.map((column) => (
        <div key={column.heading} className="paper-card flex flex-col gap-4 p-6">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">
            {column.heading}
          </h3>
          <ul className="flex flex-col gap-3">
            {column.items.map((item) => (
              <li key={item} className="border-l-2 border-sage pl-3 text-sm leading-relaxed text-slate">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ── collaboration guidance for each other style ───────────────────── */

export function AdaptationGrid({ ownPrimary }: { ownPrimary: Dimension }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {DIMENSIONS.map((dim) => {
        const meta = dimensionMeta[dim];
        const guide = insightMap[dim];
        const isOwn = dim === ownPrimary;
        return (
          <div key={dim} className="paper-card flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <DimensionMark dimension={dim} />
              {isOwn ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                  Your primary style
                </span>
              ) : null}
            </div>
            <p className="text-sm leading-relaxed text-slate">
              {meta.essence} Under pressure: {meta.underPressure.toLowerCase()}
            </p>
            <ul className="flex flex-col gap-2">
              {guide.communication.do.slice(0, 3).map((tip) => (
                <li key={tip} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate">
                  <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" fill="none" stroke="var(--color-botanical)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 8.5 6.5 12 13 4.5" />
                  </svg>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
