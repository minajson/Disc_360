/**
 * Bare full-viewport shell for standalone presentation experiences.
 *
 * No marketing or app chrome: a deck should own the whole screen on a
 * projector or TV. These routes are intentionally public — a facilitator or an
 * individual can view an introduction without signing in. The assessment CTA
 * self-guards (startAssessment requires an onboarded user and redirects
 * otherwise), so nothing sensitive is exposed here.
 */
export default function PresentLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-canvas">{children}</div>;
}
