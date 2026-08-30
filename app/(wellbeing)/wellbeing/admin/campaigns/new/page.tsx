import type { Metadata } from "next";
import { requireManagementSurface } from "@/lib/wellbeing/demo-access";
import { resolveWellbeingScope } from "@/lib/wellbeing/access";
import { getInstrumentAvailability } from "@/lib/wellbeing/queries";
import { INSTRUMENTS } from "@/data/wellbeing-instruments";
import { NewCampaignForm } from "@/components/wellbeing/NewCampaignForm";

export const metadata: Metadata = { title: "New campaign" };

/**
 * Create a Wellbeing Pulse campaign.
 *
 * The questionnaire is chosen HERE, before the campaign exists, because the QR
 * code and join link it produces are printed and forwarded and have to mean
 * one thing permanently. It is locked the moment a participant answers.
 */
export default async function NewWellbeingCampaignPage() {
  const context = await requireManagementSurface();
  const [{ scope }, availability] = await Promise.all([
    resolveWellbeingScope(),
    getInstrumentAvailability(context),
  ]);

  const options = availability.map((entry) => ({
    key: entry.key,
    name: INSTRUMENTS[entry.key].name,
    purpose: INSTRUMENTS[entry.key].purpose,
    itemCount: INSTRUMENTS[entry.key].itemCount,
    minutes: INSTRUMENTS[entry.key].minutesToComplete,
    available: entry.available,
    reason: entry.unavailableReason,
  }));

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
        Wellbeing Pulse
      </p>
      <h1 className="mt-3 font-display text-h2 font-semibold tracking-tight">Create a campaign</h1>
      <p className="mt-4 text-lead text-slate">
        A campaign asks one questionnaire. Its QR code and join link carry that choice
        permanently, so it is chosen now and locks once somebody answers.
      </p>

      <NewCampaignForm
        organizations={scope.map((s) => ({ id: s.organizationId, name: s.organizationName }))}
        instruments={options}
      />
    </div>
  );
}
