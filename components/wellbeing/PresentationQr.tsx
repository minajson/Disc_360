"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * The projected QR itself, isolated as a client component so the page around
 * it stays a server component and keeps its authorization and data reads on
 * the server. Sized in viewport units because it is scanned from across a room
 * rather than read on a desk.
 */
export function PresentationQr({ value }: { value: string }) {
  return (
    <QRCodeSVG
      value={value}
      size={512}
      level="M"
      marginSize={0}
      className="h-[min(64vmin,560px)] w-[min(64vmin,560px)]"
    />
  );
}
