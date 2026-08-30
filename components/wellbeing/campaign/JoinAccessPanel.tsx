"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  admitsParticipants,
  readCapacity,
  type CampaignLifecycle,
} from "@/lib/wellbeing/campaign-lifecycle";

/**
 * How participants get in: the code, the link, and the four things you do
 * with them.
 *
 * ─────────────────────────────────────────────────────────────────────
 * THE QR CODE IS THE PRODUCT SURFACE HERE, SO IT LEADS.
 *
 * A facilitator opens this page in a room with people in it and holds the
 * screen up. Anything above the code is something they have to scroll past
 * while thirty people wait, so the code is first, large, and on white with a
 * real quiet zone — the same reason the download is 1600px.
 *
 * WHAT THE CODE RESOLVES TO.
 *
 * The campaign's own join token, and therefore the campaign's own
 * questionnaire. Never a DISC invitation, never a questionnaire picker, and
 * never a team code. The URL is shown in full underneath so a facilitator can
 * see for themselves which host it points at — a code built against a
 * localhost or preview URL is unscannable in the room, and the panel says so
 * rather than letting somebody discover it mid-session.
 *
 * WHAT IT SHOWS WHEN THE CAMPAIGN IS NOT OPEN.
 *
 * The code, still — and a plain line saying scanning it will not currently let
 * anybody in. Hiding it would strand a facilitator who paused a campaign and
 * wants the poster ready for when they resume.
 * ─────────────────────────────────────────────────────────────────────
 */
export function JoinAccessPanel({
  campaignName,
  joinUrl,
  questionnaireName,
  fullscreenHref,
  lifecycle,
  capacity,
  joined,
  size = "full",
}: {
  campaignName: string;
  joinUrl: string;
  questionnaireName: string | null;
  fullscreenHref: string;
  lifecycle: CampaignLifecycle;
  capacity: number | null;
  joined: number;
  /** `compact` shrinks the code for a settings page; `full` is room-sized. */
  size?: "full" | "compact";
}) {
  const qrWrapRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<string | null>(null);

  const open = admitsParticipants(lifecycle);
  const places = readCapacity(capacity, joined);
  const qrSize = size === "full" ? 236 : 176;

  // A link nobody outside this machine can open is not a participant link. The
  // check is on the URL that is actually encoded, not on an environment guess.
  const unreachable = /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/.test(joinUrl);

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

  return (
    <div className="flex flex-col gap-7 sm:flex-row sm:items-start sm:gap-9">
      <div className="mx-auto flex shrink-0 flex-col items-center gap-3 sm:mx-0">
        <div
          ref={qrWrapRef}
          className={`rounded-2xl border border-hairline bg-white p-4 ${
            open ? "" : "opacity-60"
          }`}
        >
          <QRCodeSVG value={joinUrl} size={qrSize} level="M" marginSize={0} />
        </div>
        <p className="font-display text-base font-semibold text-ink">Scan to join</p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div>
          {questionnaireName && (
            <p className="text-sm text-slate">
              Opens <span className="font-medium text-ink">{questionnaireName}</span> for{" "}
              <span className="font-medium text-ink">{campaignName}</span>.
            </p>
          )}
          {!open && (
            <p className="mt-2 text-sm leading-relaxed text-pulse-watch">
              The campaign is not open, so scanning this will not let anybody in yet. The code
              itself stays valid — it will work again as soon as you open the campaign.
            </p>
          )}
          {open && places.isFull && (
            <p className="mt-2 text-sm leading-relaxed text-pulse-watch">
              Every place has been taken, so no new participant can join. Everyone already taking
              part can still finish, return and read their own history.
            </p>
          )}
        </div>

        <code className="rounded-xl bg-pulse-mist px-4 py-3 font-mono text-xs break-all text-pulse-deep">
          {joinUrl}
        </code>

        {unreachable && (
          <p className="rounded-xl border border-[rgba(138,106,47,0.32)] bg-pulse-watch-soft/60 px-4 py-3 text-xs leading-relaxed text-ink">
            This link points at this machine, so a phone in the room cannot open it. Set{" "}
            <code className="font-mono">SITE_URL</code> to the address participants use before
            printing or projecting the code.
          </p>
        )}

        <div className="flex flex-wrap gap-2.5">
          <Link
            href={fullscreenHref}
            className="pulse-focus rounded-full bg-pulse px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-pulse-deep"
          >
            Present fullscreen
          </Link>
          <button
            type="button"
            onClick={downloadQr}
            className="pulse-focus rounded-full border border-hairline px-4 py-2 text-xs font-medium text-slate transition-colors hover:text-pulse-deep"
          >
            Download QR
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="pulse-focus rounded-full border border-hairline px-4 py-2 text-xs font-medium text-slate transition-colors hover:text-pulse-deep"
          >
            Copy link
          </button>
          <a
            href={joinUrl}
            target="_blank"
            rel="noreferrer"
            className="pulse-focus rounded-full border border-hairline px-4 py-2 text-xs font-medium text-slate transition-colors hover:text-pulse-deep"
          >
            Open participant view
          </a>
        </div>

        <p aria-live="polite" className="min-h-[1.1rem] text-xs text-pulse-teal">
          {note}
        </p>
      </div>
    </div>
  );
}
