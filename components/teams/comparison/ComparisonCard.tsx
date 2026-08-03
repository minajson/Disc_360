"use client";

import { cn } from "@/lib/utils/cn";
import { DiscRadarChart } from "@/components/charts/DiscRadarChart";
import { dimensionMeta } from "@/data/dimension-meta";
import { insightMap } from "@/data/insight-maps";
import { DIMENSION_KEY, DIMENSIONS, type Dimension } from "@/lib/types";
import type { ComparisonMember } from "@/lib/insights/comparison";

/**
 * One member column in a comparison set — the same anatomy as the two-member
 * comparison on the Pairings tab: name, archetype, DISC kite, and the two
 * things that actually reach this person.
 *
 * The two-member comparison itself is untouched. This is the same reading
 * order scaled to sets, so a facilitator who learned the one-to-one view can
 * read a ten-person batch without learning anything new.
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
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-1">
        <span
          className={cn(
            "font-display font-semibold text-ink",
            presentation ? "text-xl" : "text-lg",
          )}
        >
          {member.label}
          <span className="ml-2 font-mono text-xs text-faint">{member.archetypeName}</span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          <span style={{ color: discColor(member.primary) }}>
            {dimensionMeta[member.primary].label}
          </span>
          {member.department ? <span>· {member.department}</span> : null}
          {member.roleTitle ? <span>· {member.roleTitle}</span> : null}
        </span>
      </div>

      <DiscRadarChart
        scores={member.scores}
        showScores={false}
        className={presentation ? "max-w-[240px]" : "max-w-[200px]"}
      />

      <div className="flex flex-wrap gap-x-3 gap-y-1 rule-t pt-2.5 font-mono text-[11px]">
        {DIMENSIONS.map((dim) => (
          <span key={dim} className="flex items-center gap-1">
            <span style={{ color: discColor(dim) }}>{dimensionMeta[dim].displayCode}</span>
            <span className="text-ink">{member.scores[DIMENSION_KEY[dim]]}</span>
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate">
          Reaching {reach.label} ({dimensionMeta[reach.primary].label}):
        </span>
        <ul className="flex flex-col gap-2">
          {insightMap[reach.primary].communication.do.slice(0, 2).map((item) => (
            <li
              key={item}
              className={cn(
                "flex items-start gap-2.5 leading-snug text-ink",
                presentation ? "text-base" : "text-sm",
              )}
            >
              <span
                aria-hidden
                className="mt-1.5 size-1.5 shrink-0 rounded-full"
                style={{ background: discColor(reach.primary) }}
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
