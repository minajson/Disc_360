"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils/cn";
import { qrFilename } from "@/lib/teams/session";

interface InviteParticipantsPanelProps {
  teamName: string;
  teamCode: string;
  joinUrl: string;
  /** True when the configured base URL is unreachable from other devices. */
  isLocal: boolean;
  compact?: boolean;
  /** Enables "Open full-screen QR" (projection view). */
  teamId?: string;
  /** The session's selected assessment, shown beside the invite. */
  assessmentLabel?: string;
}

export function InviteParticipantsPanel({
  teamName,
  teamCode,
  joinUrl,
  isLocal,
  compact = false,
  teamId,
  assessmentLabel,
}: InviteParticipantsPanelProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const qrWrapRef = useRef<HTMLDivElement>(null);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 2800);
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      flash(`${label} copied.`);
    } catch {
      flash(value);
    }
  };

  const downloadQr = () => {
    const svg = qrWrapRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const image = new window.Image();
    image.onload = () => {
      // 1600² presentation-ready PNG: 1408px QR centred in a 96px white
      // quiet zone, exported as a real image/png Blob so every viewer
      // (Preview, PowerPoint, Keynote, phone galleries) opens it directly.
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
        link.download = qrFilename(teamName);
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        flash("QR code downloaded.");
      }, "image/png");
    };
    image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`;
  };

  const share = async () => {
    const text = `Join "${teamName}" on DISC360 and take the assessment: ${joinUrl} (team code ${teamCode})`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${teamName} on DISC360`, text, url: joinUrl });
        return;
      } catch {
        // cancelled — fall through to copy
      }
    }
    await copy(text, "Invitation");
  };

  const chip =
    "inline-flex min-h-9 items-center rounded-full border border-hairline bg-paper px-3.5 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical";

  return (
    <section
      aria-label="Invite participants"
      className={cn("paper-card flex flex-col gap-5 p-6", compact && "p-5")}
    >
      <div className="flex flex-wrap items-start gap-6">
        <div ref={qrWrapRef} className="rounded-2xl border border-hairline bg-paper p-3">
          <QRCodeSVG
            value={joinUrl}
            size={compact ? 116 : 148}
            fgColor="#17201D"
            bgColor="#FFFFFF"
            marginSize={1}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-teal">
              Invite participants
            </span>
            <span className="font-display text-lg font-semibold text-ink">{teamName}</span>
            {assessmentLabel ? (
              <span className="text-xs font-medium text-botanical">{assessmentLabel}</span>
            ) : null}
            <span className="font-mono text-xs text-slate">
              Join code <span className="font-semibold text-ink">{teamCode}</span>
            </span>
            <span className="truncate font-mono text-[11px] text-faint">{joinUrl}</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => copy(joinUrl, "Join link")} className={chip}>
              Copy join link
            </button>
            <button type="button" onClick={downloadQr} className={chip}>
              Download QR code
            </button>
            {teamId ? (
              <Link href={`/app/teams/${teamId}/qr`} target="_blank" className={chip}>
                Open full-screen QR
              </Link>
            ) : null}
            <button type="button" onClick={() => copy(teamCode, "Team code")} className={chip}>
              Copy team code
            </button>
            <Link href={joinUrl} target="_blank" className={chip}>
              Open participant join page
            </Link>
            <button type="button" onClick={share} className={chip}>
              Share invitation
            </button>
          </div>

          {notice ? (
            <p role="status" className="text-xs text-botanical">
              {notice}
            </p>
          ) : null}
        </div>
      </div>

      {isLocal ? (
        <p
          role="alert"
          className="rounded-xl bg-disc-i-soft px-4 py-3 text-xs leading-relaxed text-disc-i"
        >
          <strong>Local development only.</strong> This QR code cannot be opened
          from another device until a public development or production URL is
          configured (set NEXT_PUBLIC_SITE_URL).
        </p>
      ) : null}
    </section>
  );
}
