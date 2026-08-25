import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManagementDemo } from "@/lib/wellbeing/demo-access";
import {
  buildIllustrativeResult,
  buildStructurePreview,
  CONTENT_PENDING_PLACEHOLDER,
  ILLUSTRATIVE_BANNER,
} from "@/lib/wellbeing/preview";
import { INSTRUMENTS, isInstrumentKey } from "@/data/wellbeing-instruments";
import { PulseTrend } from "@/components/wellbeing/PulseTrend";

export const metadata: Metadata = { title: "Instrument preview" };

/**
 * Per-instrument management preview.
 *
 * Three sections: what the instrument is, what the questionnaire experience
 * looks like, and what a result looks like.
 *
 * The structure preview renders as static markup with NO form, NO submit and
 * NO action — there is nothing to press, so there is nothing to store. The
 * illustrative result is built from hard-coded numbers and is labelled as such
 * on every figure group.
 */
export default async function InstrumentDemoPage({
  params,
}: {
  params: Promise<{ instrument: string }>;
}) {
  const { instrument: key } = await params;
  if (!isInstrumentKey(key)) notFound();
  await requireManagementDemo();

  const instrument = INSTRUMENTS[key];
  const preview = buildStructurePreview(key);
  const illustrative = buildIllustrativeResult(key);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        href="/wellbeing/admin/demo"
        className="pulse-focus rounded font-mono text-[11px] tracking-[0.18em] text-pulse-teal uppercase"
      >
        ← Management demo
      </Link>
      <h1 className="mt-3 font-display text-h2 font-semibold tracking-tight">{instrument.name}</h1>
      <p className="mt-3 max-w-2xl text-lead text-slate">{instrument.purpose}</p>

      {/* ── 1 · what it is ─────────────────────────────────────────── */}
      <section className="pulse-card mt-8 p-6 sm:p-9">
        <h2 className="font-display text-h3 font-semibold">Instrument overview</h2>
        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {[
            { label: "Publisher", value: instrument.publisher },
            { label: "Length", value: `${instrument.itemCount} items` },
            { label: "Expected completion", value: instrument.minutesToComplete },
            {
              label: "Primary score",
              value: `${instrument.primaryScoreLabel} (${instrument.primaryScoreMin}–${instrument.primaryScoreMax})`,
            },
            {
              label: "Score direction",
              value:
                instrument.scoreDirection === "higher_is_more_distress"
                  ? "Higher = more reported distress"
                  : "Higher = stronger reported wellbeing",
            },
            {
              label: "Secondary stored measure",
              value: illustrative.secondaryLabel
                ? `0–${illustrative.secondaryMax} (stored, not shown to participants)`
                : "None",
            },
            { label: "Threshold model", value: instrument.thresholdDescription },
            { label: "Subscales / dimensions", value: instrument.subscaleDescription },
            { label: "Individual history", value: "Full history, trend and movement" },
            {
              label: "Analytics",
              value: "Overview · Compare · Trends · Teams · Locations",
            },
            { label: "Reporting", value: "Private participant PDF, opt-in email delivery" },
            { label: "Licensing", value: instrument.licensingDescription },
            {
              label: "Participant availability",
              value:
                instrument.status === "active"
                  ? "Available"
                  : "Not available — see licensing",
            },
          ].map((row) => (
            <div key={row.label} className="flex flex-col gap-1">
              <dt className="text-[11px] tracking-[0.12em] text-faint uppercase">{row.label}</dt>
              <dd className="text-sm leading-relaxed text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>

        {instrument.subscales.length > 0 && (
          <div className="mt-6 border-t border-[rgba(31,78,95,0.14)] pt-5">
            <p className="text-[11px] tracking-[0.12em] text-faint uppercase">Subscales</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {instrument.subscales.map((subscale) => (
                <li key={subscale.key} className="text-sm text-ink">
                  {subscale.label}{" "}
                  <span className="font-mono text-xs text-faint">
                    items {subscale.itemRange[0]}–{subscale.itemRange[1]}
                  </span>
                </li>
              ))}
            </ul>
            {/* §3: no threshold is shown beside any subscale. */}
            <p className="mt-3 text-xs leading-relaxed text-slate">
              Subscales are profile dimensions. No threshold is applied to any of them
              individually — the configured threshold applies to the total score only.
            </p>
          </div>
        )}

        {instrument.attribution && (
          <p className="mt-6 border-t border-[rgba(31,78,95,0.14)] pt-5 text-xs leading-relaxed text-faint">
            {instrument.attribution}
          </p>
        )}
      </section>

      {/* ── 2 · questionnaire experience ───────────────────────────── */}
      <section className="pulse-card mt-6 p-6 sm:p-9">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h2 className="font-display text-h3 font-semibold">Participant experience</h2>
          {preview.banner && (
            <span className="rounded-full border border-[rgba(138,106,47,0.45)] px-3 py-1 font-mono text-[10px] tracking-wide text-pulse-attention uppercase">
              {preview.banner}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate">
          {preview.contentAvailable
            ? "The live questionnaire, exactly as a participant sees it."
            : "Structure only. This is not an active questionnaire — it cannot be answered, scored or submitted, and no responses are stored."}
        </p>

        {preview.instruction && (
          <p className="mt-5 rounded-2xl bg-pulse-mist px-5 py-4 text-sm leading-relaxed text-slate">
            {preview.instruction}
          </p>
        )}

        <ol className="mt-6 flex flex-col gap-4">
          {preview.items.slice(0, 3).map((item) => (
            <PreviewStep
              key={item.number}
              item={item}
              total={preview.items.length}
              optionLabels={preview.optionLabels}
            />
          ))}
        </ol>

        {preview.items.length > 3 && (
          <div className="mt-5 rounded-2xl border border-dashed border-[rgba(31,78,95,0.28)] px-5 py-4">
            <p className="text-sm text-slate">
              …and {preview.items.length - 3} further{" "}
              {preview.items.length - 3 === 1 ? "item" : "items"}, one per screen.
            </p>
            {preview.items.some((item) => item.sectionLabel) && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {[...new Set(preview.items.map((item) => item.sectionLabel).filter(Boolean))].map(
                  (section) => (
                    <li
                      key={section}
                      className="rounded-full bg-pulse-mist px-3 py-1 font-mono text-[11px] text-pulse-deep"
                    >
                      {section}
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ── 3 · result ─────────────────────────────────────────────── */}
      <section className="pulse-card mt-6 p-6 sm:p-9">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h2 className="font-display text-h3 font-semibold">Result preview</h2>
          <span className="rounded-full border border-[rgba(138,106,47,0.45)] px-3 py-1 font-mono text-[10px] tracking-wide text-pulse-attention uppercase">
            {ILLUSTRATIVE_BANNER}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate">
          Every figure below is a fixed demonstration number. Nothing here is an assessment
          result, and nothing is stored.
        </p>

        <div className="mt-6 flex flex-wrap items-baseline gap-x-3">
          <span
            className="font-display text-[clamp(2.6rem,8vw,3.6rem)] leading-none font-semibold tabular-nums"
            style={{ color: "var(--color-pulse)" }}
          >
            {illustrative.headline}
          </span>
          <span className="font-mono text-lg text-slate">/ {illustrative.headlineMax}</span>
          <span className="ml-auto text-xs tracking-[0.14em] text-faint uppercase">
            {illustrative.headlineLabel}
          </span>
        </div>

        {illustrative.rawScore !== null && (
          <p className="mt-2 font-mono text-xs text-slate">
            {illustrative.rawScore} of {illustrative.rawMax} raw points
          </p>
        )}

        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
          {illustrative.threshold !== null ? (
            <div>
              <dt className="text-[11px] tracking-[0.12em] text-faint uppercase">
                Configured screening threshold
              </dt>
              <dd className="text-sm text-ink">{illustrative.threshold}</dd>
            </div>
          ) : (
            <div>
              <dt className="text-[11px] tracking-[0.12em] text-faint uppercase">Threshold</dt>
              <dd className="text-sm text-ink">{instrument.thresholdDescription}</dd>
            </div>
          )}
          {illustrative.secondaryLabel && (
            <div>
              <dt className="text-[11px] tracking-[0.12em] text-faint uppercase">
                Secondary measure
              </dt>
              <dd className="text-sm text-ink">
                {illustrative.secondaryValue} / {illustrative.secondaryMax}
              </dd>
            </div>
          )}
        </dl>

        {illustrative.subscores.length > 0 && (
          <div className="mt-7 border-t border-[rgba(31,78,95,0.14)] pt-6">
            <h3 className="font-display text-[1.05rem] font-semibold">
              {instrument.subscales.length > 0 ? "Subscale profile" : "Dimension profile"}
            </h3>
            <ul className="mt-4 flex flex-col gap-3">
              {illustrative.subscores.map((subscore) => (
                <li key={subscore.key} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="text-sm font-medium text-ink">{subscore.label}</span>
                    <span className="ml-auto font-mono text-sm tabular-nums text-pulse-deep">
                      {subscore.value}
                      <span className="text-faint"> / {subscore.max}</span>
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-pulse-soft/60">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max((subscore.value / subscore.max) * 100, 1.5)}%`,
                        background: "var(--color-pulse)",
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            {instrument.subscales.length > 0 && (
              <p className="mt-4 text-xs leading-relaxed text-slate">
                No threshold is shown beside a subscale. The configured threshold applies to the
                total score only.
              </p>
            )}
          </div>
        )}

        <div className="mt-7 border-t border-[rgba(31,78,95,0.14)] pt-6">
          <h3 className="font-display text-[1.05rem] font-semibold">History</h3>
          <p className="mt-1.5 mb-4 text-sm text-slate">
            Four illustrative waves on this instrument&rsquo;s own scale.
          </p>
          <PulseTrend
            max={illustrative.headlineMax}
            points={illustrative.history.map((point) => ({
              label: point.label,
              score: point.value,
              threshold: illustrative.threshold,
              atOrAbove:
                illustrative.threshold !== null && point.value >= illustrative.threshold,
            }))}
          />
        </div>
      </section>
    </div>
  );
}

/**
 * One questionnaire step, rendered as static markup.
 *
 * Deliberately NOT a form: the options are list items, not inputs or buttons.
 * There is no control to press and no handler to fire, so "the preview cannot
 * submit" is a property of the markup rather than a disabled attribute someone
 * could remove.
 */
function PreviewStep({
  item,
  total,
  optionLabels,
}: {
  item: { number: number; prompt: string | null; sectionLabel: string | null };
  total: number;
  optionLabels: string[];
}) {
  return (
    <li className="rounded-[24px] border border-[rgba(31,78,95,0.18)] bg-pulse-mist/40 p-5">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="font-mono text-xs text-slate">
          Question {item.number} of {total}
        </span>
        {item.sectionLabel && (
          <span className="rounded-full bg-pulse-soft/70 px-2.5 py-0.5 font-mono text-[10px] text-pulse-deep">
            {item.sectionLabel}
          </span>
        )}
      </div>

      <p
        className={`mt-3 leading-snug ${
          item.prompt
            ? "font-display text-[1.15rem] font-semibold text-ink"
            : "font-mono text-sm text-faint italic"
        }`}
      >
        {item.prompt ?? CONTENT_PENDING_PLACEHOLDER}
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {optionLabels.map((label) => (
          <li
            key={label}
            className="flex items-center gap-3 rounded-xl border border-[rgba(31,78,95,0.16)] bg-paper px-4 py-3 text-sm text-slate"
          >
            <span
              aria-hidden="true"
              className="h-4 w-4 shrink-0 rounded-full border border-[rgba(31,78,95,0.35)]"
            />
            {label}
          </li>
        ))}
      </ul>
    </li>
  );
}
