"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatedNumber } from "@/components/wellbeing/analytics/AnimatedNumber";
import type { CampaignTally } from "@/lib/wellbeing/campaign-workspace";

/**
 * Participation, live.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE REQUIREMENT.
 *
 * A facilitator stands at the front of a room with this on screen. Somebody
 * scans the code; Joined goes up. They start answering; In progress goes up.
 * They finish; Completed goes up. No refresh, no click, no "last updated 4
 * minutes ago".
 *
 * WHAT ARRIVES FROM THE SERVER.
 *
 * Five integers, and only ever five integers — see the route's own note. This
 * component could not render a participant's name if it wanted to, because
 * nothing in its props or its stream has ever contained one.
 *
 * MOTION.
 *
 * A counter that changes gets one short flash of its own background and counts
 * up to the new figure. That is the entire animation budget: a number that
 * pulses forever is a number nobody reads twice, and this panel lives on
 * screen for the length of a session. The counting itself is
 * `AnimatedNumber`, shared with the executive tiles so there is one
 * implementation and not two.
 *
 * DEGRADATION.
 *
 * The server rendered real figures into `initial`. If the stream never opens —
 * a proxy that buffers, a network that blocks event streams — the panel keeps
 * showing them and says plainly that it is not updating by itself, rather than
 * showing stale numbers as though they were live.
 * ─────────────────────────────────────────────────────────────────────
 */
export function LiveParticipation({
  teamId,
  initial,
  capacity,
}: {
  teamId: string;
  initial: CampaignTally;
  capacity: number | null;
}) {
  const [tally, setTally] = useState<CampaignTally>(initial);
  const [live, setLive] = useState(false);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const previous = useRef<CampaignTally>(initial);

  useEffect(() => {
    // `EventSource` reconnects on its own when the server ends a session, so
    // there is no retry loop here — the browser's is better than one written
    // by hand and it backs off.
    const source = new EventSource(
      `/api/wellbeing/campaigns/${teamId}/participation`,
    );

    source.addEventListener("open", () => setLive(true));
    source.addEventListener("tally", (event) => {
      setLive(true);
      let next: CampaignTally;
      try {
        next = JSON.parse((event as MessageEvent).data) as CampaignTally;
      } catch {
        return;
      }
      const moved = new Set<string>();
      for (const key of ["joined", "inProgress", "completed"] as const) {
        if (next[key] !== previous.current[key]) moved.add(key);
      }
      previous.current = next;
      setTally(next);
      if (moved.size > 0) {
        setChanged(moved);
        window.setTimeout(() => setChanged(new Set()), 1400);
      }
    });
    source.addEventListener("error", () => setLive(false));

    return () => source.close();
  }, [teamId]);

  const stats: { key: string; label: string; value: string; hint?: string }[] = [
    { key: "joined", label: "Joined", value: String(tally.joined) },
    { key: "inProgress", label: "In progress", value: String(tally.inProgress) },
    { key: "completed", label: "Completed", value: String(tally.completed) },
    {
      key: "rate",
      label: "Completion rate",
      value: tally.completionRate === null ? "—" : `${tally.completionRate}%`,
      hint: tally.completionRate === null ? "Nobody has joined yet" : undefined,
    },
    {
      key: "places",
      label: capacity === null ? "Capacity" : "Places remaining",
      value:
        tally.placesRemaining === null ? "Unrestricted" : String(tally.placesRemaining),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className={`-mx-2 flex flex-col gap-1 rounded-lg px-2 py-1 transition-colors duration-700 ${
              changed.has(stat.key) ? "bg-pulse-soft/70" : "bg-transparent"
            }`}
          >
            <dt className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
              {stat.label}
            </dt>
            <dd className="font-display text-[clamp(1.6rem,3.8vw,2.15rem)] leading-none font-semibold text-ink tabular-nums">
              <AnimatedNumber value={stat.value} />
            </dd>
            {stat.hint && <p className="text-xs text-slate">{stat.hint}</p>}
          </div>
        ))}
      </dl>

      <p className="flex items-center gap-2 text-xs text-slate">
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${live ? "bg-pulse" : "bg-faint"}`}
        />
        {live
          ? "Updating automatically as people join and finish."
          : "Not updating automatically right now — reload to see the latest figures."}
      </p>
    </div>
  );
}
