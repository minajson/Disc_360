import type { Metadata } from "next";
import { getMyHistory } from "@/lib/history/individual";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { HistoryTimeline } from "@/components/app/HistoryTimeline";

export const metadata: Metadata = { title: "My history" };

/**
 * A participant's own profile over time.
 *
 * getMyHistory reads through the caller's own client and takes no profile id,
 * so there is no shape of request that returns somebody else's history.
 */
export default async function HistoryPage() {
  const { records, discCount, focusCount } = await getMyHistory();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-12 sm:px-8">
      <header className="flex flex-col gap-2">
        <Eyebrow>My history</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">Your profile over time</h1>
        <p className="text-sm text-slate">
          {discCount} completed DISC assessment{discCount === 1 ? "" : "s"}
          {focusCount > 0
            ? ` · ${focusCount} Focus assessment${focusCount === 1 ? "" : "s"}`
            : ""}
        </p>
      </header>

      <HistoryTimeline records={records} />
    </div>
  );
}
