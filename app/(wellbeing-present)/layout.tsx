import type { Metadata } from "next";
import { WELLBEING_PRODUCT_NAME } from "@/data/wellbeing-content";

export const metadata: Metadata = {
  title: { default: WELLBEING_PRODUCT_NAME, template: `%s · ${WELLBEING_PRODUCT_NAME}` },
  robots: { index: false, follow: false },
};

/**
 * The Wellbeing Pulse PRESENTATION shell — deliberately no chrome.
 *
 * Two kinds of surface live here: a projected QR someone points a camera at,
 * and a deck a room reads from across it. Navigation, an escape hatch back to
 * DISC360 and a privacy footer are noise on both — and worse than noise on a
 * screen thirty people are watching, where every control is something clicked
 * by accident. Each surface inside carries its own single way out.
 *
 * The ground is left to the page. A QR needs white for contrast under a
 * projector; a deck needs the Wellbeing Pulse ground so it does not read as an
 * unstyled document. A shared background would compromise one for the other.
 *
 * Authorization is unchanged and unaffected: each page inside this group still
 * calls its own guard on the server. Removing chrome removes decoration, never
 * a check.
 */
export default function WellbeingPresentLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh">{children}</div>;
}
