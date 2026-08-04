"use client";

import { cn } from "@/lib/utils/cn";
import { DiscRadarChart } from "@/components/charts/DiscRadarChart";
import { dimensionMeta } from "@/data/dimension-meta";
import { insightMap } from "@/data/insight-maps";
import { DIMENSION_KEY, DIMENSIONS, type Dimension } from "@/lib/types";
import type { ComparisonMember } from "@/lib/insights/comparison";

/**
 * One member in a comparison set — the same anatomy as the two-member
 * comparison on the Pairings tab: name, archetype, DISC kite, and the two
 * things that actually reach this person.
 *
 * The reading order is unchanged and the numbers are unchanged. What changed
 * is the register: on the board each member is a card of their own, at the
 * size of an executive profile rather than a dashboard tile, because a card
 * that has to be leaned into is not one a room can read together.
 *
 * Type sizes come from the board's container scale (`--cmp-*`), so a card on a
 * conference display grows with the board and never below the floor the
 * surface promises. In presentation mode the projector scale takes over
 * instead — that path is untouched.
 */

const discColor = (dim: Dimension) => `var(--color-disc-${dim.toLowerCase()})`;

interface ComparisonCardProps {
  member: ComparisonMember;
  /**
   * Whose communication guidance this card carries. In a two-person set this
   * is the other member (mirroring the original layout, where each column
   * teaches you to reach the person opposite). In larger sets it is the
   * member on the card, because there is no single "other".
   */
  reach: ComparisonMember;
  /** Larger type and chart for the projector. */
  presentation?: boolean;
  className?: string;
}

export function ComparisonCard({
  member,
  reach,
  presentation = false,
  className,
}: ComparisonCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col",
        presentation
          ? "gap-3"
          : "paper-card gap-(--cmp-gap) p-(--cmp-pad)",
        className,
      )}
    >
      <header className="flex flex-col gap-2">
        <h3
          className={cn(
            "font-display font-semibold text-ink",
            presentation ? "text-xl" : "cmp-name",
          )}
        >
          {member.label}
        </h3>
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-1",
            presentation ? "font-mono text-[10px]" : "cmp-mono font-mono",
            "uppercase tracking-[0.14em] text-faint",
          )}
        >
          <span
            className="rounded-full px-3 py-1"
            style={{
              color: discColor(member.primary),
              background: `var(--color-disc-${member.primary.toLowerCase()}-soft)`,
            }}
          >
            {dimensionMeta[member.primary].label}
          </span>
          <span className="text-slate">{member.archetypeName}</span>
          {member.department ? <span>· {member.department}</span> : null}
          {member.roleTitle ? <span>· {member.roleTitle}</span> : null}
        </div>
      </header>

      <DiscRadarChart
        scores={member.scores}
        showScores={false}
        className={cn(
          "mx-auto w-full",
          presentation ? "max-w-[240px]" : "max-w-(--cmp-radar)",
        )}
      />

      <dl
        className={cn(
          "grid grid-cols-4 gap-2 rule-t pt-(--cmp-gap)",
          presentation && "pt-2.5",
        )}
      >
        {DIMENSIONS.map((dim) => (
          <div key={dim} className="flex flex-col items-center gap-1">
            <dt
              className={cn(
                "font-mono uppercase tracking-[0.14em]",
                presentation ? "text-[11px]" : "cmp-mono",
              )}
              style={{ color: discColor(dim) }}
            >
              {dimensionMeta[dim].displayCode}
            </dt>
            <dd
              className={cn(
                "font-mono tabular-nums text-ink",
                presentation ? "text-[11px]" : "cmp-metric",
              )}
            >
              {member.scores[DIMENSION_KEY[dim]]}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3">
        <span
          className={cn(
            "font-medium text-slate",
            presentation ? "text-xs" : "cmp-label",
          )}
        >
          Reaching {reach.label} ({dimensionMeta[reach.primary].label}):
        </span>
        <ul className="flex flex-col gap-3">
          {insightMap[reach.primary].communication.do.slice(0, 2).map((item) => (
            <li
              key={item}
              className={cn(
                "flex items-start gap-3 leading-snug text-ink",
                presentation ? "text-base" : "cmp-body cmp-measure",
              )}
            >
              <span
                aria-hidden
                className="mt-[0.55em] size-2 shrink-0 rounded-full"
                style={{ background: discColor(reach.primary) }}
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
