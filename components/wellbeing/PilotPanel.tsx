"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

/**
 * The management pilot panel.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT IT SHOWS, AND WHAT IT REFUSES TO.
 *
 * Capacity, counts and a QR code. Four integers and a link — no participant
 * name, no identifier, no score. `readPilotStatus` returns nothing else, so
 * there is nothing else in this component's props to leak.
 *
 * The QR is sized for a projected screen rather than a browser window: a
 * facilitator holds this up in a room and thirty people scan it at once, so
 * the on-screen code is generous and the download is a 1600px PNG with a
 * proper quiet zone. Internal ids never appear in the visible interface — the
 * link carries an opaque invite token, and the campaign is named, not keyed.
 * ─────────────────────────────────────────────────────────────────────
 */
export function PilotPanel({
  campaignName,
  joinUrl,
  fullscreenHref,
  capacity,
  joined,
  completed,
  inProgress,
  remaining,
  isFull,
}: {
  campaignName: string;
  joinUrl: string;
  fullscreenHref: string;
  capacity: number | null;
  joined: number;
  completed: number;
  inProgress: number;
  remaining: number | null;
  isFull: boolean;
}) {
  const qrWrapRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<string | null>(null);

  const flash = (message: string) => {
    setNote(message);
    window.setTimeout(() => setNote(null), 2600);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      flash("Participant link copied.");
    } catch {
      flash("Could not copy — select the link and copy it manually.");
    }
  };

  const downloadQr = () => {
    const svg = qrWrapRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const image = new window.Image();
    image.onload = () => {
      // 1600² presentation PNG: the code inset in a white quiet zone, so it
      // still scans when dropped into a slide and projected.
      const SIZE = 1600;
      const QUIET = 96;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, SIZE, SIZE);
      context.imageSmoothingEnabled = false;
      context.drawImage(image, QUIET, QUIET, SIZE - QUIET * 2, SIZE - QUIET * 2);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `Wellbeing-Pulse-${campaignName.replace(/[^a-z0-9]+/gi, "-")}-QR.png`;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        flash("QR code downloaded.");
      }, "image/png");
    };
    image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`;
  };

  const capacityLabel = capacity === null ? `${joined} joined` : `${joined} / ${capacity} joined`;
  const pct = capacity === null ? 0 : Math.min(100, Math.round((joined / capacity) * 100));

  return (
    <section className="pulse-card mt-6 flex flex-col gap-7 p-6 sm:p-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
            {capacity === null ? "Live campaign" : "Management pilot"}
          </p>
          {/* The campaign name and instrument are the page heading directly
              above; repeating them here read as a second, competing title. */}
          <h2 className="mt-2 font-display text-h3 font-semibold">Participants</h2>
        </div>
        {capacity !== null && (
          <span
            className={`rounded-full border px-3.5 py-1.5 font-mono text-[11px] tracking-[0.1em] uppercase ${
              isFull
                ? "border-[rgba(194,74,46,0.32)] bg-[rgba(194,74,46,0.08)] text-[#8d3520]"
                : "border-hairline bg-pulse-mist text-pulse-deep"
            }`}
          >
            {isFull ? "Capacity reached" : `${remaining} place${remaining === 1 ? "" : "s"} left`}
          </span>
        )}
      </div>

      {/* ── capacity ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[11px] tracking-[0.12em] text-faint uppercase">
            Participant capacity
          </span>
          <span className="font-mono text-sm text-pulse-deep tabular-nums">{capacityLabel}</span>
        </div>
        {capacity !== null && (
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-pulse-mist"
            role="img"
            aria-label={`${joined} of ${capacity} participant places taken`}
          >
            <div
              className="h-full rounded-full bg-pulse-deep transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
        {[
          { label: "Joined", value: String(joined) },
          { label: "Completed", value: String(completed) },
          { label: "In progress", value: String(inProgress) },
          {
            label: "Places left",
            value: remaining === null ? "Unrestricted" : String(remaining),
          },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <dt className="text-[11px] tracking-[0.12em] text-faint uppercase">{stat.label}</dt>
            <dd className="font-display text-[clamp(1.5rem,3.6vw,2rem)] leading-none font-semibold text-ink tabular-nums">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* ── QR ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 border-t border-hairline pt-7 sm:flex-row sm:items-center sm:gap-9">
        <div
          ref={qrWrapRef}
          className="mx-auto shrink-0 rounded-2xl border border-hairline bg-white p-4 sm:mx-0"
        >
          <QRCodeSVG value={joinUrl} size={188} level="M" marginSize={0} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-ink">Participant link</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate">
              The link and its QR carry the campaign, and the campaign carries the instrument — a
              participant never chooses a questionnaire.
              {isFull
                ? " The code stays valid: everyone already taking part can still finish, return and read their own history."
                : ""}
            </p>
          </div>

          <code className="rounded-xl bg-pulse-mist px-4 py-3 font-mono text-xs break-all text-pulse-deep">
            {joinUrl}
          </code>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={downloadQr}
              className="rounded-full bg-pulse-deep px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-ink"
            >
              Download QR
            </button>
            <Link
              href={fullscreenHref}
              className="rounded-full border border-hairline px-4 py-2 text-xs font-medium text-slate transition-colors hover:text-pulse-deep"
            >
              Present fullscreen
            </Link>
            <a
              href={joinUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-hairline px-4 py-2 text-xs font-medium text-slate transition-colors hover:text-pulse-deep"
            >
              Open participant link
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full border border-hairline px-4 py-2 text-xs font-medium text-slate transition-colors hover:text-pulse-deep"
            >
              Copy link
            </button>
          </div>

          <p aria-live="polite" className="min-h-[1.1rem] text-xs text-pulse-teal">
            {note}
          </p>
        </div>
      </div>
    </section>
  );
}
