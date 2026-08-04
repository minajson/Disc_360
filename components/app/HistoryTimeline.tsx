"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DiscRadarOverlay } from "@/components/charts/DiscRadarOverlay";
import { dimensionMeta } from "@/data/dimension-meta";
import { displayArchetypeCode } from "@/lib/utils/display";
import { DIMENSION_KEY, DIMENSIONS, type Dimension } from "@/lib/types";
import {
  MOVEMENT_LABEL,
  RETAKE_REASON_LABEL,
  VARIATION_NOTE,
  compareRecords,
  contextLabel,
  defaultView,
  newestFirst,
  trendSeries,
  type HistoryRecord,
} from "@/lib/history/timeline";

/**
 * Profile over time.
 *
 * Reads as a record, not a verdict: each entry keeps the context that existed
 * when it was completed, movements below the threshold are named as normal
 * variation, and every comparison says the pattern changed *in this context*
 * rather than that a person changed.
 */

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : date.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
};

const WIDTH = 720;
const HEIGHT = 220;
const PAD_X = 40;
const PAD_Y = 22;

function TrendLines({ points }: { points: ReturnType<typeof trendSeries> }) {
  const reduced = useReducedMotion();
  if (points.length < 2) return null;

  const plotW = WIDTH - PAD_X * 2;
  const plotH = HEIGHT - PAD_Y * 2;
  const x = (index: number) => PAD_X + (plotW / (points.length - 1)) * index;
  const y = (value: number) => PAD_Y + plotH - (value / 100) * plotH;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Your DISC scores across ${points.length} completed assessments: ${points
        .map((point) => `${point.label} — D ${point.scores.d}, I ${point.scores.i}, S ${point.scores.s}, A ${point.scores.c}`)
        .join("; ")}`}
      className="w-full"
    >
      {[0, 25, 50, 75, 100].map((level) => (
        <g key={level}>
          <line
            x1={PAD_X}
            y1={y(level)}
            x2={WIDTH - PAD_X}
            y2={y(level)}
            stroke="var(--color-hairline)"
            strokeDasharray={level === 50 ? undefined : "3 5"}
          />
          <text
            x={PAD_X - 8}
            y={y(level) + 3}
            textAnchor="end"
            fontSize={9}
            className="font-mono"
            fill="var(--color-faint)"
          >
            {level}
          </text>
        </g>
      ))}

      {DIMENSIONS.map((dim, index) => (
        <motion.path
          key={dim}
          d={points
            .map(
              (point, i) =>
                `${i === 0 ? "M" : "L"}${x(i)},${y(point.scores[DIMENSION_KEY[dim]])}`,
            )
            .join(" ")}
          fill="none"
          stroke={`var(--color-disc-${dim.toLowerCase()})`}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduced ? false : { pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: index * 0.08, ease: [0.32, 0.94, 0.6, 1] }}
        />
      ))}

      {points.map((point, index) => (
        <g key={point.id}>
          {DIMENSIONS.map((dim) => (
            <circle
              key={dim}
              cx={x(index)}
              cy={y(point.scores[DIMENSION_KEY[dim]])}
              r={3}
              fill={`var(--color-disc-${dim.toLowerCase()})`}
              stroke="var(--color-paper)"
              strokeWidth={1.5}
            />
          ))}
          <text
            x={x(index)}
            y={HEIGHT - 4}
            textAnchor="middle"
            fontSize={9}
            className="font-mono"
            fill="var(--color-faint)"
          >
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function HistoryTimeline({ records }: { records: HistoryRecord[] }) {
  const discRecords = useMemo(
    () => newestFirst(records.filter((record) => record.kind === "disc")),
    [records],
  );
  const [expanded, setExpanded] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);

  const view = useMemo(() => defaultView(discRecords), [discRecords]);
  const visible = expanded ? discRecords : view.visible;
  const points = useMemo(() => trendSeries(discRecords, "disc"), [discRecords]);

  const comparison = useMemo(() => {
    if (selection.length !== 2) return null;
    const picked = discRecords.filter((record) => selection.includes(record.id));
    if (picked.length !== 2) return null;
    const [newer, older] = picked;
    return compareRecords(older!, newer!);
  }, [selection, discRecords]);

  const toggle = (id: string) =>
    setSelection((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length >= 2
          ? [current[1]!, id]
          : [...current, id],
    );

  if (discRecords.length === 0) {
    return (
      <div className="paper-card flex flex-col items-start gap-3 p-8">
        <p className="max-w-md text-sm leading-relaxed text-slate">
          No completed assessments yet — your history builds here after your
          first profile.
        </p>
        <Link
          href="/app/assessments"
          className="text-sm font-medium text-botanical hover:underline"
        >
          Take the assessment →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {points.length >= 2 ? (
        <section className="flex flex-col gap-5" aria-label="Scores over time">
          <div className="flex flex-col gap-1.5">
            <Eyebrow>Trend</Eyebrow>
            <h2 className="font-display text-h3 font-semibold">
              Your scores across {points.length} assessments
            </h2>
          </div>
          <div className="paper-card flex flex-col gap-4 p-7">
            <TrendLines points={points} />
            <div className="flex flex-wrap gap-x-5 gap-y-2 rule-t pt-4">
              {DIMENSIONS.map((dim) => (
                <span key={dim} className="flex items-center gap-1.5 text-xs text-slate">
                  <span
                    aria-hidden
                    className="h-0.5 w-4 rounded-full"
                    style={{ background: `var(--color-disc-${dim.toLowerCase()})` }}
                  />
                  {dimensionMeta[dim].label}
                </span>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-faint">{VARIATION_NOTE}</p>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-5" aria-label="Completed assessments">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <Eyebrow>Timeline</Eyebrow>
            <h2 className="font-display text-h3 font-semibold">Every completed assessment</h2>
          </div>
          {discRecords.length >= 2 ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
              Select two dates to compare
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          {visible.map((record) => {
            const picked = selection.includes(record.id);
            return (
              <article
                key={record.id}
                className={cn(
                  "paper-card flex flex-col gap-3 p-6 transition-colors",
                  picked && "border-botanical",
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal">
                    {formatDate(record.completedAt)}
                  </span>
                  {record.attemptNumber ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                      Attempt {record.attemptNumber}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-display text-lg font-semibold text-ink">
                    {record.archetypeName}
                    <span className="ml-2 font-mono text-xs text-faint">
                      {displayArchetypeCode(record.archetypeCode)}
                    </span>
                  </span>
                  <span className="text-sm text-slate">{contextLabel(record)}</span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
                  {DIMENSIONS.map((dim) => (
                    <span key={dim} className="flex items-center gap-1">
                      <span style={{ color: `var(--color-disc-${dim.toLowerCase()})` }}>
                        {dimensionMeta[dim].displayCode}
                      </span>
                      <span className="text-ink">{record.scores[DIMENSION_KEY[dim]]}</span>
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 rule-t pt-3">
                  {record.retakeReason ? (
                    <span className="rounded-full border border-hairline bg-mineral px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-slate">
                      {RETAKE_REASON_LABEL[record.retakeReason] ?? record.retakeReason}
                    </span>
                  ) : null}
                  {record.retakeNote ? (
                    <span className="text-xs text-slate">{record.retakeNote}</span>
                  ) : null}
                  <Link
                    href={`/app/results/${record.id}`}
                    className="ml-auto text-sm font-medium text-botanical hover:underline"
                  >
                    Report →
                  </Link>
                  {discRecords.length >= 2 ? (
                    <button
                      type="button"
                      onClick={() => toggle(record.id)}
                      aria-pressed={picked}
                      className={cn(
                        "rounded-full border px-3.5 py-1 text-xs transition-colors",
                        picked
                          ? "border-botanical text-botanical"
                          : "border-hairline text-slate hover:border-botanical hover:text-botanical",
                      )}
                    >
                      {picked ? "Selected" : "Compare"}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        {!expanded && view.hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="self-start rounded-full border border-hairline px-5 py-2 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical"
          >
            Show {view.hiddenCount} earlier assessment
            {view.hiddenCount === 1 ? "" : "s"}
          </button>
        ) : null}
      </section>

      {comparison ? (
        <section className="flex flex-col gap-5" aria-label="Comparison">
          <div className="flex flex-col gap-1.5">
            <Eyebrow>Comparison</Eyebrow>
            <h2 className="font-display text-h3 font-semibold">
              {formatDate(comparison.from.completedAt)} → {formatDate(comparison.to.completedAt)}
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="paper-card flex flex-col gap-4 p-7">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
                Both assessments
              </h3>
              <DiscRadarOverlay
                series={[
                  {
                    label: formatDate(comparison.from.completedAt),
                    scores: comparison.from.scores,
                    color: "var(--color-slate)",
                    reference: true,
                  },
                  {
                    label: formatDate(comparison.to.completedAt),
                    scores: comparison.to.scores,
                    color: "var(--color-botanical)",
                  },
                ]}
                className="mx-auto max-w-75"
              />
              <div className="flex flex-wrap gap-1.5 rule-t pt-4">
                {[comparison.from, comparison.to].map((record) => (
                  <span
                    key={record.id}
                    className="rounded-full border border-hairline bg-mineral px-3 py-1 text-[11px] text-slate"
                  >
                    {contextLabel(record)}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="paper-card flex flex-col gap-3.5 p-7">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
                  Movement
                </h3>
                <ul className="flex flex-col gap-3">
                  {comparison.deltas.map((entry) => (
                    <li key={entry.dimension} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-sm text-slate sm:w-24">
                        {dimensionMeta[entry.dimension].label}
                      </span>
                      <span className="font-mono text-xs text-faint">
                        {entry.from} → {entry.to}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-xs",
                          entry.size === "none" ? "text-faint" : "text-ink",
                        )}
                      >
                        {entry.delta > 0 ? "+" : ""}
                        {entry.delta}
                      </span>
                      <span
                        className={cn(
                          "ml-auto rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
                          entry.size === "none"
                            ? "text-faint"
                            : "bg-sage/30 text-botanical",
                        )}
                      >
                        {MOVEMENT_LABEL[entry.size]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="paper-card flex flex-col gap-3 p-7">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
                  What this does and does not mean
                </h3>
                <p className="text-sm leading-relaxed text-ink">{comparison.summary}</p>
                <p className="text-xs leading-relaxed text-faint">{VARIATION_NOTE}</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <p className="max-w-3xl text-xs leading-relaxed text-faint">
        DISC describes behavioural preferences expressed in a particular
        context. It is not a clinical or medical assessment, and a change
        between two assessments reflects how you responded in each setting
        rather than a permanent change in who you are.
      </p>
    </div>
  );
}

export type { Dimension };
