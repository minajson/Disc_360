import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/guards";
import { startAssessment } from "@/lib/actions/assessment";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Button } from "@/components/ui/Button";
import { RetakePanel } from "@/components/app/RetakePanel";

export const metadata: Metadata = { title: "Assessments" };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default async function AssessmentsPage() {
  const { supabase, user } = await requireOnboarded();

  const { data: sessions } = await supabase
    .from("assessment_sessions")
    .select("id, status, current_index, started_at, completed_at, assessment_results (id, archetype_code)")
    .eq("profile_id", user.id)
    .order("started_at", { ascending: false });

  const open = (sessions ?? []).filter((s) => s.status === "in_progress");
  const completed = (sessions ?? []).filter((s) => s.status === "completed");
  // Most recent completion, used to confirm a retake rather than start one
  // silently. Completed sessions arrive newest-first from the query above.
  const lastCompletedAt = completed.find((s) => s.completed_at)?.completed_at ?? null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 py-12 sm:px-8">
      <div className="flex flex-col gap-2">
        <Eyebrow>Assessments</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">Your assessments</h1>
        <p className="max-w-xl text-sm leading-relaxed text-slate">
          24 scenarios, about seven minutes. Answers autosave — you can leave
          and resume anytime.
        </p>
      </div>

      {open.length > 0 ? (
        <section className="paper-card flex flex-col gap-4 p-7" aria-label="In progress">
          {open.map((session) => (
            <div key={session.id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-ink">
                  In progress — scenario {Math.min(session.current_index + 1, 24)} of 24
                </span>
                <span className="text-xs text-faint">
                  Started {formatDate(session.started_at)}
                </span>
              </div>
              <Link
                href={`/app/assessments/${session.id}`}
                className="rounded-full bg-botanical px-6 py-2.5 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
              >
                Continue
              </Link>
            </div>
          ))}
        </section>
      ) : lastCompletedAt ? (
        /* A completed result already exists — starting again is a deliberate
           retake, confirmed and reasoned, never a one-click accident. */
        <RetakePanel lastCompletedAt={lastCompletedAt} />
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <form action={startAssessment}>
            <Button type="submit" size="lg">
              Start a new assessment
            </Button>
          </form>
          <Link
            href="/present/disc"
            className="text-sm font-medium text-botanical underline-offset-2 hover:underline"
          >
            or start with an introduction →
          </Link>
        </div>
      )}

      {completed.length > 0 ? (
        <section className="flex flex-col gap-4" aria-label="Completed">
          <h2 className="font-display text-h3 font-semibold">Completed</h2>
          <div className="paper-card divide-y divide-hairline p-0">
            {completed.map((session) => {
              const result = Array.isArray(session.assessment_results)
                ? session.assessment_results[0]
                : session.assessment_results;
              return (
                <div key={session.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <span className="text-sm text-slate">
                    Completed {session.completed_at ? formatDate(session.completed_at) : "—"}
                  </span>
                  {result ? (
                    <Link
                      href={`/app/results/${result.id}`}
                      className="text-sm font-medium text-botanical hover:underline"
                    >
                      View report →
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
          <Link
            href="/app/history"
            className="self-start text-sm text-slate underline-offset-2 hover:text-ink hover:underline"
          >
            See all of your results over time →
          </Link>
        </section>
      ) : null}
    </div>
  );
}
