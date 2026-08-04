"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { CATEGORY_TITLE, type InsightCategory } from "@/lib/insights/facilitator";
import type { NarrativeBrief, NarrativeSummary } from "@/lib/ai/narrative";

/**
 * The brief a facilitator reads before walking into the room, and the summary
 * an executive reads instead of the deck.
 *
 * Both are always present — written by rule when no narrative has been
 * generated — so the surface never depends on a model being available. The
 * provenance badge above says which is which.
 */

function Column({
  label,
  lines,
  quoted = false,
  presentation,
}: {
  label: string;
  lines: string[];
  quoted?: boolean;
  presentation: boolean;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <span
        className={cn(
          "font-mono uppercase tracking-[0.16em] text-faint",
          presentation ? "pres-label" : "text-[10px]",
        )}
      >
        {label}
      </span>
      <ul className="flex flex-col gap-2">
        {lines.map((line, index) => (
          <li
            key={`${label}-${index}`}
            className={cn(
              "flex items-start gap-2.5 text-ink",
              presentation ? "pres-body pres-measure" : "text-sm leading-relaxed",
            )}
          >
            <span
              aria-hidden
              className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-sage"
            />
            {quoted ? `“${line}”` : line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FacilitatorBriefPanel({
  brief,
  summary,
  presentation = false,
}: {
  brief: NarrativeBrief;
  summary: NarrativeSummary;
  presentation?: boolean;
}) {
  const reduced = useReducedMotion();

  return (
    <section aria-label="Facilitator brief" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Before the room</Eyebrow>
        <h2 className={cn("font-display font-semibold", presentation ? "pres-h2" : "text-h3")}>
          Facilitator brief
        </h2>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.article
          data-reveal
          className="paper-card flex flex-col gap-5 p-6 lg:p-7"
          initial={reduced ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, ease: [0.32, 0.94, 0.6, 1] }}
        >
          <div className="flex flex-col gap-2">
            <span
              className={cn(
                "font-mono uppercase tracking-[0.16em] text-teal",
                presentation ? "pres-label" : "text-[10px]",
              )}
            >
              Open with this
            </span>
            <p
              className={cn(
                "text-ink",
                presentation ? "pres-body pres-measure" : "text-sm leading-relaxed",
              )}
            >
              {brief.opening}
            </p>
          </div>
          <div className="rule-t pt-5">
            <Column
              label="Say what the data shows"
              lines={brief.observations}
              presentation={presentation}
            />
          </div>
          <div className="rule-t pt-5">
            <Column
              label="Ask the room"
              lines={brief.questions}
              quoted
              presentation={presentation}
            />
          </div>
        </motion.article>

        <motion.article
          data-reveal
          className="paper-card flex flex-col gap-5 p-6 lg:p-7"
          initial={reduced ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, delay: 0.05, ease: [0.32, 0.94, 0.6, 1] }}
        >
          <Column label="Watch for" lines={brief.watchPoints} presentation={presentation} />
          <div className="rule-t pt-5">
            <Column label="Facilitation moves" lines={brief.actions} presentation={presentation} />
          </div>
          {brief.slideOrder.length > 0 ? (
            <div className="flex flex-col gap-2 rule-t pt-5">
              <span
                className={cn(
                  "font-mono uppercase tracking-[0.16em] text-faint",
                  presentation ? "pres-label" : "text-[10px]",
                )}
              >
                Suggested order
              </span>
              <ol className="flex flex-wrap gap-1.5">
                {brief.slideOrder.map((category, index) => (
                  <li
                    key={category}
                    className="inline-flex items-baseline gap-1.5 rounded-full border border-hairline bg-mineral px-2.5 py-1"
                  >
                    <span className="font-mono text-[10px] text-faint">{index + 1}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate">
                      {CATEGORY_TITLE[category as InsightCategory] ?? category}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </motion.article>
      </div>

      <motion.article
        data-reveal
        className="paper-card flex flex-col gap-4 p-6 lg:p-7"
        initial={reduced ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.32, 0.94, 0.6, 1] }}
      >
        <span
          className={cn(
            "font-mono uppercase tracking-[0.2em] text-teal",
            presentation ? "pres-label" : "text-[11px]",
          )}
        >
          Executive summary
        </span>
        <h3
          className={cn(
            "font-display font-semibold leading-snug text-ink",
            presentation ? "pres-h2" : "text-lg lg:text-xl",
          )}
        >
          {summary.headline}
        </h3>
        {summary.paragraphs.map((paragraph, index) => (
          <p
            key={index}
            className={cn(
              "text-slate",
              presentation ? "pres-body pres-measure" : "text-sm leading-relaxed",
            )}
          >
            {paragraph}
          </p>
        ))}
      </motion.article>
    </section>
  );
}
