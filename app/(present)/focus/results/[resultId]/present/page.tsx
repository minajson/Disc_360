import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/auth/guards";
import { FocusResultView, type FocusResultData } from "@/components/focus/FocusResultView";
import { ResultPresentationShell } from "@/components/presentations/ResultPresentationShell";
import type {
  EnergyKey,
  FocusPatternCode,
  LoopKey,
  NotifKey,
  ResetKey,
} from "@/lib/scoring/focus";

export const metadata: Metadata = { title: "Present Focus result" };

interface PageProps {
  params: Promise<{ resultId: string }>;
}

export default async function FocusResultPresentPage({ params }: PageProps) {
  const { resultId } = await params;
  const { supabase, user } = await requireOnboarded();

  const { data: result } = await supabase
    .from("focus_results")
    .select("id, profile_id, automaticity, distraction, mental_load, recovery, pattern_code, primary_loop, notification_pattern, energy_pattern, preferred_reset")
    .eq("id", resultId)
    .maybeSingle();
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
    <ResultPresentationShell exitHref={`/focus/results/${resultId}`}>
      <FocusResultView data={data} presentation />
    </ResultPresentationShell>
  );
}
