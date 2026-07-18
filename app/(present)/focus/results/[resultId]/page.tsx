import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { FocusResultView, type FocusResultData } from "@/components/focus/FocusResultView";
import type {
  EnergyKey,
  LoopKey,
  NotifKey,
  ResetKey,
  FocusPatternCode,
} from "@/lib/scoring/focus";

export const metadata: Metadata = { title: "Your Focus profile" };

interface PageProps {
  params: Promise<{ resultId: string }>;
}

export default async function FocusResultPage({ params }: PageProps) {
  const { resultId } = await params;
  const { supabase, user } = await requireOnboarded();

  const { data: result } = await supabase
    .from("focus_results")
    .select(
      "id, profile_id, automaticity, distraction, mental_load, recovery, pattern_code, primary_loop, notification_pattern, energy_pattern, preferred_reset",
    )
    .eq("id", resultId)
    .maybeSingle();

  // Own-row only (RLS also enforces this).
  if (!result || result.profile_id !== user.id) notFound();

  const data: FocusResultData = {
    scores: {
      automaticity: result.automaticity,
      distraction: result.distraction,
      mentalLoad: result.mental_load,
      recovery: result.recovery,
    },
    patternCode: result.pattern_code as FocusPatternCode,
    primaryLoop: result.primary_loop as LoopKey,
    notificationPattern: result.notification_pattern as NotifKey,
    energyPattern: result.energy_pattern as EnergyKey,
    preferredReset: result.preferred_reset as ResetKey,
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <FocusResultView data={data} />
      <div className="flex flex-wrap gap-3 border-t border-hairline pt-6">
        <Link
          href="/app"
          className="inline-flex min-h-11 items-center rounded-full bg-botanical px-6 text-sm font-medium text-mineral transition-colors hover:bg-botanical-deep"
        >
          Back to dashboard
        </Link>
        <Link
          href={`/focus/results/${result.id}/present`}
          className="inline-flex min-h-11 items-center rounded-full border border-hairline-strong px-6 text-sm font-medium text-ink transition-colors hover:border-botanical hover:text-botanical"
        >
          Present this result
        </Link>
        <Link
          href="/combined"
          className="inline-flex min-h-11 items-center rounded-full border border-hairline px-6 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical"
        >
          Add your DISC profile →
        </Link>
      </div>
    </div>
  );
}
