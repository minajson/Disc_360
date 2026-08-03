"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { dimensionMeta } from "@/data/dimension-meta";
import {
  MAX_CARDS_PER_VIEW,
  filterMembers,
  toggleSelection,
  type ComparisonMember,
} from "@/lib/insights/comparison";

/**
 * The "Compare members" tray.
 *
 * Search, a checkbox roster, the running selection and one Compare button.
 * Everything the facilitator picks feeds the same comparison interface the
 * two-member view uses — only the data source changes.
 *
 * Performance: the roster is windowed. An organisation with 100+ participants
 * renders roughly twenty rows regardless of roster size, with spacers holding
 * the scrollbar honest, so scrolling stays at frame rate and re-renders stay
 * proportional to what is visible rather than to the roster.
 */

const ROW_HEIGHT = 44;
const OVERSCAN = 6;
const VIEWPORT_HEIGHT = 396; // 9 rows

interface ComparisonTrayProps {
  members: ComparisonMember[];
  selected: string[];
  onSelectedChange: (next: string[]) => void;
  onCompare: () => void;
  className?: string;
}

export function ComparisonTray({
  members,
  selected,
  onSelectedChange,
  onCompare,
  className,
}: ComparisonTrayProps) {
  const [query, setQuery] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const visibleMembers = useMemo(
    () => filterMembers(members, query),
    [members, query],
  );

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(
    visibleMembers.length,
    Math.ceil((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT) + OVERSCAN,
  );
  const rows = visibleMembers.slice(first, last);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedMembers = useMemo(
    () => selected.flatMap((id) => members.filter((member) => member.id === id)),
    [selected, members],
  );

  const toggle = useCallback(
    (id: string) => onSelectedChange(toggleSelection(selected, id)),
    [onSelectedChange, selected],
  );

  const atCeiling = selected.length >= MAX_CARDS_PER_VIEW;

  return (
    <aside
      aria-label="Compare members"
      className={cn("paper-card flex flex-col gap-4 p-6", className)}
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
          Compare members
        </h2>
        <p className="text-sm leading-relaxed text-slate">
          Pick up to {MAX_CARDS_PER_VIEW} participants. They render in the same
          comparison interface used for one-to-one coaching.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="sr-only">Search participants</span>
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setScrollTop(0);
            viewportRef.current?.scrollTo({ top: 0 });
          }}
          placeholder="Search participant, department or style…"
          className="w-full rounded-full border border-hairline bg-mineral px-4 py-2.5 text-sm text-ink placeholder:text-faint focus:border-botanical focus:outline-none"
        />
      </label>

      <div
        ref={viewportRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        className="overflow-y-auto rounded-2xl border border-hairline bg-mineral"
        style={{ height: VIEWPORT_HEIGHT }}
      >
        {visibleMembers.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate">
            No participants match “{query}”.
          </p>
        ) : (
          <div style={{ height: visibleMembers.length * ROW_HEIGHT, position: "relative" }}>
            <ul
              className="absolute inset-x-0"
              style={{ transform: `translateY(${first * ROW_HEIGHT}px)` }}
            >
              {rows.map((member) => {
                const checked = selectedSet.has(member.id);
                const disabled = !checked && atCeiling;
                return (
                  <li key={member.id} style={{ height: ROW_HEIGHT }}>
                    <label
                      className={cn(
                        "flex h-full cursor-pointer items-center gap-3 px-3.5 transition-colors",
                        checked ? "bg-sage/25" : "hover:bg-ink/[0.03]",
                        disabled && "cursor-not-allowed opacity-45",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(member.id)}
                        className="size-4 shrink-0 accent-[var(--color-botanical)]"
                      />
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          background: `var(--color-disc-${member.primary.toLowerCase()})`,
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {member.label}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                        {member.department ?? dimensionMeta[member.primary].label}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 rule-t pt-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Selected
          </span>
          <span
            className={cn(
              "font-mono text-xs",
              atCeiling ? "text-disc-i" : "text-slate",
            )}
          >
            {selected.length} / {MAX_CARDS_PER_VIEW} selected
          </span>
        </div>

        {selectedMembers.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {selectedMembers.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => toggle(member.id)}
                  className="flex items-center gap-1.5 rounded-full border border-hairline bg-paper py-1 pl-3 pr-2 text-xs text-ink transition-colors hover:border-botanical"
                >
                  {member.label}
                  <span aria-hidden className="text-faint">×</span>
                  <span className="sr-only">Remove {member.label} from the selection</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate">
            Nothing selected yet — tick two or more participants.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={onCompare}
            disabled={selected.length < 2}
            className="rounded-full bg-botanical px-6 py-2.5 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-faint"
          >
            Compare
          </button>
          {selected.length > 0 ? (
            <button
              type="button"
              onClick={() => onSelectedChange([])}
              className="rounded-full border border-hairline px-4 py-2.5 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
