"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils/cn";
import {
  CommunicationTab,
  ConflictTab,
  DistributionTab,
  LeadershipTab,
  OverviewTab,
  PairingsTab,
  PressureTab,
  RecommendationsTab,
  type TabContext,
} from "@/components/teams/presentation-tabs";
import type { TeamIntelligence } from "@/lib/insights/team";

const AUTO_ADVANCE_MS = 25_000;

const TABS = [
  { id: "overview", label: "Overview", Component: OverviewTab },
  { id: "distribution", label: "Distribution", Component: DistributionTab },
  { id: "communication", label: "Communication", Component: CommunicationTab },
  { id: "leadership", label: "Leadership", Component: LeadershipTab },
  { id: "conflict", label: "Conflict", Component: ConflictTab },
  { id: "pressure", label: "Pressure", Component: PressureTab },
  { id: "pairings", label: "Pairings", Component: PairingsTab },
  { id: "recommendations", label: "Recommendations", Component: RecommendationsTab },
] as const;

interface PresentationDeckProps {
  data: TeamIntelligence;
  resultsUrl: string;
  joinUrl: string;
  joinDisplayUrl: string;
  teamCode: string;
  isLocalBase: boolean;
}

export function PresentationDeck({
  data,
  resultsUrl,
  joinUrl,
  joinDisplayUrl,
  teamCode,
  isLocalBase,
}: PresentationDeckProps) {
  const reduced = useReducedMotion();
  const [tabIndex, setTabIndex] = useState(0);
  const [showNames, setShowNames] = useState(data.named);
  const [department, setDepartment] = useState<string | null>(null);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [overlay, setOverlay] = useState<null | "join" | "report">(null);

  const profiles = useMemo(
    () =>
      data.profiles
        .map((profile) => ({
          ...profile,
          label: showNames ? profile.label : profile.anonLabel,
        }))
        .filter((profile) => department === null || profile.department === department),
    [data.profiles, showNames, department],
  );

  const context: TabContext = useMemo(
    () => ({
      data: {
        ...data,
        profiles: data.profiles.map((profile) => ({
          ...profile,
          label: showNames ? profile.label : profile.anonLabel,
        })),
      },
      profiles,
    }),
    [data, profiles, showNames],
  );

  const go = useCallback(
    (delta: number) =>
      setTabIndex((current) => (current + delta + TABS.length) % TABS.length),
    [],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLSelectElement) return;
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  useEffect(() => {
    if (!autoAdvance) return;
    const timer = setInterval(() => go(1), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [autoAdvance, go]);

  const controlChip = (active = false) =>
    cn(
      "rounded-full border px-4 py-2 text-sm transition-colors",
      active
        ? "border-botanical text-botanical"
        : "border-hairline text-slate hover:border-botanical hover:text-botanical",
    );

  const active = TABS[tabIndex]!;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* presenter chrome */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4 print:hidden">
        <div className="flex flex-col">
          <span className="font-display text-lg font-semibold text-ink">{data.teamName}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
            DISC360 · {data.completedCount} of {data.memberCount} completed
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {data.departments.length > 1 ? (
            <select
              aria-label="Filter by department"
              value={department ?? ""}
              onChange={(event) => setDepartment(event.target.value || null)}
              className="rounded-full border border-hairline bg-paper px-4 py-2 text-sm text-slate focus:border-botanical focus:outline-none"
            >
              <option value="">All departments</option>
              {data.departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          ) : null}
          {data.named ? (
            <button type="button" onClick={() => setShowNames((v) => !v)} aria-pressed={showNames} className={controlChip(showNames)}>
              {showNames ? "Names on" : "Anonymized"}
            </button>
          ) : (
            <span className="rounded-full border border-hairline px-4 py-2 text-sm text-faint">
              Anonymized
            </span>
          )}
          <button type="button" onClick={() => setAutoAdvance((v) => !v)} aria-pressed={autoAdvance} className={controlChip(autoAdvance)}>
            Auto {autoAdvance ? "on" : "off"}
          </button>
          <button
            type="button"
            onClick={() => setOverlay(overlay === "join" ? null : "join")}
            aria-pressed={overlay === "join"}
            className={controlChip(overlay === "join")}
          >
            Join QR
          </button>
          <button
            type="button"
            onClick={() => setOverlay(overlay === "report" ? null : "report")}
            aria-pressed={overlay === "report"}
            className={controlChip(overlay === "report")}
          >
            Report QR
          </button>
          <button type="button" onClick={() => window.print()} className={controlChip()}>
            Download
          </button>
          <button
            type="button"
            onClick={() => void document.documentElement.requestFullscreen?.()}
            className={controlChip()}
          >
            Full screen
          </button>
          <Link href={`/app/teams/${data.teamId}/dashboard`} className={controlChip()}>
            Exit
          </Link>
        </div>
      </header>

      {/* tabs */}
      <nav
        role="tablist"
        aria-label="Presentation sections"
        className="flex gap-1 overflow-x-auto border-b border-hairline px-6 print:hidden"
      >
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tabIndex === index}
            onClick={() => setTabIndex(index)}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors lg:text-base",
              tabIndex === index
                ? "border-botanical text-botanical"
                : "border-transparent text-slate hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* active tab (screen) */}
      <main className="flex-1 px-6 py-6 lg:px-10 lg:py-8 print:hidden">
        {data.completedCount === 0 ? (
          <div className="paper-card mx-auto max-w-lg p-10 text-center">
            <p className="text-lg text-slate">
              No completed profiles yet — the presentation comes alive as
              submissions arrive.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              role="tabpanel"
              aria-label={active.label}
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: [0.32, 0.94, 0.6, 1] }}
              className="mx-auto w-full max-w-6xl"
            >
              <active.Component {...context} />
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* print: all sections stacked */}
      <div className="hidden print:block">
        {TABS.map((tab) => (
          <section key={tab.id} className="mb-8 break-inside-avoid">
            <h2 className="mb-3 font-display text-xl font-semibold">{tab.label}</h2>
            <tab.Component {...context} />
          </section>
        ))}
      </div>

      {/* Join QR — participants scan to join THIS team's assessment */}
      {overlay === "join" ? (
        <JoinQrOverlay
          teamId={data.teamId}
          teamName={data.teamName}
          joinUrl={joinUrl}
          joinDisplayUrl={joinDisplayUrl}
          teamCode={teamCode}
          isLocalBase={isLocalBase}
          onClose={() => setOverlay(null)}
        />
      ) : null}

      {/* Report QR — separate purpose: members open the shared summary */}
      {overlay === "report" ? (
        <div
          role="dialog"
          aria-label="Scan to open the team summary report"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 print:hidden"
          onClick={() => setOverlay(null)}
        >
          <div className="paper-card flex flex-col items-center gap-4 p-10">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
              Team summary report
            </span>
            <QRCodeSVG value={resultsUrl} size={240} fgColor="#17201D" bgColor="#FFFFFF" marginSize={1} />
            <p className="max-w-xs text-center text-sm text-slate">
              Members: scan to open the team summary and your personal report
              (sign-in required; visibility follows team settings).
            </p>
          </div>
        </div>
      ) : null}

      {/* footer navigation */}
      <footer className="flex items-center justify-between px-6 pb-5 print:hidden">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous section"
          className="flex size-12 items-center justify-center rounded-full border border-hairline-strong bg-paper text-ink transition-colors hover:border-botanical"
        >
          ←
        </button>
        <span className="font-mono text-xs text-faint">
          {tabIndex + 1} / {TABS.length} · arrow keys navigate
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next section"
          className="flex size-12 items-center justify-center rounded-full border border-hairline-strong bg-paper text-ink transition-colors hover:border-botanical"
        >
          →
        </button>
      </footer>
    </div>
  );
}

interface JoinQrOverlayProps {
  teamId: string;
  teamName: string;
  joinUrl: string;
  joinDisplayUrl: string;
  teamCode: string;
  isLocalBase: boolean;
  onClose: () => void;
}

function JoinQrOverlay({
  teamId,
  teamName,
  joinUrl,
  joinDisplayUrl,
  teamCode,
  isLocalBase,
  onClose,
}: JoinQrOverlayProps) {
  const [counts, setCounts] = useState<{ joined: number; completed: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/app/teams/${teamId}/presentation/stats`);
        if (!response.ok) return;
        const body = (await response.json()) as { joined: number; completed: number };
        if (!cancelled) setCounts(body);
      } catch {
        // transient — next poll retries
      }
    };
    void load();
    const timer = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [teamId]);

  return (
    <div
      role="dialog"
      aria-label={`Scan to join ${teamName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 print:hidden"
      onClick={onClose}
    >
      <div className="paper-card flex flex-col items-center gap-5 p-10 sm:p-12">
        <span className="font-mono text-sm uppercase tracking-[0.28em] text-teal">
          Scan to join {teamName}
        </span>
        <QRCodeSVG value={joinUrl} size={320} fgColor="#17201D" bgColor="#FFFFFF" marginSize={1} />
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-lg text-slate">
            or visit <span className="font-medium text-ink">{joinDisplayUrl}</span>
          </span>
          <span className="font-mono text-base text-slate">
            Team code <span className="font-semibold text-ink">{teamCode}</span>
          </span>
        </div>
        <span aria-live="polite" className="font-display text-2xl font-semibold text-ink">
          {counts ? `${counts.joined} joined · ${counts.completed} completed` : "…"}
        </span>
        {isLocalBase ? (
          <p role="alert" className="max-w-sm rounded-xl bg-disc-i-soft px-4 py-2.5 text-center text-xs leading-relaxed text-disc-i">
            Local development only — this QR cannot be opened from another
            device until a public URL is configured.
          </p>
        ) : null}
      </div>
    </div>
  );
}
