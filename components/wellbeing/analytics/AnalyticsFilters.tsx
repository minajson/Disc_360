import Link from "next/link";
import { INSTRUMENTS, INSTRUMENT_KEYS, type InstrumentKey } from "@/data/wellbeing-instruments";
import type { AnalyticsSource } from "@/lib/wellbeing/analytics";

/**
 * One control row: organisation, questionnaire, data source.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THIS REPLACED.
 *
 * Four stacked rows of pills — an organisation row, a questionnaire row, a
 * source row, and the tab strip — each styled the same way, occupying most of
 * the first screen before a single figure appeared. Everything was equally
 * prominent, which is another way of saying nothing was.
 *
 * They are now one bar of labelled groups. The label is what makes it legible:
 * a row of pills reading "GHQ-12 GHQ-28 WHO-5 Wellbeing Pulse" says nothing
 * about what pressing one does, and pressing one replaces every figure on the
 * page.
 *
 * WHY THESE ARE LINKS AND NOT A CLIENT-SIDE FILTER.
 *
 * Each choice changes what the SERVER is authorised to compute — a different
 * organisation is a different authorisation, and a different questionnaire is
 * a different scale, direction and vocabulary. A client-side filter over a
 * pre-fetched superset would mean the page had already fetched figures the
 * reader had not selected. Navigation keeps the boundary where it belongs, and
 * Next's client router makes it feel immediate.
 *
 * The questionnaire group carries its own warning, because switching it is the
 * one control here that silently changes what the numbers MEAN.
 * ─────────────────────────────────────────────────────────────────────
 */
export function AnalyticsFilters({
  organizations,
  organizationId,
  instrumentKey,
  source,
  tab,
  sources,
}: {
  organizations: { organizationId: string; organizationName: string }[];
  organizationId: string;
  instrumentKey: InstrumentKey;
  source: AnalyticsSource;
  tab: string;
  /** Only the sources this environment actually offers. */
  sources: { key: AnalyticsSource; label: string }[];
}) {
  const href = (next: Partial<{ org: string; instrument: string; source: string }>) =>
    `/wellbeing/analytics?org=${next.org ?? organizationId}` +
    `&instrument=${next.instrument ?? instrumentKey}` +
    `&tab=${tab}&source=${next.source ?? source}`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-hairline bg-mineral/70 p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-8 sm:p-5">
      {organizations.length > 1 && (
        <Group label="Organisation">
          {organizations.map((entry) => (
            <Pill
              key={entry.organizationId}
              href={href({ org: entry.organizationId })}
              current={entry.organizationId === organizationId}
            >
              {entry.organizationName}
            </Pill>
          ))}
        </Group>
      )}

      <Group
        label="Questionnaire"
        note="Changes the scale, the direction and the wording of everything below"
      >
        {INSTRUMENT_KEYS.map((key) => (
          <Pill
            key={key}
            href={href({ instrument: key })}
            current={key === instrumentKey}
          >
            {INSTRUMENTS[key].name}
          </Pill>
        ))}
      </Group>

      {sources.length > 1 && (
        <Group label="Data">
          {sources.map((entry) => (
            <Pill key={entry.key} href={href({ source: entry.key })} current={entry.key === source}>
              {entry.label}
            </Pill>
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="font-mono text-[10px] tracking-[0.16em] text-faint uppercase">{label}</p>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      {note && <p className="text-[11px] leading-relaxed text-faint">{note}</p>}
    </div>
  );
}

function Pill({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`pulse-focus block rounded-full border px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
        current
          ? "border-pulse bg-pulse text-white"
          : "border-[rgba(31,78,95,0.2)] bg-paper text-slate hover:border-pulse hover:text-pulse"
      }`}
    >
      {children}
    </Link>
  );
}
