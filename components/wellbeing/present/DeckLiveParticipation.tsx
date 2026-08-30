"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatedNumber } from "@/components/wellbeing/analytics/AnimatedNumber";
import type { CampaignTally } from "@/lib/wellbeing/campaign-workspace";

/**
 * Participation, live, at room size.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE SAME STREAM AS THE FACILITATOR'S PANEL, AND THE SAME PAYLOAD.
 *
 * Five integers from a server-side aggregation, authorised by the same guard.
 * There is no name, no email, no profile id and no score in this component's
 * props or in anything it receives — see the route's own note.
 *
 * WHY IT FETCHES ITS OWN OPENING FIGURES.
 *
 * Unlike the facilitator panel, this slide is not always mounted: a deck of
 * nine slides renders one at a time, so there is no server-rendered `initial`
 * to hand it. It opens the stream and shows a resting state until the first
 * frame arrives — which is the truthful thing to show, rather than zeros that
 * would read as "nobody has joined".
 *
 * MOTION. A figure that changes flashes its own background once and counts to
 * its new value. In a room that is the signal; anything more is a distraction
 * from the person presenting.
 * ─────────────────────────────────────────────────────────────────────
 */
export function DeckLiveParticipation({ teamId }: { teamId: string }) {
  const [tally, setTally] = useState<CampaignTally | null>(null);
  const [live, setLive] = useState(false);
  const [moved, setMoved] = useState<Set<string>>(new Set());
  const previous = useRef<CampaignTally | null>(null);

  useEffect(() => {
    const source = new EventSource(`/api/wellbeing/campaigns/${teamId}/participation`);

    source.addEventListener("open", () => setLive(true));
    source.addEventListener("tally", (event) => {
      setLive(true);
      let next: CampaignTally;
      try {
        next = JSON.parse((event as MessageEvent).data) as CampaignTally;
      } catch {
        return;
      }
      const changed = new Set<string>();
      if (previous.current) {
        for (const key of ["joined", "inProgress", "completed"] as const) {
          if (next[key] !== previous.current[key]) changed.add(key);
        }
      }
      previous.current = next;
      setTally(next);
      if (changed.size > 0) {
        setMoved(changed);
        window.setTimeout(() => setMoved(new Set()), 1600);
      }
    });
    source.addEventListener("error", () => setLive(false));

    return () => source.close();
  }, [teamId]);

  const figures = [
    { key: "joined", label: "Joined", value: tally ? String(tally.joined) : "—" },
    { key: "inProgress", label: "In progress", value: tally ? String(tally.inProgress) : "—" },
    { key: "completed", label: "Completed", value: tally ? String(tally.completed) : "—" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-3 gap-x-6 gap-y-4">
        {figures.map((figure) => (
          <div
            key={figure.key}
            className={`-mx-3 rounded-xl px-3 py-2 transition-colors duration-700 ${
              moved.has(figure.key) ? "bg-pulse-soft/70" : "bg-transparent"
            }`}
          >
            <dt className="font-mono text-[clamp(0.6rem,0.9vw,0.78rem)] tracking-[0.14em] text-faint uppercase">
              {figure.label}
            </dt>
            <dd className="mt-1 font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-none font-semibold text-ink tabular-nums">
              <AnimatedNumber value={figure.value} />
            </dd>
          </div>
        ))}
      </dl>

      {tally?.placesRemaining !== null && tally?.placesRemaining !== undefined && (
        <p className="font-mono text-[clamp(0.7rem,1vw,0.9rem)] text-slate">
          {tally.placesRemaining} place{tally.placesRemaining === 1 ? "" : "s"} remaining
        </p>
      )}

      <p className="flex items-center gap-2.5 text-[clamp(0.7rem,1vw,0.9rem)] text-slate">
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${live ? "bg-pulse" : "bg-faint"}`}
        />
        {live ? "Updating as people join" : "Waiting for the live count"}
      </p>
    </div>
  );
}
