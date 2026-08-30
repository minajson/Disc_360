import {
  SUPPORT_ACTION_LABEL,
  SUPPORT_HEADING,
  SUPPORT_PRIVACY_NOTE,
  SUPPORT_SERVICE_NAME,
  SUPPORT_UNIVERSAL_NOTE,
  supportLead,
  supportLeadForSingle,
} from "@/data/support-content";
import type { OrganisationSupport, SupportRoute } from "@/lib/wellbeing/support";

/**
 * Confidential support, on every result.
 *
 * ─────────────────────────────────────────────────────────────────────
 * `prominent` CHANGES HOW LOUD THIS IS. IT NEVER CHANGES WHETHER IT APPEARS.
 *
 * The card renders whenever the organisation has configured a route, at every
 * score, for everybody. A result the questionnaire flags gets the card earlier
 * in the page and with a heavier edge; a result it does not gets the same card,
 * lower down, quieter. Both get it.
 *
 * That distinction is the whole design. Showing support only above a threshold
 * teaches every employee that the service is for people the questionnaire has
 * classified — which is false, stigmatising, and the surest way to stop the
 * people who would benefit from using it.
 *
 * NOTHING IS RECORDED WHEN SOMEBODY USES THIS.
 *
 * These are plain `tel:`, `mailto:` and `https:` links. No handler, no
 * `onClick`, no beacon, no server action. There is nowhere for a click to be
 * written down, which is a stronger guarantee than a policy of not writing it.
 * ─────────────────────────────────────────────────────────────────────
 */
export function SupportCard({
  support,
  organisationName,
  prominent = false,
}: {
  support: OrganisationSupport;
  organisationName: string | null;
  /** Elevates the visual weight only. Never gates the card. */
  prominent?: boolean;
}) {
  if (support.routes.length === 0) return null;

  const lead =
    support.routes.length === 1
      ? supportLeadForSingle(organisationName, SUPPORT_SERVICE_NAME[support.routes[0]!.kind])
      : supportLead(organisationName);

  return (
    <section
      aria-labelledby="confidential-support"
      className={`pulse-card flex flex-col gap-5 p-6 sm:p-9 ${
        prominent
          ? "border-l-2 border-l-pulse bg-[rgba(31,78,95,0.04)]"
          : "border-l-2 border-l-[rgba(31,78,95,0.28)]"
      }`}
    >
      <div className="flex flex-col gap-3">
        <h2
          id="confidential-support"
          className="font-display text-h3 font-semibold tracking-tight text-ink"
        >
          {SUPPORT_HEADING}
        </h2>
        <p className="text-[0.98rem] leading-relaxed text-ink">{lead}</p>
        <p className="text-sm leading-relaxed text-slate">{SUPPORT_UNIVERSAL_NOTE}</p>
      </div>

      <ul className="flex flex-col gap-3">
        {support.routes.map((route) => (
          <li key={route.kind}>
            <RouteBlock route={route} />
          </li>
        ))}
      </ul>

      {support.note && (
        <p className="text-sm leading-relaxed text-slate">{support.note}</p>
      )}

      <p className="border-t border-[rgba(31,78,95,0.14)] pt-4 text-sm leading-relaxed text-slate">
        {SUPPORT_PRIVACY_NOTE}
      </p>
    </section>
  );
}

/**
 * One service, and every way the organisation said it can be reached.
 *
 * The primary action is the phone number where there is one — somebody
 * deciding whether to talk to a person should not have to find a web form
 * first — and the label always names the service rather than saying "here",
 * so it makes sense read aloud by a screen reader out of context.
 */
function RouteBlock({ route }: { route: SupportRoute }) {
  const service = SUPPORT_SERVICE_NAME[route.kind];
  const label = SUPPORT_ACTION_LABEL[route.kind];

  return (
    <div className="rounded-2xl border border-[rgba(31,78,95,0.18)] bg-paper p-4 sm:p-5">
      <p className="font-display text-[1.02rem] font-semibold text-ink">
        {route.providerName ?? service}
      </p>
      {route.providerName && <p className="mt-0.5 text-sm text-slate">{service}</p>}
      {route.hours && <p className="mt-1.5 text-sm text-slate">{route.hours}</p>}

      <div className="mt-3.5 flex flex-wrap gap-2.5">
        {route.phone && (
          <a
            href={`tel:${route.phone.replace(/[^+0-9]/g, "")}`}
            className="pulse-focus rounded-full bg-pulse px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pulse-deep"
          >
            {label} · {route.phone}
          </a>
        )}
        {route.email && (
          <a
            href={`mailto:${route.email}`}
            className="pulse-focus rounded-full border border-[rgba(31,78,95,0.24)] px-5 py-2.5 text-sm font-medium text-pulse transition-colors hover:border-pulse"
          >
            {route.phone ? `Email ${service}` : `${label} by email`}
          </a>
        )}
        {route.url && (
          <a
            href={route.url}
            target="_blank"
            rel="noreferrer noopener"
            className="pulse-focus rounded-full border border-[rgba(31,78,95,0.24)] px-5 py-2.5 text-sm font-medium text-pulse transition-colors hover:border-pulse"
          >
            {route.phone || route.email ? `${service} online` : label}
          </a>
        )}
      </div>
    </div>
  );
}
