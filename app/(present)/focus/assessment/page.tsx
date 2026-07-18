import { startFocusAssessment } from "@/lib/actions/focus";

/**
 * Launcher: starts (or resumes) the Focus Pulse and redirects to the runner.
 * The action self-guards — a signed-out visitor is sent to sign-in, not a
 * dead end. Kept as a route so /focus/assessment is a real, linkable URL.
 */
export default async function FocusAssessmentLauncher() {
  await startFocusAssessment();
  return null;
}
