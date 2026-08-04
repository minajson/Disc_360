"use client";

import { useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { FacilitatorBriefPanel } from "@/components/teams/insights/FacilitatorBriefPanel";
import type { NarrativeBrief, NarrativeSummary } from "@/lib/ai/narrative";
import { dimensionMeta } from "@/data/dimension-meta";
import { DIMENSION_KEY, DIMENSIONS } from "@/lib/types";
import {
  CATEGORY_TITLE,
  INTERPRETATION_HEADING,
  MIN_GROUP_SIZE,
  SIGNAL_LABEL,
  type DepartmentInsight,
  type FacilitatorInsight,
  type FacilitatorInsightSet,
  type SignalStrength,
} from "@/lib/insights/facilitator";

/**
 * Facilitator Insights — the interpretation layer.
 *
 * This surface never recalculates a DISC score, never writes to a result and
 * never changes a participant's profile. It reads aggregate team data that has
 * already been authorized and anonymized upstream, and presents it as
 * observation, hedged interpretation, and the evidence both rest on.
 *
 * Design: layered paper cards, progressive disclosure, a four-segment signal
 * meter and compact evidence chips — the existing Meridian language, no chat
 * bubbles and no AI iconography.
 */

const SIGNAL_STEPS: Record<SignalStrength, number> = {
  strong: 4,
  moderate: 3,
  emerging: 2,
  insufficient: 1,
};

const SIGNAL_TONE: Record<SignalStrength, string> = {
  strong: "var(--color-disc-s)",
  moderate: "var(--color-teal)",
  emerging: "var(--color-disc-i)",
  insufficient: "var(--color-faint)",
};

function SignalMeter({ signal }: { signal: SignalStrength }) {
  const steps = SIGNAL_STEPS[signal];
  return (
    <span className="flex items-center gap-2" title={SIGNAL_LABEL[signal]}>
      <span aria-hidden className="flex items-end gap-0.5">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className="w-1 rounded-full"
            style={{
              height: `${4 + step * 2}px`,
              background: step <= steps ? SIGNAL_TONE[signal] : "var(--color-hairline-strong)",
            }}
          />
        ))}
      </span>
      <span
        className="font-mono text-[10px] uppercase tracking-[0.14em]"
        style={{ color: SIGNAL_TONE[signal] }}
      >
        {SIGNAL_LABEL[signal]}
      </span>
    </span>
  );
}

function EvidenceChips({ insight }: { insight: FacilitatorInsight }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {insight.evidence.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex items-baseline gap-1.5 rounded-full border border-hairline bg-mineral px-2.5 py-1"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
            {chip.label}
          </span>
          <span className="font-mono text-xs text-ink">{chip.value}</span>
        </span>
      ))}
    </div>
  );
}

function InsightCard({
  insight,
  index,
  generatedAt,
  basis,
  scopeLabel,
  presentation = false,
  defaultOpen = false,
}: {
  insight: FacilitatorInsight;
  index: number;
  generatedAt: string;
  basis: string;
  scopeLabel: string;
  presentation?: boolean;
  defaultOpen?: boolean;
}) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen);

  const coverage =
    insight.populationSize > 0
      ? Math.round((insight.sampleSize / insight.populationSize) * 100)
      : 0;

  return (
    <motion.article
      data-reveal
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
      <header className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={cn(
            "font-mono uppercase tracking-[0.2em] text-teal",
            presentation ? "pres-mono" : "text-[11px]",
          )}
        >
          {CATEGORY_TITLE[insight.category]}
        </span>
        <SignalMeter signal={insight.signal} />
      </header>

      <h3
        className={cn(
          "font-display font-semibold leading-snug text-ink",
          presentation ? "pres-h2" : "text-lg lg:text-xl",
        )}
      >
        {insight.title}
      </h3>

      <p
        className={cn(
          "text-slate",
          presentation ? "pres-body pres-measure" : "text-sm leading-relaxed",
        )}
      >
        {insight.observation}
      </p>

      <div className="flex flex-col gap-2 rule-t pt-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
          {INTERPRETATION_HEADING}
        </span>
        <ul className="flex flex-col gap-2">
          {insight.interpretation.map((line) => (
            <li
              key={line}
              className={cn(
                "flex items-start gap-2.5 text-ink",
                presentation ? "pres-body pres-measure" : "text-sm leading-relaxed",
              )}
            >
              <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-sage" />
              {line}
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="self-start font-mono text-[10px] uppercase tracking-[0.16em] text-teal transition-colors hover:text-botanical print:hidden"
      >
        {open ? "Hide evidence" : "Show evidence and questions"}
      </button>

      {open ? (
        <motion.div
          className="flex flex-col gap-4"
          initial={reduced ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.25, ease: [0.32, 0.94, 0.6, 1] }}
        >
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              Evidence
            </span>
            <EvidenceChips insight={insight} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              Ask the room
            </span>
            <ul className="flex flex-col gap-2">
              {insight.questions.map((question) => (
                <li key={question} className="text-sm leading-relaxed text-slate">
                  “{question}”
                </li>
              ))}
            </ul>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rule-t pt-3 font-mono text-[10px] uppercase tracking-[0.12em]">
            <dt className="text-faint">Based on</dt>
            <dd className="text-slate">
              {insight.sampleSize} of {insight.populationSize} · {coverage}%
            </dd>
            <dt className="text-faint">Scope</dt>
            <dd className="truncate text-slate" title={scopeLabel}>
              {scopeLabel}
            </dd>
            <dt className="text-faint">Basis</dt>
            <dd className="text-slate">{basis} data</dd>
            <dt className="text-faint">Generated</dt>
            <dd className="text-slate">{generatedAt}</dd>
          </dl>
        </motion.div>
      ) : null}
    </motion.article>
  );
}

function Suppressed({ message }: { message: string }) {
  return (
    <div className="paper-card flex flex-col items-start gap-3 p-8">
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-disc-i">
        Insufficient data
      </span>
      <p className="max-w-xl text-sm leading-relaxed text-slate">{message}</p>
      <p className="max-w-xl text-xs leading-relaxed text-faint">
        Group patterns are suppressed below {MIN_GROUP_SIZE} completed profiles.
        With fewer than that, a “team pattern” describes individuals rather than
        a group, and would identify them.
      </p>
    </div>
  );
}

function DepartmentRow({ department }: { department: DepartmentInsight }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="paper-card flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-base font-semibold text-ink">
            {department.department}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            {department.completedCount} of {department.memberCount} completed
          </span>
        </div>
        <SignalMeter signal={department.signal} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {DIMENSIONS.map((dim) => (
          <span key={dim} className="flex items-center gap-1.5 font-mono text-xs">
            <span style={{ color: `var(--color-disc-${dim.toLowerCase()})` }}>
              {dimensionMeta[dim].displayCode}
            </span>
            <span className="text-ink">{department.averages[DIMENSION_KEY[dim]]}</span>
          </span>
        ))}
        <span
          className="rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
          style={{
            background: `var(--color-disc-${department.lead.toLowerCase()}-soft)`,
            color: `var(--color-disc-${department.lead.toLowerCase()})`,
          }}
        >
          {dimensionMeta[department.lead].label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          Balance {department.balanceIndex}
        </span>
      </div>

      {department.suppressed ? (
        <p className="rule-t pt-3 text-sm leading-relaxed text-slate">
          {department.suppressed}
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="self-start font-mono text-[10px] uppercase tracking-[0.16em] text-teal transition-colors hover:text-botanical print:hidden"
          >
            {open ? "Hide department read" : "Read this department"}
          </button>
          {open ? (
            <div className="flex flex-col gap-3 rule-t pt-4">
              {(department.insights ?? []).slice(0, 3).map((insight) => (
                <div key={insight.category} className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                    {CATEGORY_TITLE[insight.category]}
                  </span>
                  <span className="text-sm font-medium text-ink">{insight.title}</span>
                  <span className="text-sm leading-relaxed text-slate">
                    {insight.observation}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export interface FacilitatorInsightsViewProps {
  set: FacilitatorInsightSet;
  departments: DepartmentInsight[];
  teamName: string;
  memberCount: number;
  completedCount: number;
  /** True once a model has written the narrative. */
  aiGenerated?: boolean;
  /** Facilitator brief and executive summary — rule-written until generated. */
  brief?: NarrativeBrief;
  summary?: NarrativeSummary;
  /** Generation controls. Absent inside the deck, which is read-only. */
  controls?: ReactNode;
  /** Embedded inside the presentation deck — drops the page header. */
  embedded?: boolean;
}

export function FacilitatorInsightsView({
  set,
  departments,
  teamName,
  memberCount,
  completedCount,
  aiGenerated = false,
  brief,
  summary,
  controls,
  embedded = false,
}: FacilitatorInsightsViewProps) {
  const [presentation, setPresentation] = useState(false);
  const [slide, setSlide] = useState(0);

  const generatedAt = useMemo(
    () =>
      new Date(set.scope.generatedAt).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [set.scope.generatedAt],
  );

  const reportable = departments.filter((department) => !department.suppressed).length;

  /*
   * Projection mode. Eight evidence cards in a two-column grid is right for an
   * analyst and wrong for a room: at projector distance the observation and
   * the "what this may mean" block stop being readable together. So one
   * category fills the slide and the facilitator advances.
   */
  const total = set.insights.length;
  const card = total > 0 ? set.insights[Math.min(slide, total - 1)]! : null;

  return (
    <div className="flex flex-col gap-8">
      {!embedded ? (
        <header className="flex flex-col gap-3">
          <Eyebrow>Facilitator insights · {teamName}</Eyebrow>
          <h1 className="font-display text-h2 font-semibold">
            What this team&apos;s data supports
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-slate">
            An interpretation layer over the team&apos;s completed profiles. It
            reads results — it never changes them, never recalculates a score
            and never alters a participant&apos;s profile.
          </p>
        </header>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className={cn(
            "rounded-full px-3.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em]",
            aiGenerated ? "bg-ink text-mineral" : "border border-hairline text-slate",
          )}
        >
          {aiGenerated ? "AI-generated" : "Generated from team data"}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
          {completedCount} of {memberCount} completed · {set.scope.basis} data ·{" "}
          {generatedAt}
        </span>
        <button
          type="button"
          onClick={() => setPresentation((value) => !value)}
          aria-pressed={presentation}
          className={cn(
            "ml-auto rounded-full px-5 py-1.5 text-xs font-medium transition-colors print:hidden",
            presentation
              ? "bg-botanical text-mineral"
              : "border border-hairline text-slate hover:border-botanical hover:text-botanical",
          )}
        >
          {presentation ? "Exit presentation" : "Presentation mode"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full border border-hairline px-4 py-1.5 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical print:hidden"
        >
          Export PDF
        </button>
      </div>

      {controls}

      {!set.suppressed && brief && summary ? (
        <div className={presentation ? "presentation-scale" : undefined}>
          <FacilitatorBriefPanel brief={brief} summary={summary} presentation={presentation} />
        </div>
      ) : null}

      {set.suppressed ? (
        <Suppressed message={set.suppressed} />
      ) : presentation && card ? (
        <section aria-label="Insight cards" className="presentation-scale flex flex-col gap-5">
          <InsightCard
            key={card.category}
            insight={card}
            index={0}
            generatedAt={generatedAt}
            basis={set.scope.basis}
            scopeLabel={set.scope.label}
            presentation
            defaultOpen
          />
          <div className="flex items-center justify-between print:hidden">
            <button
              type="button"
              onClick={() => setSlide((n) => (n - 1 + total) % total)}
              aria-label="Previous insight"
              className="pres-h3 flex size-14 items-center justify-center rounded-full border border-hairline-strong bg-paper text-ink transition-colors hover:border-botanical"
            >
              ←
            </button>
            <span aria-live="polite" className="pres-label font-mono text-slate">
              {CATEGORY_TITLE[card.category]}
              <span className="pl-3 text-faint">
                {Math.min(slide, total - 1) + 1} of {total}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setSlide((n) => (n + 1) % total)}
              aria-label="Next insight"
              className="pres-h3 flex size-14 items-center justify-center rounded-full border border-hairline-strong bg-paper text-ink transition-colors hover:border-botanical"
            >
              →
            </button>
          </div>
        </section>
      ) : (
        <section aria-label="Insight cards" className="grid gap-5 lg:grid-cols-2">
          {set.insights.map((insight, index) => (
            <InsightCard
              key={insight.category}
              insight={insight}
              index={index}
              generatedAt={generatedAt}
              basis={set.scope.basis}
              scopeLabel={set.scope.label}
            />
          ))}
        </section>
      )}

      {departments.length > 1 ? (
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Eyebrow>Departments in this team</Eyebrow>
            <h2 className="font-display text-h3 font-semibold">
              Where the departments differ
            </h2>
            <p className="max-w-3xl text-sm leading-relaxed text-slate">
              {reportable} of {departments.length} departments carry enough
              completed profiles for a group read. Departments below{" "}
              {MIN_GROUP_SIZE} completed profiles show coverage only.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {departments.map((department) => (
              <DepartmentRow key={department.department} department={department} />
            ))}
          </div>
        </section>
      ) : null}

      <p className="max-w-3xl text-xs leading-relaxed text-faint">
        These insights describe behavioural preferences expressed in a work
        context, in aggregate. They are not a psychological, medical or clinical
        assessment, are not a measure of ability or performance, and must not be
        used for selection decisions. Individual assessment responses are never
        included and remain readable only by their author.
      </p>
    </div>
  );
}
