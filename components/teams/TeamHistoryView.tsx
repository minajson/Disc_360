"use client";

import { useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DiscRadarOverlay } from "@/components/charts/DiscRadarOverlay";
import { dimensionMeta } from "@/data/dimension-meta";
import { linkTeamToSeries, unlinkTeamFromSeries } from "@/lib/actions/history";
import { DIMENSION_KEY, DIMENSIONS } from "@/lib/types";
import { MOVEMENT_LABEL, VARIATION_NOTE } from "@/lib/history/timeline";
import type { TeamHistory } from "@/lib/history/team";

/**
 * Team history across an explicit lineage.
 *
 * Aggregate only — counts, averages and composition. Periods are grouped by a
 * team_series_id an administrator set deliberately; nothing is inferred from
 * a matching team name, because two unrelated teams can share one and a
 * continuing team is usually renamed precisely because something changed.
 */

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

function LineageControl({ history }: { history: TeamHistory }) {
  const [pending, startTransition] = useTransition();
  const [otherTeamId, setOtherTeamId] = useState("");
  const [seriesName, setSeriesName] = useState(history.seriesName ?? history.teamName);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="paper-card flex flex-col gap-4 p-6 print:hidden">
      <div className="flex flex-col gap-1">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
          Team lineage
        </h3>
        <p className="max-w-2xl text-sm leading-relaxed text-slate">
          {history.seriesId
            ? `This team belongs to the “${history.seriesName}” series. Periods below are the assessments in that series.`
            : "This team stands alone. Link it to another team you administer to compare assessment periods across a rename, a restructure or a new annual cohort."}
        </p>
      </div>

      {history.seriesId ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await unlinkTeamFromSeries(history.teamId);
              if (!result.ok) setError(result.error ?? "Could not unlink");
            })
          }
          className="self-start rounded-full border border-hairline px-4 py-2 text-sm text-slate transition-colors hover:border-disc-d hover:text-disc-d disabled:opacity-50"
        >
          Remove this team from the series
        </button>
      ) : history.linkable.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-slate">Continue from</span>
            <select
              value={otherTeamId}
              onChange={(event) => setOtherTeamId(event.target.value)}
              className="rounded-full border border-hairline bg-paper px-4 py-2 text-sm text-ink focus:border-botanical focus:outline-none"
            >
              <option value="">Choose a team…</option>
              {history.linkable.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} · {formatDate(team.createdAt)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-slate">Series name</span>
            <input
              type="text"
              value={seriesName}
              onChange={(event) => setSeriesName(event.target.value)}
              className="rounded-full border border-hairline bg-paper px-4 py-2 text-sm text-ink focus:border-botanical focus:outline-none"
            />
          </label>
          <button
            type="button"
            disabled={pending || !otherTeamId || seriesName.trim().length === 0}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await linkTeamToSeries({
                  teamId: history.teamId,
                  otherTeamId,
                  seriesName: seriesName.trim(),
                });
                if (!result.ok) setError(result.error ?? "Could not link the teams");
              })
            }
            className="rounded-full bg-botanical px-5 py-2 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-faint"
          >
            {pending ? "Linking…" : "Link teams"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate">
          No other team in this organisation is available to link. You must
          administer both teams.
        </p>
      )}

      {error ? (
        <p role="alert" className="text-sm text-disc-d">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TeamHistoryView({ history }: { history: TeamHistory }) {
  const reduced = useReducedMotion();
  const { periods, comparisons } = history;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <Eyebrow>Team history · {history.seriesName ?? history.teamName}</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">
          {periods.length === 1
            ? "One assessment period"
            : `${periods.length} assessment periods`}
        </h1>
      </header>

      <LineageControl history={history} />

      {periods.length === 0 ? (
        <div className="paper-card p-8">
          <p className="max-w-xl text-sm leading-relaxed text-slate">
            No completed assessments in this lineage yet.
          </p>
        </div>
      ) : (
        <section className="flex flex-col gap-4" aria-label="Assessment periods">
          {periods.map((period, index) => (
            <motion.article
              data-reveal
              key={period.teamId}
              className="paper-card flex flex-col gap-4 p-6 lg:p-7"
              initial={reduced ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.45,
                delay: Math.min(index * 0.05, 0.3),
                ease: [0.32, 0.94, 0.6, 1],
              }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-display text-lg font-semibold text-ink">
                  {period.teamName}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-teal">
                  {formatDate(period.completedAt)}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-slate">
                <span>
                  {period.completedCount}/{period.memberCount} completed ·{" "}
                  {period.memberCount > 0
                    ? Math.round((period.completedCount / period.memberCount) * 100)
                    : 0}
                  %
                </span>
                {DIMENSIONS.map((dim) => (
                  <span key={dim} className="flex items-center gap-1">
                    <span style={{ color: `var(--color-disc-${dim.toLowerCase()})` }}>
                      {dimensionMeta[dim].displayCode}
                    </span>
                    <span className="text-ink">{period.averages[DIMENSION_KEY[dim]]}</span>
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1.5 rule-t pt-3">
                {DIMENSIONS.map((dim) => (
                  <span key={dim} className="flex items-center gap-1.5 text-xs text-slate">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: `var(--color-disc-${dim.toLowerCase()})` }}
                    />
                    {dimensionMeta[dim].label}
                    <span className="font-mono text-faint">{period.composition[dim]}</span>
                  </span>
                ))}
                {period.departments.length > 0 ? (
                  <span className="text-xs text-faint">
                    {period.departments.join(" · ")}
                  </span>
                ) : null}
              </div>
            </motion.article>
          ))}
        </section>
      )}

      {comparisons.length > 0 ? (
        <section className="flex flex-col gap-5" aria-label="Period comparison">
          <div className="flex flex-col gap-1.5">
            <Eyebrow>Change</Eyebrow>
            <h2 className="font-display text-h3 font-semibold">Between periods</h2>
          </div>

          {comparisons.map((comparison) => (
            <div
              key={`${comparison.from.teamId}-${comparison.to.teamId}`}
              className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]"
            >
              <div className="paper-card flex flex-col gap-4 p-7">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
                  {comparison.from.teamName} → {comparison.to.teamName}
                </h3>
                <DiscRadarOverlay
                  series={[
                    {
                      label: formatDate(comparison.from.completedAt),
                      scores: comparison.from.averages,
                      color: "var(--color-slate)",
                      reference: true,
                    },
                    {
                      label: formatDate(comparison.to.completedAt),
                      scores: comparison.to.averages,
                      color: "var(--color-botanical)",
                    },
                  ]}
                  className="mx-auto max-w-75"
                />
              </div>

              <div className="flex flex-col gap-5">
                <div className="paper-card flex flex-col gap-3.5 p-7">
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
                    Average movement
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
                            entry.size === "none" ? "text-faint" : "bg-sage/30 text-botanical",
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
                    Reading this change
                  </h3>
                  <p className="text-sm leading-relaxed text-ink">{comparison.summary}</p>
                  <p className="text-xs leading-relaxed text-faint">{VARIATION_NOTE}</p>
                </div>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <p className="max-w-3xl text-xs leading-relaxed text-faint">
        Team history is aggregate. It reports counts, averages and composition
        for each period, never an individual&apos;s results, and differences
        between periods may reflect who took part as much as any change in the
        team itself.
      </p>
    </div>
  );
}
