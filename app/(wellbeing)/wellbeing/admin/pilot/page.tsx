import type { Metadata } from "next";
import Link from "next/link";
import { requireManagementSurface } from "@/lib/wellbeing/demo-access";
import { getInstrumentAvailability } from "@/lib/wellbeing/queries";
import { INSTRUMENTS, INSTRUMENT_KEYS, type InstrumentKey } from "@/data/wellbeing-instruments";
import { resolveWellbeingScope } from "@/lib/wellbeing/access";
import { createSupabaseAdminClient } from "@/lib/db/admin";

export const metadata: Metadata = { title: "Management Pilot" };

/**
 * The Management Pilot home.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THIS PAGE IS FOR.
 *
 * One question: if this organisation ran the programme, what would it
 * actually learn, and what would it still not be able to see about anyone?
 *
 * So every instrument gets the same two doors — the participant's experience
 * and the management experience — and none of them is presented as the
 * recommended answer. Choosing a wellbeing instrument is a governance decision
 * with clinical and legal dimensions this page is not qualified to make; its
 * job is to make the four comparable and let people try them.
 *
 * An instrument whose content is not licensed shows its status plainly and
 * offers the management view only. That is the licensing gate doing its work,
 * not a missing feature, so the card says so rather than hiding the option.
 * ─────────────────────────────────────────────────────────────────────
 */

const PILOT_STATUS: Record<InstrumentKey, string> = {
  ghq12: "Licensing review · internal evaluation",
  ghq28: "Licensing review · internal evaluation",
  who5: "Source and licence confirmation · internal evaluation",
  disc360_wellbeing_v1: "Internal evaluation",
};

export default async function ManagementPilotPage() {
  const context = await requireManagementSurface();
  const [availability, { scope }] = await Promise.all([
    getInstrumentAvailability(context),
    resolveWellbeingScope(),
  ]);
  const runnable = new Map(availability.map((entry) => [entry.key, entry]));

  // Campaigns already running, so a facilitator lands on what exists rather
  // than on an empty page that asks them to create something first.
  const admin = createSupabaseAdminClient();
  const { data: campaigns } = await admin
    .from("teams")
    .select("id, name, wellbeing_instrument_key, wellbeing_pilot_capacity")
    .eq("assessment_type", "wellbeing")
    .is("archived_at", null)
    .order("name");

  const organizationId = scope[0]?.organizationId ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
        Wellbeing Pulse
      </p>
      <h1 className="mt-3 font-display text-h1 font-semibold tracking-tight text-balance">
        Management Pilot
      </h1>
      <p className="mt-4 max-w-2xl text-lead text-slate">
        Evaluate the available wellbeing instruments, participant experience and organisational
        insights before programme launch.
      </p>

      {/* ── the four instruments ─────────────────────────────────── */}
      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        {INSTRUMENT_KEYS.map((key) => {
          const instrument = INSTRUMENTS[key];
          const entry = runnable.get(key);
          const canRun = entry?.available ?? false;
          return (
            <section
              key={key}
              className="pulse-card flex flex-col gap-5 p-6 sm:p-7"
              aria-labelledby={`instrument-${key}`}
            >
              <div>
                <h2
                  id={`instrument-${key}`}
                  className="font-display text-h3 font-semibold text-ink"
                >
                  {instrument.name}
                </h2>
                <p className="mt-1.5 font-mono text-xs text-faint">
                  {instrument.itemCount} items · {instrument.minutesToComplete}
                  {instrument.subscales.length > 0
                    ? ` · ${instrument.subscales.length} subscales`
                    : key === "disc360_wellbeing_v1"
                      ? " · 6 dimensions"
                      : ""}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate">{instrument.purpose}</p>
              </div>

              <p className="w-fit rounded-full border border-hairline bg-pulse-mist/60 px-3.5 py-1.5 font-mono text-[10px] tracking-[0.12em] text-pulse-deep uppercase">
                {PILOT_STATUS[key]}
              </p>

              <div className="mt-auto flex flex-wrap gap-2.5 border-t border-hairline pt-5">
                {canRun ? (
                  <Link
                    href={`/wellbeing?instrument=${key}`}
                    className="pulse-focus rounded-full bg-pulse-deep px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-ink"
                  >
                    Test as participant
                  </Link>
                ) : (
                  <Link
                    href={`/wellbeing/admin/demo/${key}`}
                    className="pulse-focus rounded-full border border-hairline px-4 py-2 text-xs font-medium text-slate transition-colors hover:text-pulse-deep"
                  >
                    Preview participant experience
                  </Link>
                )}
                <Link
                  href={
                    organizationId
                      ? `/wellbeing/analytics?org=${organizationId}&instrument=${key}&tab=overview&source=demo`
                      : `/wellbeing/admin/demo/${key}`
                  }
                  className="pulse-focus rounded-full border border-hairline px-4 py-2 text-xs font-medium text-slate transition-colors hover:text-pulse-deep"
                >
                  View management experience
                </Link>
              </div>

              {!canRun && (
                <p className="text-xs leading-relaxed text-faint">
                  Questionnaire content is not loaded in this build, so it cannot be answered. The
                  preview shows structure and length only, and the management view uses
                  illustrative data.
                </p>
              )}
            </section>
          );
        })}
      </div>

      {/* ── campaigns ────────────────────────────────────────────── */}
      <section className="pulse-card mt-8 flex flex-col gap-5 p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-h3 font-semibold">Campaigns</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate">
              A campaign runs exactly one instrument, chosen when it is created. Its QR code and
              join link carry that choice permanently — a participant never picks a questionnaire.
            </p>
          </div>
          <Link
            href="/wellbeing/admin/campaigns/new"
            className="pulse-focus rounded-full bg-pulse-deep px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink"
          >
            Create campaign
          </Link>
        </div>

        {campaigns && campaigns.length > 0 ? (
          <ul className="divide-y divide-hairline">
            {campaigns.map((campaign) => {
              const key = campaign.wellbeing_instrument_key as InstrumentKey | null;
              return (
                <li key={campaign.id} className="flex flex-wrap items-center gap-3 py-3.5">
                  <Link
                    href={`/wellbeing/admin/campaigns/${campaign.id}`}
                    className="pulse-focus text-sm font-medium text-ink hover:text-pulse-deep"
                  >
                    {campaign.name}
                  </Link>
                  <span className="font-mono text-xs text-faint">
                    {key ? INSTRUMENTS[key].name : "no instrument"}
                    {campaign.wellbeing_pilot_capacity
                      ? ` · capacity ${campaign.wellbeing_pilot_capacity}`
                      : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate">
            No campaigns yet. Create one to generate a QR code and join link.
          </p>
        )}
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/wellbeing/admin/instruments"
          className="pulse-focus rounded-full border border-hairline px-5 py-2.5 text-sm font-medium text-slate transition-colors hover:text-pulse-deep"
        >
          Compare instruments
        </Link>
      </div>
    </div>
  );
}
