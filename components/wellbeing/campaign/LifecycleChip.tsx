import {
  LIFECYCLE_LABEL,
  type CampaignLifecycle,
} from "@/lib/wellbeing/campaign-lifecycle";

/**
 * A campaign's state, at list size.
 *
 * Colour carries meaning here, so it is never the only carrier: the chip
 * always prints the state's own word beside its dot. A facilitator reading
 * this in greyscale, on a projector, or with a colour-vision difference gets
 * the same information.
 */
const TONE: Record<CampaignLifecycle, { dot: string; text: string; background: string }> = {
  open: {
    dot: "var(--color-pulse)",
    text: "var(--color-pulse-deep)",
    background: "var(--color-pulse-soft)",
  },
  paused: {
    dot: "var(--color-pulse-watch)",
    text: "var(--color-pulse-watch)",
    background: "var(--color-pulse-watch-soft)",
  },
  draft: {
    dot: "var(--color-faint)",
    text: "var(--color-slate)",
    background: "var(--color-sand)",
  },
  closed: {
    dot: "var(--color-faint)",
    text: "var(--color-slate)",
    background: "var(--color-pulse-mist)",
  },
  archived: {
    dot: "var(--color-faint)",
    text: "var(--color-faint)",
    background: "transparent",
  },
};

/** The label without the word "Campaign" — the row already says which one. */
const SHORT: Record<CampaignLifecycle, string> = {
  draft: "Draft",
  open: "Open",
  paused: "Paused",
  closed: "Closed",
  archived: "Archived",
};

export function LifecycleChip({ lifecycle }: { lifecycle: CampaignLifecycle }) {
  const tone = TONE[lifecycle];
  return (
    <span
      className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: tone.background, color: tone.text }}
      title={LIFECYCLE_LABEL[lifecycle]}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: tone.dot }}
      />
      {SHORT[lifecycle]}
    </span>
  );
}
