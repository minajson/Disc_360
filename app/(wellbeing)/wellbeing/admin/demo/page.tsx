import type { Metadata } from "next";
import Link from "next/link";
import { requireManagementDemo } from "@/lib/wellbeing/demo-access";
import {
  INSTRUMENT_KEYS,
  INSTRUMENTS,
  canServeToParticipants,
} from "@/data/wellbeing-instruments";
import { isProductionEnvironment, isWellbeingDemoEnabled } from "@/lib/wellbeing/environment";

export const metadata: Metadata = { title: "Management demo" };

/**
 * The internal management demo home.
 *
 * Four tiles, one per instrument. Everything reachable from here is either
 * registry metadata, a content-free structure preview, or explicitly labelled
 * illustrative numbers — no participant data of any kind.
 */
export default async function ManagementDemoPage() {
  await requireManagementDemo();
  const isProduction = isProductionEnvironment();
  const demoEnabled = isWellbeingDemoEnabled();

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
        Internal · management evaluation
      </p>
      <h1 className="mt-3 font-display text-h2 font-semibold tracking-tight">
        Wellbeing Pulse demo
      </h1>
      <p className="mt-4 max-w-2xl text-lead text-slate">
        Evaluate all four instruments end to end. Nothing here uses participant data: previews are
        content-free structure, and every figure shown is illustrative.
      </p>

      <p className="mt-6 rounded-2xl border border-[rgba(138,106,47,0.32)] bg-pulse-attention-soft/50 px-5 py-4 text-sm leading-relaxed text-ink">
        <strong className="font-medium">Demo / licensing pending.</strong> GHQ-12, GHQ-28 and
        WHO-5 questionnaire wording is not loaded in this build. Their previews show structure
        only — the number of items, the sections and the response pattern — so length, layout and
        progression can be judged without restricted content.
      </p>

      <ul className="mt-9 grid gap-4 sm:grid-cols-2">
        {INSTRUMENT_KEYS.map((key) => {
          const instrument = INSTRUMENTS[key];
          const decision = canServeToParticipants(key, { isProduction, demoEnabled });
          const contentLoaded = key === "disc360_wellbeing_v1";
          return (
            <li key={key}>
              <Link
                href={`/wellbeing/admin/demo/${key}`}
                className="pulse-focus flex h-full flex-col gap-3 rounded-[28px] border border-[rgba(31,78,95,0.18)] bg-paper p-6 transition-colors hover:border-pulse"
              >
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-display text-h3 font-semibold text-ink">
                    {instrument.name}
                  </span>
                  <span className="font-mono text-xs text-faint">
                    {instrument.primaryScoreMin}–{instrument.primaryScoreMax}
                  </span>
                </span>
                <span className="text-sm leading-relaxed text-slate">{instrument.purpose}</span>
                <span className="font-mono text-xs text-faint">
                  {instrument.itemCount} items · {instrument.minutesToComplete}
                </span>
                <span className="mt-auto flex flex-wrap gap-2 pt-2">
                  {/*
                    "Runnable" needs BOTH the licensing gate and loaded
                    content. Saying an instrument is runnable beside a
                    "licensing pending" badge is a contradiction a management
                    surface must not present.
                  */}
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                    style={{
                      background:
                        decision.allowed && contentLoaded
                          ? "var(--color-pulse-soft)"
                          : "var(--color-sand)",
                      color:
                        decision.allowed && contentLoaded
                          ? "var(--color-pulse-deep)"
                          : "var(--color-slate)",
                    }}
                  >
                    {decision.allowed && contentLoaded
                      ? "Runnable here"
                      : decision.allowed
                        ? "Preview only"
                        : "Not runnable"}
                  </span>
                  {!contentLoaded && (
                    <span className="rounded-full border border-[rgba(138,106,47,0.4)] px-2.5 py-0.5 font-mono text-[10px] tracking-wide text-pulse-attention uppercase">
                      Demo / licensing pending
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <nav className="mt-9 flex flex-wrap gap-3">
        <Link
          href="/wellbeing/admin/instruments"
          className="pulse-focus rounded-full bg-pulse px-5 py-2.5 text-sm font-medium text-white"
        >
          Instrument comparison
        </Link>
        <Link
          href="/wellbeing/analytics"
          className="pulse-focus rounded-full border border-[rgba(31,78,95,0.24)] px-5 py-2.5 text-sm font-medium text-pulse"
        >
          Analytics workspace
        </Link>
      </nav>
    </div>
  );
}
