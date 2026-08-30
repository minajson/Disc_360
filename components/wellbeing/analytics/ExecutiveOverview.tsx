import Link from "next/link";
import { MOVEMENT_GLYPH, STATE_VISUAL } from "@/lib/wellbeing/semantics";
import type { ExecutiveTile, Insight } from "@/lib/wellbeing/executive";

/**
 * The first screen: what is happening, and whether to believe it.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THIS REPLACED.
 *
 * A row of eight equal-weight statistics under a heading. Everything was
 * present and nothing led, so a reader arriving with "is wellbeing moving, and
 * where should we look?" had to assemble the answer themselves from figures
 * that all looked equally important.
 *
 * The five tiles below are ordered by the questions that actually get asked,
 * and participation is first because it decides whether the rest is worth
 * reading. Underneath them are sentences — derived, never generated — that say
 * what can safely be concluded and, just as often, what cannot.
 *
 * COLOUR IS NEVER THE ONLY SIGNAL.
 *
 * A tile with a state prints that state's own words beside its dot; the
 * movement tile prints an arrow AND the sign AND the period. The palette is
 * instrument-aware — `semantics.ts` decides what a figure means on its own
 * questionnaire — and there is no red anywhere, because a screening figure is
 * a prompt to look and never an alarm about a person.
 * ─────────────────────────────────────────────────────────────────────
 */
export function ExecutiveOverview({
  organizationName,
  tiles,
  insights,
  whereToLook,
}: {
  organizationName: string;
  tiles: ExecutiveTile[];
  insights: Insight[];
  /** The comparison dimensions, as links. Alphabetical, never ranked. */
  whereToLook: { label: string; href: string; published: number; withheld: number }[];
}) {
  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
          {organizationName}
        </p>
        <h2 className="mt-2 font-display text-h2 font-semibold tracking-tight text-ink">
          Wellbeing overview
        </h2>
      </div>

      {/* ── the five figures ──────────────────────────────────────── */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.key} className="flex min-w-0 flex-col gap-1.5">
            <dt className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
              {tile.label}
            </dt>
            <dd className="flex items-baseline gap-2">
              {tile.movement && (
                <span
                  aria-hidden="true"
                  className="font-display text-[1.5rem] leading-none text-pulse-teal"
                >
                  {MOVEMENT_GLYPH[tile.movement.direction]}
                </span>
              )}
              <span className="font-display text-[clamp(1.9rem,4.4vw,2.7rem)] leading-none font-semibold text-ink tabular-nums">
                {tile.value}
              </span>
            </dd>
            {tile.state && tile.state !== "unbanded" && (
              <p className="flex items-center gap-1.5 text-xs">
                {/* The dot is decorative; the label carries the meaning. */}
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: STATE_VISUAL[tile.state].color }}
                />
                <span style={{ color: STATE_VISUAL[tile.state].color }}>
                  {STATE_VISUAL[tile.state].label}
                </span>
              </p>
            )}
            {tile.note && <p className="text-xs leading-relaxed text-slate">{tile.note}</p>}
          </div>
        ))}
      </dl>

      {/* ── where to look ─────────────────────────────────────────── */}
      {whereToLook.length > 0 && (
        <nav aria-label="Where to look" className="border-t border-hairline pt-7">
          <h3 className="font-mono text-[11px] tracking-[0.16em] text-faint uppercase">
            Where to look
          </h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {whereToLook.map((entry) => (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  className="pulse-focus flex h-full flex-col gap-1 rounded-2xl border border-[rgba(31,78,95,0.16)] bg-paper p-4 transition-colors hover:border-pulse"
                >
                  <span className="text-sm font-medium text-ink">{entry.label}</span>
                  <span className="font-mono text-xs text-slate tabular-nums">
                    {entry.published} {entry.published === 1 ? "group" : "groups"}
                    {entry.withheld > 0 && (
                      <span className="text-faint"> · {entry.withheld} withheld</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* ── what can safely be said ───────────────────────────────── */}
      {insights.length > 0 && (
        <div className="border-t border-hairline pt-7">
          <h3 className="font-mono text-[11px] tracking-[0.16em] text-faint uppercase">
            What this suggests
          </h3>
          <ul className="mt-4 flex flex-col gap-4">
            {insights.map((insight, index) => (
              <li key={`${insight.kind}-${index}`} className="flex gap-3.5">
                <InsightMark kind={insight.kind} />
                <div className="min-w-0">
                  <p className="text-[0.98rem] leading-relaxed text-ink">{insight.text}</p>
                  {/* Every statement names the figures it stands on, so a
                      reader can check it rather than take it on trust. */}
                  <p className="mt-1 font-mono text-xs text-faint">{insight.basis}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-faint">
            These statements are computed from the figures above. They describe screening
            responses, not individuals, and none of them identifies a cause.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * A different mark per kind of statement, so the list is scannable without
 * relying on the reader parsing every sentence — and without colour being the
 * distinction.
 */
function InsightMark({ kind }: { kind: Insight["kind"] }) {
  const glyph =
    kind === "movement"
      ? "↕"
      : kind === "cohort"
        ? "◇"
        : kind === "privacy"
          ? "◈"
          : kind === "participation"
            ? "◉"
            : "◐";
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 w-4 shrink-0 text-center font-mono text-sm text-pulse-teal"
    >
      {glyph}
    </span>
  );
}
