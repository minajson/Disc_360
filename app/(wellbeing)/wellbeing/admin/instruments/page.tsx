import type { Metadata } from "next";
import Link from "next/link";
import { requireManagementSurface } from "@/lib/wellbeing/demo-access";
import { getInstrumentAvailability } from "@/lib/wellbeing/queries";
import {
  INSTRUMENT_KEYS,
  INSTRUMENTS,
  canServeToParticipants,
  unavailableReason,
  type InstrumentMetadata,
} from "@/data/wellbeing-instruments";
import { isWellbeingDemoEnabled, isProductionEnvironment } from "@/lib/wellbeing/environment";

export const metadata: Metadata = { title: "Instruments" };

/**
 * Instrument decision support, for management.
 *
 * Deliberately NEUTRAL. It sets out what each instrument measures, how long it
 * takes, what it produces and what its licensing position is, and it does not
 * recommend one. Choosing a wellbeing instrument is a governance decision with
 * clinical and legal dimensions this page is not qualified to make — its job
 * is to make the four options comparable, not to pick.
 *
 * It shows no participant data of any kind, so it needs no wellbeing role and
 * no demo flag — a facilitator choosing an instrument for a campaign reaches
 * it in any environment. It is still not a participant surface, so it asks
 * for elevated scope of some kind and redirects anyone else.
 */
export default async function InstrumentComparisonPage() {
  const context = await requireManagementSurface();
  const availability = await getInstrumentAvailability(context);
  const liveVersions = new Map(availability.map((entry) => [entry.key, entry.available]));

  const isProduction = isProductionEnvironment();
  const demoEnabled = isWellbeingDemoEnabled();

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase">
        Internal decision support
      </p>
      <h1 className="mt-3 font-display text-h2 font-semibold tracking-tight">
        Wellbeing instruments
      </h1>
      <p className="mt-4 max-w-2xl text-lead text-slate">
        Four instruments, compared on what they measure and what they require. None is presented
        as better than another — they answer different questions and carry different obligations.
      </p>

      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-[rgba(31,78,95,0.16)] bg-pulse-mist/60 p-5 text-sm leading-relaxed text-slate">
        <p>
          <strong className="font-medium text-ink">Scores are never combined.</strong> Each
          instrument has its own scale, its own direction and its own engine. A GHQ score cannot
          be converted into a WHO-5 score or a Wellbeing Index, and no view in this product
          aggregates across them.
        </p>
        <p>
          <strong className="font-medium text-ink">Current environment:</strong>{" "}
          <span className="font-mono">
            {isProduction ? "production" : "local / non-production"} · demo mode{" "}
            {demoEnabled ? "on" : "off"}
          </span>
          . Instruments awaiting licence confirmation can only be run where both conditions
          permit it.
        </p>
      </div>

      {/* Wide table scrolls inside its own container; the page never does. */}
      <div className="mt-8 -mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <caption className="sr-only">Comparison of the four wellbeing instruments</caption>
          <thead>
            <tr className="border-b border-[rgba(31,78,95,0.2)]">
              <th scope="col" className="pb-3 pr-4 text-left text-xs font-medium tracking-wide text-faint uppercase">
                Attribute
              </th>
              {INSTRUMENT_KEYS.map((key) => (
                <th
                  key={key}
                  scope="col"
                  className="pb-3 pr-4 text-left font-display text-[0.95rem] font-semibold text-ink"
                >
                  {INSTRUMENTS[key].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-[rgba(31,78,95,0.1)] align-top">
                <th
                  scope="row"
                  className="py-3 pr-4 text-left text-xs font-medium tracking-wide text-faint uppercase"
                >
                  {row.label}
                </th>
                {INSTRUMENT_KEYS.map((key) => (
                  <td key={key} className="py-3 pr-4 leading-relaxed text-ink">
                    {row.value(INSTRUMENTS[key])}
                  </td>
                ))}
              </tr>
            ))}

            <tr className="border-b border-[rgba(31,78,95,0.1)] align-top">
              <th
                scope="row"
                className="py-3 pr-4 text-left text-xs font-medium tracking-wide text-faint uppercase"
              >
                Current activation
              </th>
              {INSTRUMENT_KEYS.map((key) => {
                const decision = canServeToParticipants(key, { isProduction, demoEnabled });
                const hasVersion = liveVersions.get(key) ?? false;

                // Three honest states. An instrument the gate permits but which
                // has no questionnaire loaded is NOT "available" — saying so
                // alongside "no version loaded" is the kind of contradiction a
                // management page must never present.
                const runnable = decision.allowed && hasVersion;
                const label = runnable
                  ? "Available to participants"
                  : decision.allowed
                    ? "Permitted, not runnable"
                    : "Not active";
                const detail = runnable
                  ? null
                  : decision.allowed
                    ? "The licensing gate permits it here, but no questionnaire content is loaded."
                    : unavailableReason(key);

                return (
                  <td key={key} className="py-3 pr-4 leading-relaxed">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{
                        background: runnable ? "var(--color-pulse-soft)" : "var(--color-sand)",
                        color: runnable ? "var(--color-pulse-deep)" : "var(--color-slate)",
                      }}
                    >
                      {label}
                    </span>
                    {detail && (
                      <span className="mt-1.5 block text-xs text-slate">{detail}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <section className="mt-10 flex flex-col gap-4">
        <h2 className="font-display text-h3 font-semibold">What each instrument does not claim</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {INSTRUMENT_KEYS.map((key) => (
            <div
              key={key}
              className="rounded-2xl border border-[rgba(31,78,95,0.16)] bg-paper p-5"
            >
              <p className="font-display text-[1rem] font-semibold text-ink">
                {INSTRUMENTS[key].name}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-slate">
                {INSTRUMENTS[key].notClaims.map((claim) => (
                  <li key={claim}>· {claim}</li>
                ))}
              </ul>
              {INSTRUMENTS[key].attribution && (
                <p className="mt-3 border-t border-[rgba(31,78,95,0.12)] pt-3 text-xs leading-relaxed text-faint">
                  {INSTRUMENTS[key].attribution}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 flex flex-col gap-4">
        <div>
          <h2 className="font-display text-h3 font-semibold">Potential operating models</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate">
            Options, not recommendations. Which of these fits depends on the purpose of the
            programme, the licensing position and the governance capacity to support it — none of
            which this page can weigh.
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2">
          {OPERATING_MODELS.map((model) => (
            <li
              key={model.key}
              className="rounded-2xl border border-[rgba(31,78,95,0.16)] bg-paper p-5"
            >
              <p className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-faint">{model.key}</span>
                <span className="font-display text-[1rem] font-semibold text-ink">
                  {model.title}
                </span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate">{model.note}</p>
            </li>
          ))}
        </ol>
      </section>

      <Link
        href="/wellbeing"
        className="pulse-focus mt-10 inline-block rounded-full border border-[rgba(31,78,95,0.24)] px-5 py-2.5 text-sm font-medium text-pulse"
      >
        Back to Wellbeing Pulse
      </Link>
    </div>
  );
}

const ROWS: { label: string; value: (instrument: InstrumentMetadata) => string }[] = [
  { label: "Purpose", value: (i) => i.purpose },
  { label: "Publisher", value: (i) => i.publisher },
  { label: "Length", value: (i) => `${i.itemCount} items` },
  { label: "Time to complete", value: (i) => i.minutesToComplete },
  {
    label: "Primary score",
    value: (i) => `${i.primaryScoreLabel} (${i.primaryScoreMin}–${i.primaryScoreMax})`,
  },
  {
    label: "Direction",
    value: (i) =>
      i.scoreDirection === "higher_is_more_distress"
        ? "Higher = more reported distress"
        : "Higher = stronger reported wellbeing",
  },
  { label: "Subscales / dimensions", value: (i) => i.subscaleDescription },
  { label: "Threshold model", value: (i) => i.thresholdDescription },
  { label: "Longitudinal support", value: () => "Full history, trend and movement" },
  {
    label: "Analytics available",
    value: (i) =>
      i.subscales.length > 0 || i.key === "disc360_wellbeing_v1"
        ? "Overview, Compare, Trends, Dimensions, Teams, Locations"
        : "Overview, Compare, Trends, Teams, Locations",
  },
  { label: "Licensing status", value: (i) => i.licensingDescription },
  { label: "Scoring engine", value: (i) => i.scoringMethod },
];


/**
 * Operating models, stated neutrally.
 *
 * Each entry describes what the model would mean in practice — what it
 * requires and what it produces — and stops there. No option is marked
 * recommended, preferred or best, because choosing between them is a
 * governance decision with clinical and legal dimensions.
 */
const OPERATING_MODELS: { key: string; title: string; note: string }[] = [
  {
    key: "A",
    title: "GHQ-12 only",
    note: "A short established distress screener with a configured threshold. Requires digital-use rights. Produces one total and no profile.",
  },
  {
    key: "B",
    title: "GHQ-28 only",
    note: "A longer established screener with a four-part profile. Requires digital-use rights and roughly twice the completion time of GHQ-12.",
  },
  {
    key: "C",
    title: "WHO-5 only",
    note: "The shortest option, measuring positive wellbeing rather than distress. Carries an open licence with attribution and share-alike obligations.",
  },
  {
    key: "D",
    title: "DISC360 Wellbeing Pulse only",
    note: "Original content with no third-party licensing dependency and a six-dimension profile. Not psychometrically validated, and carries no threshold.",
  },
  {
    key: "E",
    title: "Established screener plus DISC360 Wellbeing",
    note: "Two instruments run as separate campaigns — one for screening against a configured threshold, one for reflection and dimension trends. Scores stay separate; the platform does not combine them.",
  },
  {
    key: "F",
    title: "Different instruments for different campaign purposes",
    note: "Instrument chosen per campaign — for example a short measure for frequent pulses and a longer one annually. Each campaign is locked to one instrument, and each has its own history and analytics.",
  },
];
