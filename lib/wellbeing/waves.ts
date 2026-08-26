/**
 * Wellbeing waves, and the reporting periods they can be grouped into.
 *
 * ─────────────────────────────────────────────────────────────────────
 * A WAVE IS AN IDENTITY. A PERIOD IS A VIEW.
 *
 * These were the same thing until 00034, and that was the defect: a wave was
 * whatever calendar quarter its responses happened to fall in. Two genuine
 * pulses of the same workforce — a baseline in August and a post-intervention
 * pulse in September — became one number, invisibly, because a merged wave
 * looks exactly like a wave.
 *
 * So they are now separate concerns and this module keeps them separate:
 *
 *  · A WAVE is a row. It has a number, a label, an opening and a closing, and
 *    a result is attached to it permanently at completion.
 *  · A PERIOD is a grouping the reader asks for. Monthly, quarterly and annual
 *    views still exist and are still useful — but they are a transformation
 *    applied on top of waves, they never replace them, and when one folds two
 *    waves together the reader is told so.
 *
 * The default is always individual waves. Anything else has to be chosen.
 * ─────────────────────────────────────────────────────────────────────
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface WellbeingWave {
  id: string;
  campaignId: string;
  campaignName: string;
  /** 1-based within its campaign. Immutable — this is the identity. */
  number: number;
  /** What the facilitator called it. May be empty. */
  label: string;
  openedAt: string;
  closedAt: string | null;
}

/** "Wave 2 — Post-intervention", or "Wave 2" where none was given. */
export function waveTitle(wave: { number: number; label: string }): string {
  const label = wave.label.trim();
  return label ? `Wave ${wave.number} — ${label}` : `Wave ${wave.number}`;
}

/** "August 2026" — derived from the wave's opening, never stored. */
export function wavePeriod(openedAt: string): string {
  const date = new Date(openedAt);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/* ── reporting periods ──────────────────────────────────────────────── */

export type ReportingPeriod = "wave" | "month" | "quarter" | "year";

export const REPORTING_PERIODS: readonly { key: ReportingPeriod; label: string }[] = [
  { key: "wave", label: "Individual waves" },
  { key: "month", label: "Monthly" },
  { key: "quarter", label: "Quarterly" },
  { key: "year", label: "Annual" },
];

/**
 * Individual waves unless something else was explicitly asked for.
 *
 * The default matters more than it looks. A default of "quarterly" would
 * reintroduce the exact silent merge 00034 removed — this time as a
 * presentation choice nobody made.
 */
export function parseReportingPeriod(value: string | undefined): ReportingPeriod {
  return REPORTING_PERIODS.some((entry) => entry.key === value)
    ? (value as ReportingPeriod)
    : "wave";
}

export interface PeriodBucket {
  key: string;
  /** What the axis is labelled. */
  label: string;
  /** ISO of the bucket's start, for ordering only. */
  at: string;
  /** The waves folded into this bucket, oldest first. */
  waveIds: string[];
  /**
   * True when this bucket contains more than one wave.
   *
   * Carried so the surface can SAY so. A quarterly point built from a baseline
   * and a post-intervention pulse is a legitimate figure and a misleading one
   * if the reader thinks it is a single measurement.
   */
  aggregated: boolean;
  /** The titles of the waves folded in, for the note that explains it. */
  waveTitles: string[];
}

function bucketKeyFor(openedAt: string, period: ReportingPeriod): { key: string; label: string; at: string } {
  const date = new Date(openedAt);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  switch (period) {
    case "month":
      return {
        key: `${year}-${String(month + 1).padStart(2, "0")}`,
        label: `${MONTHS[month]!.slice(0, 3)} ${String(year).slice(2)}`,
        at: new Date(Date.UTC(year, month, 1)).toISOString(),
      };
    case "quarter": {
      const quarter = Math.floor(month / 3) + 1;
      return {
        key: `${year}-Q${quarter}`,
        label: `Q${quarter} ${String(year).slice(2)}`,
        at: new Date(Date.UTC(year, (quarter - 1) * 3, 1)).toISOString(),
      };
    }
    case "year":
      return {
        key: String(year),
        label: String(year),
        at: new Date(Date.UTC(year, 0, 1)).toISOString(),
      };
    case "wave":
      // Unreachable — a wave is its own bucket and is built directly below.
      return { key: openedAt, label: openedAt, at: openedAt };
  }
}

/**
 * Groups waves into the reporting period the reader chose.
 *
 * With `wave` — the default — every wave is its own bucket and nothing is
 * folded, whatever the calendar says. Two waves in one quarter stay two.
 */
export function bucketWaves(
  waves: readonly WellbeingWave[],
  period: ReportingPeriod,
): PeriodBucket[] {
  const ordered = [...waves].sort((a, b) => a.openedAt.localeCompare(b.openedAt));

  if (period === "wave") {
    return ordered.map((wave) => ({
      key: wave.id,
      label: waveTitle(wave),
      at: wave.openedAt,
      waveIds: [wave.id],
      aggregated: false,
      waveTitles: [waveTitle(wave)],
    }));
  }

  const buckets = new Map<string, PeriodBucket>();
  for (const wave of ordered) {
    const bucket = bucketKeyFor(wave.openedAt, period);
    const existing = buckets.get(bucket.key);
    if (existing) {
      existing.waveIds.push(wave.id);
      existing.waveTitles.push(waveTitle(wave));
      existing.aggregated = true;
      continue;
    }
    buckets.set(bucket.key, {
      key: bucket.key,
      label: bucket.label,
      at: bucket.at,
      waveIds: [wave.id],
      aggregated: false,
      waveTitles: [waveTitle(wave)],
    });
  }

  return [...buckets.values()].sort((a, b) => a.at.localeCompare(b.at));
}

/** How many buckets in this view fold more than one wave together. */
export function aggregatedBucketCount(buckets: readonly PeriodBucket[]): number {
  return buckets.filter((bucket) => bucket.aggregated).length;
}

/**
 * The sentence shown whenever a view has folded waves together.
 *
 * Deliberately concrete — it names the waves — because "some periods contain
 * multiple waves" is exactly the kind of caveat a reader skims past.
 */
export function aggregationNotice(buckets: readonly PeriodBucket[]): string | null {
  const folded = buckets.filter((bucket) => bucket.aggregated);
  if (folded.length === 0) return null;
  const detail = folded
    .map((bucket) => `${bucket.label} combines ${bucket.waveTitles.join(" and ")}`)
    .join("; ");
  return `This view groups waves into reporting periods, so ${folded.length} ${
    folded.length === 1 ? "point combines" : "points each combine"
  } more than one wave: ${detail}. Switch to Individual waves to see them separately.`;
}
