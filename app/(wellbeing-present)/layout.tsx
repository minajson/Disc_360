import type { Metadata } from "next";
import { WELLBEING_PRODUCT_NAME } from "@/data/wellbeing-content";

export const metadata: Metadata = {
  title: { default: WELLBEING_PRODUCT_NAME, template: `%s · ${WELLBEING_PRODUCT_NAME}` },
  robots: { index: false, follow: false },
};

/**
 * The Wellbeing Pulse PRESENTATION shell — deliberately no chrome.
 *
 * A projected QR is looked at from across a room, so navigation, an escape
 * hatch back to DISC360 and a privacy footer are all noise competing with the
 * one thing that has to be scannable. The participant shell's header and
 * footer belong on surfaces someone reads; this is a surface someone points a
 * camera at.
 *
 * Authorization is unchanged and unaffected: each page inside this group still
 * calls its own guard on the server. Removing chrome removes decoration, never
 * a check.
 */
export default function WellbeingPresentLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-white">{children}</div>;
}
