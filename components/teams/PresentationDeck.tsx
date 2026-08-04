"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
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

/**
 * Compare and AI Insights are the two heavy tabs — a full comparison
 * workspace and eight generated insight cards. Code splitting them keeps the
 * deck's first paint to the slides a facilitator opens on.
 */
const CompareTab = dynamic(
  () => import("@/components/teams/tabs/CompareTab").then((m) => m.CompareTab),
  { loading: () => <TabSkeleton label="Loading comparison…" /> },
);

const InsightsTab = dynamic(
  () => import("@/components/teams/tabs/InsightsTab").then((m) => m.InsightsTab),
  { loading: () => <TabSkeleton label="Loading insights…" /> },
);

function TabSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-64 items-center justify-center rounded-2xl border border-hairline bg-mineral"
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </span>
    </div>
  );
}

const TABS = [
  { id: "overview", label: "Overview", Component: OverviewTab },
  { id: "distribution", label: "Distribution", Component: DistributionTab },
  { id: "communication", label: "Communication", Component: CommunicationTab },
  { id: "leadership", label: "Leadership", Component: LeadershipTab },
  { id: "conflict", label: "Conflict", Component: ConflictTab },
  { id: "pressure", label: "Pressure", Component: PressureTab },
  { id: "pairings", label: "Pairings", Component: PairingsTab },
  { id: "compare", label: "Compare", Component: CompareTab },
  { id: "insights", label: "AI Insights", Component: InsightsTab },
  { id: "recommendations", label: "Recommendations", Component: RecommendationsTab },
] as const;

export interface FacilitatorInfo {
  name: string;
  title: string | null;
  organization: string | null;
  photoUrl: string | null;
  logoUrl: string | null;
}

interface PresentationDeckProps {
  data: TeamIntelligence;
  resultsUrl: string;
  joinUrl: string;
  joinDisplayUrl: string;
  teamCode: string;
  isLocalBase: boolean;
  facilitator: FacilitatorInfo | null;
  /** Server-resolved ISO timestamp, stamped on generated insights. */
  generatedAt: string;
}

export function PresentationDeck({
  data,
  resultsUrl,
  joinUrl,
  joinDisplayUrl,
  teamCode,
  isLocalBase,
  facilitator,
  generatedAt,
}: PresentationDeckProps) {
  const reduced = useReducedMotion();
  const [tabIndex, setTabIndex] = useState(0);
  const [showNames, setShowNames] = useState(data.named);
  const [department, setDepartment] = useState<string | null>(null);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [overlay, setOverlay] = useState<null | "join" | "report">(null);
  const [showFacilitator, setShowFacilitator] = useState(Boolean(facilitator));

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
      generatedAt,
    }),
    [data, profiles, showNames, generatedAt],
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
      "pres-label rounded-full border px-4 py-2 transition-colors",
      active
        ? "border-botanical text-botanical"
        : "border-hairline text-slate hover:border-botanical hover:text-botanical",
    );

  const active = TABS[tabIndex]!;

  return (
    /* presentation-scale makes this element the container every type token
       below measures against, so the whole deck grows with the screen. */
    <div className="presentation-scale flex min-h-screen flex-col bg-canvas">
      {/* presenter chrome */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4 print:hidden">
        <div className="flex flex-col">
          <span className="pres-h3 font-display font-semibold text-ink">{data.teamName}</span>
          <span className="pres-mono font-mono uppercase tracking-[0.18em] text-faint">
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
          {facilitator ? (
            <button
              type="button"
              onClick={() => setShowFacilitator((v) => !v)}
              aria-pressed={showFacilitator}
              className={controlChip(showFacilitator)}
            >
              Facilitator {showFacilitator ? "on" : "off"}
            </button>
          ) : null}
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

      {/* facilitator credit */}
      {facilitator && showFacilitator ? (
        <div className="flex items-center gap-3 border-t border-hairline px-6 py-2.5 print:border-none">
          {facilitator.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- storage-hosted, unoptimized by design
            <img
              src={facilitator.photoUrl}
              alt=""
              className="size-9 rounded-full object-cover"
            />
          ) : null}
          <span className="pres-label text-slate">
            Facilitated by <span className="font-medium text-ink">{facilitator.name}</span>
            {facilitator.title ? ` · ${facilitator.title}` : ""}
            {facilitator.organization ? ` · ${facilitator.organization}` : ""}
          </span>
          {facilitator.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- storage-hosted, unoptimized by design
            <img src={facilitator.logoUrl} alt="" className="ml-auto max-h-7 w-auto object-contain" />
          ) : null}
        </div>
      ) : null}

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
              "pres-nav whitespace-nowrap border-b-2 px-5 py-3.5 font-medium transition-colors",
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
      <main className="flex flex-1 flex-col overflow-y-auto px-6 py-6 lg:px-10 lg:py-8 print:hidden">
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
              /* Grows with the room: ~92% of the stage, ceilinged so an
                 ultrawide gains columns rather than stretched rows. */
              /* my-auto centres the slide when the screen is taller than the
                 content — a 4K projector should not show one band of cards at
                 the top and 1500px of empty ivory below. Auto margins collapse
                 safely when the content overflows, so tall slides still scroll
                 from the top rather than being clipped. */
              className="mx-auto my-auto w-full max-w-[min(94cqi,2800px)]"
            >
              <active.Component {...context} />
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Print: the narrative sections stacked. Compare and AI Insights are
          excluded deliberately — they are interactive workspaces with their
          own Export PDF, and mounting them here would load both code-split
          chunks on every deck open just to fill a hidden container. */}
      <div className="hidden print:block">
        {TABS.filter((tab) => tab.id !== "compare" && tab.id !== "insights").map((tab) => (
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
            {/* The join QR has always warned on a local base; this one did
                not, so a presenter could project an unscannable report QR
                with no indication it was unusable. */}
            {isLocalBase ? (
              <p
                role="alert"
                className="max-w-xs rounded-xl bg-disc-i-soft px-4 py-2.5 text-center text-xs leading-relaxed text-disc-i"
              >
                Local development only — this QR cannot be opened from another
                device until a public URL is configured.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* footer navigation */}
      <footer className="flex items-center justify-between px-6 pb-5 print:hidden">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous section"
          className="pres-h3 flex size-14 items-center justify-center rounded-full border border-hairline-strong bg-paper text-ink transition-colors hover:border-botanical"
        >
          ←
        </button>
        <span className="pres-mono font-mono text-faint">
          {tabIndex + 1} / {TABS.length} · arrow keys navigate
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next section"
          className="pres-h3 flex size-14 items-center justify-center rounded-full border border-hairline-strong bg-paper text-ink transition-colors hover:border-botanical"
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
