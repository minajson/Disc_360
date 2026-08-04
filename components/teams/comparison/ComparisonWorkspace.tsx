"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DiscRadarOverlay } from "@/components/charts/DiscRadarOverlay";
import { ComparisonCard } from "@/components/teams/comparison/ComparisonCard";
import { ComparisonTray } from "@/components/teams/comparison/ComparisonTray";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSIONS } from "@/lib/types";
import {
  MAX_CARDS_PER_VIEW,
  buildBatches,
  buildCohorts,
  comparisonLayout,
  comparisonReadout,
  dimensionDivergence,
  slideWindow,
  groupAverage,
  highBandCounts,
  styleCounts,
  type ComparisonMember,
  type ComparisonSet,
} from "@/lib/insights/comparison";

/**
 * Scalable member comparison.
 *
 * The two-member comparison on the Pairings tab is unchanged and remains the
 * reference experience for one-to-one coaching. This workspace takes that
 * exact card anatomy and points it at a different data source: a batch, a
 * department, or an explicit selection. Two people or ninety-two, the cards
 * read the same — only how many arrive at once changes.
 *
 * Scope model:
 *   · All members  — batched at ten per screen, the readable ceiling.
 *   · Departments  — one set per department, itself batched when large.
 *   · Selection    — whatever the tray produced.
 */

type Scope = "all" | "departments" | "selection";

interface ComparisonWorkspaceProps {
  members: ComparisonMember[];
  teamName: string;
  named: boolean;
  /**
   * Enables the Members / Departments / History switch. History lives on its
   * own surface rather than sharing this canvas — member comparison and
   * period comparison answer different questions and reading them together
   * makes both harder.
   */
  teamId?: string;
  /**
   * Rendered inside the presentation deck, which already owns the
   * anonymize toggle, department filter, print and full-screen controls.
   * Suppresses this component's duplicates of them.
   */
  embedded?: boolean;
}

const SCOPE_LABEL: Record<Scope, string> = {
  all: "All members",
  departments: "By department",
  selection: "Selected members",
};

export function ComparisonWorkspace({
  members,
  teamName,
  named,
  teamId,
  embedded = false,
}: ComparisonWorkspaceProps) {
  const reduced = useReducedMotion();
  const [scope, setScope] = useState<Scope>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [committed, setCommitted] = useState<string[]>([]);
  const [presentation, setPresentation] = useState(false);

  const departments = useMemo(
    () => [...new Set(members.map((member) => member.department).filter(Boolean))],
    [members],
  );

  const committedMembers = useMemo(
    () => committed.flatMap((id) => members.filter((member) => member.id === id)),
    [committed, members],
  );

  const sets: ComparisonSet[] = useMemo(() => {
    if (scope === "departments") return buildCohorts(members);
    if (scope === "selection") {
      if (committedMembers.length === 0) return [];
      return [
        {
          id: "selection",
          label: "Selected members",
          detail: `${committedMembers.length} member${committedMembers.length === 1 ? "" : "s"}`,
          members: committedMembers,
        },
      ];
    }
    return buildBatches(members);
  }, [scope, members, committedMembers]);

  /*
   * Which set is on screen. Changing scope, or committing a new selection,
   * rebuilds the set list — and the old pointer can land past its end. Rather
   * than resetting from an effect (a second render, and a frame of the wrong
   * set), the pointer carries the list it belongs to and is simply ignored
   * once that list changes.
   */
  const setsKey = `${scope}:${committed.join(",")}`;
  const [pointer, setPointer] = useState({ key: setsKey, index: 0 });
  const setIndex = pointer.key === setsKey ? pointer.index : 0;
  const setSetIndex = useCallback(
    (next: number | ((current: number) => number)) =>
      setPointer((current) => {
        const base = current.key === setsKey ? current.index : 0;
        return {
          key: setsKey,
          index: typeof next === "function" ? next(base) : next,
        };
      }),
    [setsKey],
  );

  const activeSet = sets[Math.min(setIndex, Math.max(0, sets.length - 1))];
  const cards = useMemo(() => activeSet?.members ?? [], [activeSet]);
  const layout = comparisonLayout(cards.length);

  /*
   * Projection pagination. On a monitor the whole set is readable at once; on
   * a projector three cards is the honest maximum, so presentation mode
   * windows the set and the facilitator advances. Density is traded for
   * legibility rather than type size.
   */
  const slideKey = `${scope}:${activeSet?.id ?? ""}`;
  const [slidePointer, setSlidePointer] = useState({ key: slideKey, index: 0 });
  const rawSlide = slidePointer.key === slideKey ? slidePointer.index : 0;
  const slide = slideWindow(cards.length, rawSlide);
  const goToSlide = useCallback(
    (delta: number) =>
      setSlidePointer((current) => ({
        key: slideKey,
        index: (current.key === slideKey ? current.index : 0) + delta,
      })),
    [slideKey],
  );
  const projected = presentation ? cards.slice(slide.from - 1, slide.to) : cards;
  const projectedLayout = presentation
    ? comparisonLayout(projected.length)
    : layout;
  const readout = useMemo(
    () => comparisonReadout(cards, activeSet?.label ?? "This set"),
    [cards, activeSet?.label],
  );
  const averages = useMemo(() => groupAverage(cards), [cards]);
  const divergences = useMemo(() => dimensionDivergence(cards), [cards]);
  const counts = useMemo(() => styleCounts(cards), [cards]);
  const highBands = useMemo(() => highBandCounts(cards), [cards]);

  const compare = useCallback(() => {
    setCommitted(selected);
    setScope("selection");
  }, [selected]);

  const goToSet = useCallback(
    (delta: number) =>
      setSetIndex((current) =>
        sets.length === 0 ? 0 : (current + delta + sets.length) % sets.length,
      ),
    [sets.length, setSetIndex],
  );

  if (members.length === 0) {
    return (
      <div className="paper-card flex flex-col items-start gap-3 p-8">
        <p className="max-w-md text-sm leading-relaxed text-slate">
          No completed profiles yet. Member comparison appears once participants
          finish their assessments — track progress from the team dashboard.
        </p>
      </div>
    );
  }

  if (members.length === 1) {
    return (
      <div className="paper-card flex flex-col items-start gap-3 p-8">
        <p className="max-w-md text-sm leading-relaxed text-slate">
          Only one completed profile so far. Comparison needs at least two —
          the individual report is available from the team dashboard in the
          meantime.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {!named && !embedded ? (
        <p className="rounded-2xl border border-sage bg-sage/20 px-5 py-3 text-sm text-slate">
          This team reports anonymously — participants appear as letters, never
          names. The setting is controlled in Team settings.
        </p>
      ) : null}

      {/* Members · Departments · History — three distinct questions, kept on
          separate canvases rather than stacked into one dense screen. */}
      {teamId ? (
        <nav
          aria-label="Comparison mode"
          className="flex gap-1 overflow-x-auto rule-b pb-px print:hidden"
        >
          {[
            { href: `/app/teams/${teamId}/compare`, label: "Members", active: true },
            { href: `/app/teams/${teamId}/compare?scope=departments`, label: "Departments", active: false },
            { href: `/app/teams/${teamId}/history`, label: "History", active: false },
          ].map((mode) => (
            <Link
              key={mode.label}
              href={mode.href}
              aria-current={mode.active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors",
                mode.active
                  ? "border-botanical font-medium text-botanical"
                  : "border-transparent text-slate hover:text-ink",
              )}
            >
              {mode.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {/* scope + presentation controls */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div
          role="group"
          aria-label="Comparison scope"
          className="flex rounded-full border border-hairline bg-paper p-1"
        >
          {(["all", "departments", "selection"] as const)
            .filter((value) => value !== "departments" || departments.length > 0)
            .map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={scope === value}
                onClick={() => setScope(value)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                  scope === value
                    ? "bg-botanical text-mineral"
                    : "text-slate hover:text-ink",
                )}
              >
                {SCOPE_LABEL[value]}
              </button>
            ))}
        </div>

        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
          {members.length} completed · {MAX_CARDS_PER_VIEW} per screen
        </span>

        {!embedded ? (
          <>
            <button
              type="button"
              onClick={() => setPresentation((value) => !value)}
              aria-pressed={presentation}
              className={cn(
                "ml-auto rounded-full border px-4 py-1.5 text-xs transition-colors",
                presentation
                  ? "border-botanical text-botanical"
                  : "border-hairline text-slate hover:border-botanical hover:text-botanical",
              )}
            >
              Presentation {presentation ? "on" : "off"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full border border-hairline px-4 py-1.5 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical"
            >
              Export PDF
            </button>
          </>
        ) : null}
      </div>

      <div
        className={cn(
          "grid gap-6",
          presentation ? "presentation-scale grid-cols-1" : "lg:grid-cols-[320px_1fr]",
        )}
      >
        {!presentation ? (
          <ComparisonTray
            members={members}
            selected={selected}
            onSelectedChange={setSelected}
            onCompare={compare}
            className="h-fit lg:sticky lg:top-6 print:hidden"
          />
        ) : null}

        <div className="flex min-w-0 flex-col gap-6">
          {/* set switcher */}
          {sets.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              {sets.map((set, index) => (
                <button
                  key={set.id}
                  type="button"
                  aria-pressed={index === setIndex}
                  onClick={() => setSetIndex(index)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-xs transition-colors",
                    index === setIndex
                      ? "border-botanical bg-sage/25 text-botanical"
                      : "border-hairline text-slate hover:border-botanical hover:text-botanical",
                  )}
                >
                  {set.label}
                  <span className="ml-2 font-mono text-[10px] text-faint">
                    {set.members.length}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {sets.length === 0 ? (
            <div className="paper-card p-8">
              <p className="max-w-md text-sm leading-relaxed text-slate">
                Nothing selected yet. Tick two or more participants in the tray
                and choose Compare — they render in the interface on the right.
              </p>
            </div>
          ) : null}

          {activeSet ? (
            <AnimatePresence mode="wait">
              <motion.section
                key={`${scope}-${activeSet.id}`}
                aria-label={`Comparison — ${activeSet.label}`}
                initial={reduced ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.32, 0.94, 0.6, 1] }}
                className="flex flex-col gap-6"
              >
                <header className="flex flex-col gap-1.5">
                  <Eyebrow>
                    {teamName} · {activeSet.detail}
                  </Eyebrow>
                  <h2
                    className={cn(
                      "font-display font-semibold text-ink",
                      presentation ? "text-h2" : "text-h3",
                    )}
                  >
                    {readout.headline}
                  </h2>
                </header>

                {/* the cards — same anatomy at every set size */}
                <div className="paper-card p-6 lg:p-7">
                  {projectedLayout.scrolls && !presentation ? (
                    <div className="-mx-6 overflow-x-auto px-6 pb-2 lg:-mx-7 lg:px-7">
                      <div
                        className="grid gap-7"
                        style={{
                          gridTemplateColumns: `repeat(${cards.length}, minmax(240px, 1fr))`,
                          minWidth: `${cards.length * 252}px`,
                        }}
                      >
                        {projected.map((member) => (
                          <ComparisonCard
                            key={member.id}
                            member={member}
                            reach={member}
                            presentation={presentation}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "grid gap-7",
                        projectedLayout.mode === "duo"
                          ? "sm:grid-cols-2"
                          : projectedLayout.columns === 3
                            ? "sm:grid-cols-2 lg:grid-cols-3"
                            : "sm:grid-cols-2 lg:grid-cols-4",
                      )}
                    >
                      {projected.map((member, index) => (
                        <ComparisonCard
                          key={member.id}
                          member={member}
                          /* In a pair, each column teaches you to reach the
                             person opposite — exactly as the two-member
                             comparison has always read. */
                          reach={
                            projectedLayout.mode === "duo"
                              ? (projected[index === 0 ? 1 : 0] ?? member)
                              : member
                          }
                          presentation={presentation}
                        />
                      ))}
                    </div>
                  )}
                  {projectedLayout.scrolls && !presentation ? (
                    <p className="pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-faint print:hidden">
                      Scroll sideways for the rest of this set
                    </p>
                  ) : null}

                  {/* Projected sets advance a slide at a time rather than
                      squeezing ten cards across one screen. */}
                  {presentation && slide.slideCount > 1 ? (
                    <div className="mt-5 flex items-center justify-between rule-t pt-5 print:hidden">
                      <button
                        type="button"
                        onClick={() => goToSlide(-1)}
                        aria-label="Previous members"
                        className="pres-h3 flex size-14 items-center justify-center rounded-full border border-hairline-strong bg-paper text-ink transition-colors hover:border-botanical"
                      >
                        ←
                      </button>
                      <span aria-live="polite" className="pres-label font-mono text-slate">
                        {slide.label}
                        <span className="pl-3 text-faint">
                          slide {slide.index + 1} of {slide.slideCount}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => goToSlide(1)}
                        aria-label="Next members"
                        className="pres-h3 flex size-14 items-center justify-center rounded-full border border-hairline-strong bg-paper text-ink transition-colors hover:border-botanical"
                      >
                        →
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* set intelligence */}
                <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="paper-card flex flex-col gap-4 p-6">
                    <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
                      Set profile
                    </h3>
                    <DiscRadarOverlay
                      series={[
                        { label: "Set average", scores: averages },
                        ...cards.slice(0, 6).map((member) => ({
                          label: member.label,
                          scores: member.scores,
                          color: `var(--color-disc-${member.primary.toLowerCase()})`,
                        })),
                      ]}
                      className="mx-auto max-w-[300px]"
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 rule-t pt-3">
                      {DIMENSIONS.map((dim) => (
                        <span key={dim} className="flex items-center gap-1.5 text-xs text-slate">
                          <span
                            aria-hidden
                            className="size-2 rounded-full"
                            style={{ background: `var(--color-disc-${dim.toLowerCase()})` }}
                          />
                          {dimensionMeta[dim].label}
                          <span className="font-mono text-faint">
                            {counts[dim]} lead · {highBands[dim]} strong
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-5">
                    <div className="paper-card flex flex-col gap-3.5 p-6">
                      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
                        Where this set diverges
                      </h3>
                      <ul className="flex flex-col gap-2.5">
                        {divergences.map((entry) => (
                          <li key={entry.dimension} className="flex flex-col gap-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="text-sm font-medium text-ink">
                                {dimensionMeta[entry.dimension].label}
                              </span>
                              <span className="font-mono text-xs text-faint">
                                {entry.low}–{entry.high} · {entry.range} pts
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-ink/8">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  marginLeft: `${entry.low}%`,
                                  width: `${Math.max(1.5, entry.range)}%`,
                                  background: `var(--color-disc-${entry.dimension.toLowerCase()})`,
                                }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="paper-card flex flex-col gap-3 p-6">
                      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
                        Facilitator read
                      </h3>
                      <ul className="flex flex-col gap-2.5">
                        {readout.points.map((point) => (
                          <li
                            key={point}
                            className="flex items-start gap-3 text-sm leading-relaxed text-slate"
                          >
                            <span
                              aria-hidden
                              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal"
                            />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.section>
            </AnimatePresence>
          ) : null}

          {/* set navigation */}
          {sets.length > 1 ? (
            <div className="flex items-center justify-between print:hidden">
              <button
                type="button"
                onClick={() => goToSet(-1)}
                aria-label="Previous set"
                className="flex size-11 items-center justify-center rounded-full border border-hairline-strong bg-paper text-ink transition-colors hover:border-botanical"
              >
                ←
              </button>
              <span className="font-mono text-xs text-faint">
                Set {setIndex + 1} of {sets.length}
              </span>
              <button
                type="button"
                onClick={() => goToSet(1)}
                aria-label="Next set"
                className="flex size-11 items-center justify-center rounded-full border border-hairline-strong bg-paper text-ink transition-colors hover:border-botanical"
              >
                →
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
