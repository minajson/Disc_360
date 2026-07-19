"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

/**
 * The conference-room QR. White canvas, maximum contrast, QR sized to the
 * viewport (min(72vmin)) with a proper quiet zone. Print/Save-as-PDF uses
 * the same composition on one page.
 */
export function FullscreenQr({
  teamName,
  teamCode,
  joinUrl,
  displayUrl,
}: {
  teamName: string;
  teamCode: string;
  joinUrl: string;
  displayUrl: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-white px-6 py-10 text-center print:min-h-0 print:gap-5">
      <span className="font-display text-2xl font-semibold tracking-tight text-ink">
        DISC<span className="text-botanical">360</span>
      </span>

      <h1 className="font-display text-h2 font-semibold text-ink">Join {teamName}</h1>

      <div className="rounded-3xl border border-hairline bg-white p-[3.5vmin] shadow-[0_24px_64px_-40px_rgba(23,32,29,0.4)] print:border-0 print:shadow-none">
        <QRCodeSVG
          value={joinUrl}
          size={1024}
          fgColor="#17201D"
          bgColor="#FFFFFF"
          marginSize={2}
          className="size-[min(72vmin,560px)] print:size-[130mm]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm text-slate">or visit:</p>
        <p className="break-all font-mono text-lg font-medium text-ink">{displayUrl}</p>
      </div>

      <p className="font-mono text-base text-slate">
        Team code: <span className="font-semibold text-ink">{teamCode}</span>
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 items-center rounded-full bg-botanical px-6 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
        >
          Print / Save as PDF
        </button>
        <Link
          href="."
          onClick={(event) => {
            event.preventDefault();
            window.close();
            window.history.back();
          }}
          className="inline-flex min-h-11 items-center rounded-full border border-hairline bg-paper px-6 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical"
        >
          Close
        </Link>
      </div>
    </div>
  );
}
