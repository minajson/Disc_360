import type { Metadata } from "next";
import {
  WELLBEING_PRODUCT_DESCRIPTION,
  WELLBEING_PRODUCT_NAME,
} from "@/data/wellbeing-content";

export const metadata: Metadata = {
  title: {
    default: WELLBEING_PRODUCT_NAME,
    template: `%s · ${WELLBEING_PRODUCT_NAME}`,
  },
  description: `${WELLBEING_PRODUCT_DESCRIPTION}. A short, private check-in on how you have been feeling recently.`,
  robots: { index: false, follow: false },
};

/**
 * The PUBLIC Wellbeing Pulse shell — the only wellbeing surface that renders
 * before sign-in.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS ROUTE GROUP HAD TO EXIST.
 *
 * The join page used to live under `app/(wellbeing)/`, whose layout calls
 * `requireUser()`. Its own comment said it "renders its own chrome rather than
 * the shell layout, because the shell requires an authenticated user" — but a
 * route group does not opt a page out of its parent layout. The layout ran
 * first, every time, and redirected to `/sign-in`.
 *
 * The effect in production: a person scanning a printed Wellbeing Pulse QR
 * code — who by definition may have no account — was bounced to a DISC360
 * sign-in page carrying no `next`, so the campaign they were invited to was
 * lost before it was ever named. The invitation screen was written, reviewed
 * and deployed, and could never be seen by the only people it was for.
 *
 * A guard cannot be removed from `(wellbeing)`: every other surface there
 * genuinely requires a participant. So the public entry point moves out to a
 * sibling group with no guard, and the two are separated by the file system
 * rather than by a comment.
 *
 * Nothing here is a privacy relaxation. The page resolves its token through
 * `resolve_join_token`, a SECURITY DEFINER RPC that validates inside the
 * database and returns participant-safe context only — no member, no result,
 * no score. Everything past this screen is still authenticated.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function WellbeingPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="pulse-canvas min-h-screen">{children}</div>;
}
