import Link from "next/link";
import { DEMO_SOURCE_NOTE, ILLUSTRATIVE_DATA_BANNER } from "@/lib/wellbeing/demo-population";

/**
 * LIVE PILOT / ANALYTICS DEMO.
 *
 * Two things a management audience must never confuse, so the distinction is
 * made structurally rather than by a caption: the demo carries a standing
 * banner that cannot scroll out of the way of a figure, and the switch itself
 * states which of the two is currently on screen.
 *
 * A ten-person pilot legitimately withholds most subdivisions, so the demo
 * exists to show what the workspace does at scale — not to make the pilot look
 * busier than it is. The two are never merged, and the demo's figures are
 * generated in memory rather than read from, or written to, any participant
 * table.
 */
export function SourceSwitch({
  source,
  organizationId,
  instrumentKey,
  tab,
}: {
  source: "live" | "demo";
  organizationId: string;
  instrumentKey: string;
  tab: string;
}) {
  const href = (next: "live" | "demo") =>
    `/wellbeing/analytics?org=${organizationId}&instrument=${instrumentKey}&tab=${tab}&source=${next}`;

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label="Data source"
        className="inline-flex w-fit rounded-full border border-[rgba(31,78,95,0.24)] bg-paper p-1"
      >
        {(
          [
            { key: "live" as const, label: "Live pilot" },
            { key: "demo" as const, label: "Analytics demo" },
          ]
        ).map((option) => (
          <Link
            key={option.key}
            href={href(option.key)}
            aria-current={option.key === source ? "true" : undefined}
            className={`pulse-focus rounded-full px-4 py-1.5 text-xs font-medium tracking-[0.04em] transition-colors ${
              option.key === source
                ? "bg-pulse-deep text-white"
                : "text-slate hover:text-pulse-deep"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {source === "demo" && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-[rgba(169,118,20,0.28)] bg-[rgba(169,118,20,0.07)] px-5 py-4">
          <p className="font-mono text-[11px] tracking-[0.16em] text-[#7a5510] uppercase">
            {ILLUSTRATIVE_DATA_BANNER}
          </p>
          <p className="text-sm leading-relaxed text-slate">{DEMO_SOURCE_NOTE}</p>
        </div>
      )}
    </div>
  );
}
