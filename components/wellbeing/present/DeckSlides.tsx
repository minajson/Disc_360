import type { DeckSlide } from "@/lib/wellbeing/presentation";
import { PresentationQr } from "@/components/wellbeing/PresentationQr";
import { DeckLiveParticipation } from "./DeckLiveParticipation";
import { DimensionRadar } from "@/components/wellbeing/analytics/DimensionRadar";

/**
 * The slide bodies.
 *
 * ─────────────────────────────────────────────────────────────────────
 * PRESENTATION TYPOGRAPHY, NOT DASHBOARD TYPOGRAPHY.
 *
 * These are read from the back of a room on a projector, so figures are sized
 * in viewport units and there is one idea per slide. The temptation on a
 * leadership deck is to fit everything; the result is a slide nobody can read
 * and a room that stops looking at it.
 *
 * The caveats are NOT shrunk to fit. "This is not a diagnosis" and "groups
 * below the minimum are withheld" are the sentences most likely to be
 * forgotten in a room and most consequential when they are, so they stay at
 * readable size on the slides they belong to.
 * ─────────────────────────────────────────────────────────────────────
 */

const FIGURE = "font-display text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.95] font-semibold tabular-nums text-ink";
const HEADING = "font-display text-[clamp(1.6rem,3.6vw,2.9rem)] leading-[1.08] font-semibold tracking-tight text-ink text-balance";
const LEAD = "text-[clamp(0.95rem,1.5vw,1.3rem)] leading-relaxed text-slate max-w-4xl";
const EYEBROW = "font-mono text-[clamp(0.65rem,0.9vw,0.8rem)] tracking-[0.2em] uppercase text-pulse-teal";

export function DeckSlideBody({ slide }: { slide: DeckSlide }) {
  switch (slide.kind) {
    case "title":
      return (
        <div className="flex flex-col gap-6">
          <p className={EYEBROW}>{slide.organisation} · Wellbeing Pulse</p>
          <h2 className="font-display text-[clamp(2.2rem,6vw,4.4rem)] leading-[1.02] font-semibold tracking-tight text-balance text-ink">
            {slide.campaign}
          </h2>
          <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t border-hairline pt-6 font-mono text-[clamp(0.8rem,1.2vw,1.05rem)] text-slate">
            <div className="flex gap-2">
              <dt className="sr-only">Questionnaire</dt>
              <dd className="text-ink">{slide.instrument}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="sr-only">Period</dt>
              <dd>{slide.period}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="sr-only">Status</dt>
              <dd>{slide.status}</dd>
            </div>
          </dl>
        </div>
      );

    case "join":
      /*
       * The room slide.
       *
       * A projected QR is the whole point of presenting a live campaign, and
       * the counts beside it move as people scan — the same server-aggregated
       * stream the facilitator's own panel uses, carrying five integers and no
       * name. It is rendered only for an OPEN campaign, so nobody in a room is
       * invited to scan a code that will refuse them.
       */
      return (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className={EYEBROW}>{slide.instrument}</p>
            <h2 className={HEADING}>Scan to join</h2>
          </div>
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16">
            <PresentationQr url={slide.joinUrl} />
            <div className="min-w-0 flex-1">
              <DeckLiveParticipation teamId={slide.teamId} />
            </div>
          </div>
        </div>
      );

    case "participation":
      return (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className={EYEBROW}>Participation and coverage</p>
            <h2 className={HEADING}>How much of the workforce this describes</h2>
          </div>

          <dl className="grid grid-cols-2 gap-x-10 gap-y-7 lg:grid-cols-4">
            {slide.figures.map((figure) => (
              <div key={figure.label} className="flex flex-col gap-2">
                <dt className="font-mono text-[clamp(0.62rem,0.85vw,0.78rem)] tracking-[0.14em] text-faint uppercase">
                  {figure.label}
                </dt>
                <dd className={FIGURE}>{figure.value}</dd>
                {figure.note && (
                  <p className="text-[clamp(0.75rem,1vw,0.92rem)] text-slate">{figure.note}</p>
                )}
              </div>
            ))}
          </dl>

          <ul className="flex flex-col gap-3 border-t border-hairline pt-6">
            {slide.coverage.map((entry) => (
              <li key={entry.label} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline gap-x-4 text-[clamp(0.85rem,1.2vw,1.05rem)]">
                  <span className="font-medium text-ink">{entry.label}</span>
                  <span className="ml-auto font-mono text-slate tabular-nums">
                    {entry.published} reportable
                    {entry.withheld > 0 && (
                      <span className="text-faint"> · {entry.withheld} withheld</span>
                    )}
                  </span>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-sand">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-pulse"
                    style={{
                      width: `${Math.min(100, (entry.covered / Math.max(1, entry.participants)) * 100)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <p className="text-[clamp(0.8rem,1.1vw,1rem)] leading-relaxed text-slate">
            A group is reported only once at least {slide.minCohort} people in it have completed.
            Smaller groups are withheld, and a second is withheld alongside a lone one so it cannot
            be recovered by subtraction.
          </p>
        </div>
      );

    case "pattern": {
      const max = Math.max(...slide.distribution.map((bucket) => bucket.count), 1);
      return (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className={EYEBROW}>The overall pattern</p>
            <h2 className={HEADING}>
              Median {slide.median}
              {slide.level ? ` · ${slide.level.toLowerCase()}` : ""}
            </h2>
            {slide.levelDetail && <p className={LEAD}>{slide.levelDetail}</p>}
          </div>

          <div className="flex items-end gap-1.5" role="img" aria-label={`Distribution of ${slide.responses} responses`}>
            {slide.distribution.map((bucket) => (
              <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <span className="font-mono text-[clamp(0.6rem,0.85vw,0.78rem)] text-slate tabular-nums">
                  {bucket.count || ""}
                </span>
                <span
                  className="w-full rounded-t bg-pulse"
                  style={{ height: `${Math.max(2, (bucket.count / max) * 180)}px` }}
                />
                <span className="truncate font-mono text-[clamp(0.55rem,0.75vw,0.7rem)] text-faint">
                  {bucket.label}
                </span>
              </div>
            ))}
          </div>

          <dl className="flex flex-wrap gap-x-10 gap-y-4 border-t border-hairline pt-6 font-mono text-[clamp(0.78rem,1.1vw,0.98rem)] text-slate">
            <div className="flex gap-2">
              <dt>Responses</dt>
              <dd className="text-ink">{slide.responses}</dd>
            </div>
            <div className="flex gap-2">
              <dt>Mean</dt>
              <dd className="text-ink">{slide.mean}</dd>
            </div>
            <div className="flex gap-2">
              <dt>Scale</dt>
              <dd className="text-ink">
                {slide.scoreMin}–{slide.scoreMax} {slide.scoreLabel}
              </dd>
            </div>
            {slide.threshold !== null && slide.thresholdShare !== null && (
              <div className="flex gap-2">
                <dt>At or above {slide.threshold}</dt>
                <dd className="text-ink">{slide.thresholdShare}%</dd>
              </div>
            )}
          </dl>
        </div>
      );
    }

    case "dimensions":
      return (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className={EYEBROW}>What the workforce is telling us</p>
            <h2 className={HEADING}>{slide.heading}</h2>
            {slide.highest && slide.lowest && (
              <p className={LEAD}>
                <strong className="font-medium text-ink">{slide.highest}</strong>{" "}
                carries the highest median and{" "}
                <strong className="font-medium text-ink">{slide.lowest}</strong>{" "}
                the lowest — a comparison between this workforce&rsquo;s own answers, not against a
                norm or another organisation.
              </p>
            )}
          </div>

          {slide.form === "radar" ? (
            <DimensionRadar dimensions={slide.dimensions} max={slide.max} />
          ) : (
            <ul className="flex flex-col gap-4">
              {slide.dimensions.map((dimension) => (
                <li key={dimension.key} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline gap-x-4 text-[clamp(0.9rem,1.3vw,1.15rem)]">
                    <span className="font-medium text-ink">{dimension.label}</span>
                    <span className="ml-auto font-mono text-slate tabular-nums">
                      {dimension.median}
                      <span className="text-faint"> of {slide.max}</span>
                    </span>
                  </div>
                  <div className="relative h-3 overflow-hidden rounded-full bg-sand">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-pulse"
                      style={{ width: `${Math.min(100, (dimension.median / slide.max) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      );

    case "trend": {
      const width = 900;
      const height = 300;
      const pad = 56;
      const span = Math.max(1, slide.scoreMax - slide.scoreMin);
      const x = (index: number) =>
        slide.waves.length === 1
          ? width / 2
          : pad + (index / (slide.waves.length - 1)) * (width - pad * 2);
      const y = (value: number) =>
        height - pad - ((value - slide.scoreMin) / span) * (height - pad * 2);

      return (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className={EYEBROW}>Across waves</p>
            <h2 className={HEADING}>{slide.movement ?? "Movement over time"}</h2>
          </div>

          <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img"
            aria-label={slide.waves.map((wave) => `${wave.label}, median ${wave.median}`).join("; ")}>
            <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="rgba(31,78,95,0.16)" />
            <polyline
              points={slide.waves.map((wave, index) => `${x(index)},${y(wave.median)}`).join(" ")}
              fill="none"
              stroke="var(--color-pulse)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {slide.waves.map((wave, index) => (
              <g key={wave.label}>
                <circle cx={x(index)} cy={y(wave.median)} r="9" fill="var(--color-paper)" stroke="var(--color-pulse)" strokeWidth="4" />
                <text x={x(index)} y={y(wave.median) - 22} textAnchor="middle" fontSize="24" className="font-mono" fill="var(--color-pulse-deep)">
                  {wave.median}
                </text>
                <text x={x(index)} y={height - 24} textAnchor="middle" fontSize="17" className="fill-slate">
                  {wave.label}
                </text>
                <text x={x(index)} y={height - 6} textAnchor="middle" fontSize="14" className="fill-faint font-mono">
                  n={wave.responses}
                </text>
              </g>
            ))}
          </svg>

          <div className="flex flex-col gap-2 border-t border-hairline pt-6 text-[clamp(0.78rem,1.05vw,0.95rem)] leading-relaxed text-slate">
            <p>
              Different people answer each wave, so a movement describes the responses received —
              not the same individuals changing.
            </p>
            {!slide.thresholdConsistent && (
              <p className="text-pulse-attention">
                The threshold changed across these waves ({slide.thresholds.join(", ")}), so no
                threshold rate is compared. Historical waves are never rescored.
              </p>
            )}
            {slide.suppressedWaves > 0 && (
              <p className="text-faint">
                {slide.suppressedWaves} wave{slide.suppressedWaves === 1 ? " is" : "s are"} not
                plotted — too few responses to publish.
              </p>
            )}
          </div>
        </div>
      );
    }

    case "cohorts": {
      const span = Math.max(1, slide.scoreMax - slide.scoreMin);
      const at = (value: number) => ((value - slide.scoreMin) / span) * 100;
      return (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className={EYEBROW}>Differences between groups</p>
            <h2 className={HEADING}>{slide.dimensionLabel}</h2>
            <p className={LEAD}>
              Listed alphabetically, never ranked. A difference is a question worth asking — not a
              score for a group or its manager.
            </p>
          </div>

          <ul className="flex flex-col gap-4">
            {slide.cohorts.map((cohort) => (
              <li key={cohort.label} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline gap-x-5 text-[clamp(0.88rem,1.25vw,1.1rem)]">
                  <span className="font-medium text-ink">{cohort.label}</span>
                  <span className="ml-auto font-mono text-slate tabular-nums">
                    {cohort.median}
                    <span className="text-faint"> · n = {cohort.participants}</span>
                  </span>
                </div>
                <div className="relative h-5">
                  <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[rgba(31,78,95,0.16)]" />
                  <div
                    className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${at(cohort.p25)}%`,
                      width: `${Math.max(1, at(cohort.p75) - at(cohort.p25))}%`,
                      background: slide.distress
                        ? "var(--color-pulse-attention-soft)"
                        : "var(--color-pulse-soft)",
                    }}
                  />
                  <div
                    className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${at(cohort.median)}%`,
                      background: slide.distress
                        ? "var(--color-pulse-attention)"
                        : "var(--color-pulse)",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <p className="border-t border-hairline pt-6 text-[clamp(0.78rem,1.05vw,0.95rem)] leading-relaxed text-slate">
            Band: the middle of each group. Bar: its median. Scale {slide.scoreMin}–
            {slide.scoreMax} {slide.scoreLabel}.
            {slide.withheld > 0 &&
              ` ${slide.withheld} group${slide.withheld === 1 ? "" : "s"} had fewer than ${slide.minCohort} participants and ${slide.withheld === 1 ? "is" : "are"} not shown.`}
          </p>
        </div>
      );
    }

    case "movement":
      return (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className={EYEBROW}>Movement by group</p>
            <h2 className={HEADING}>{slide.dimensionLabel} across waves</h2>
          </div>

          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[520px] border-collapse text-[clamp(0.8rem,1.1vw,1rem)]">
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className="pb-3 pr-6 text-left font-mono text-[0.72em] tracking-[0.12em] text-faint uppercase">
                    Group
                  </th>
                  {slide.waves.map((wave) => (
                    <th key={wave} scope="col" className="pb-3 pl-4 text-right font-mono text-[0.72em] tracking-[0.12em] text-faint uppercase">
                      {wave}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slide.rows.map((row) => (
                  <tr key={row.label} className="border-b border-hairline last:border-0">
                    <th scope="row" className="py-3 pr-6 text-left font-medium text-ink">
                      {row.label}
                    </th>
                    {row.medians.map((median, index) => (
                      <td key={index} className="py-3 pl-4 text-right font-mono text-slate tabular-nums">
                        {median === null ? <span className="text-faint">—</span> : median}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="border-t border-hairline pt-6 text-[clamp(0.78rem,1.05vw,0.95rem)] leading-relaxed text-slate">
            A dash is a wave withheld because too few people in that group answered it. Scale{" "}
            {slide.scoreMin}–{slide.scoreMax}.
          </p>
        </div>
      );

    case "signals":
      return (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className={EYEBROW}>Areas to explore</p>
            <h2 className={HEADING}>Where the figures suggest looking</h2>
          </div>

          <ul className="flex flex-col gap-5">
            {slide.signals.slice(0, 4).map((signal) => (
              <li
                key={signal.observation}
                className="flex flex-col gap-2 border-l-2 border-pulse-soft pl-5"
              >
                <p className="font-mono text-[clamp(0.6rem,0.82vw,0.74rem)] tracking-[0.14em] text-faint uppercase">
                  {signal.priority}
                </p>
                <p className="text-[clamp(0.95rem,1.45vw,1.25rem)] leading-snug font-medium text-ink">
                  {signal.observation}
                </p>
                <p className="font-mono text-[clamp(0.7rem,0.95vw,0.85rem)] text-slate">
                  {signal.evidence}
                </p>
                <p className="text-[clamp(0.8rem,1.05vw,0.95rem)] leading-relaxed text-slate">
                  {signal.considerExploring}
                </p>
              </li>
            ))}
          </ul>
        </div>
      );

    case "discussion":
      return (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className={EYEBROW}>Discussion</p>
            <h2 className={HEADING}>Questions for this room</h2>
          </div>

          <ol className="flex flex-col gap-4">
            {slide.points.map((point, index) => (
              <li key={point} className="flex gap-5">
                <span
                  aria-hidden="true"
                  className="font-mono text-[clamp(0.75rem,1vw,0.9rem)] text-pulse-teal tabular-nums"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-[clamp(0.95rem,1.45vw,1.25rem)] leading-snug text-ink">
                  {point}
                </span>
              </li>
            ))}
          </ol>

          <div className="flex flex-col gap-2 border-t border-hairline pt-6 text-[clamp(0.78rem,1.05vw,0.95rem)] leading-relaxed text-slate">
            <p>
              {slide.instrument} is {slide.notClaims.join(", ")}.
            </p>
            <p>
              Nothing in this deck describes an individual. No group smaller than{" "}
              {slide.minCohort} people is reported, and individual answers and scores are private
              to the person who gave them — they are not visible to managers, facilitators or
              platform administrators.
            </p>
          </div>
        </div>
      );
  }
}

/** The short title shown in the progress rail and the slide counter. */
export const SLIDE_TITLE: Record<DeckSlide["kind"], string> = {
  title: "Wellbeing Pulse",
  join: "Scan to join",
  participation: "Participation & coverage",
  pattern: "Overall pattern",
  dimensions: "What the workforce is telling us",
  trend: "Trends",
  cohorts: "Cohort differences",
  movement: "Movement by group",
  signals: "Areas to explore",
  discussion: "Discussion",
};
