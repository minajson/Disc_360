import "server-only";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import {
  INSTRUMENTS,
  canServeToParticipants,
  isInstrumentKey,
  type InstrumentKey,
} from "@/data/wellbeing-instruments";
import { isProductionEnvironment, isWellbeingDemoEnabled } from "@/lib/wellbeing/environment";
import { WELLBEING_SUB_UNIT_LABEL } from "@/data/wellbeing-taxonomy";

/**
 * Is this campaign ready for a participant to scan its code?
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY A CAMPAIGN CAN BE MISCONFIGURED AT ALL.
 *
 * A campaign needs an instrument that can actually be served, and a set of
 * governed lookups the participant's context form is built from. Those are
 * configured by different people at different times — a facilitator picks the
 * instrument, wellbeing governance owns the catalogues — so there is a real
 * window in which a campaign exists, has a QR code, and cannot be completed.
 *
 * WHY THE CHECK IS HERE RATHER THAN IN THE FORM.
 *
 * The alternative to this module is what the form used to do: notice that no
 * Sub-unit / Team exists and quietly stop requiring it. That looks like
 * resilience and is actually data loss — every response collected in that
 * window has a hole in a dimension the analytics is built to compare on, and
 * nobody finds out until a cohort comparison is inexplicably thin.
 *
 * Worse, it puts the discovery in the wrong place. A participant standing in a
 * corridor with a phone cannot fix a missing catalogue; a facilitator can, in
 * about a minute, if somebody tells them. So an incomplete campaign refuses
 * participants and tells the facilitator exactly what to add.
 *
 * "NOT APPLICABLE" IS A CONFIGURATION, NOT AN EXCEPTION.
 *
 * An organisation that genuinely has no sub-units is expected to add one
 * controlled value saying so. That keeps the dimension present and honest —
 * "Not Applicable, n = 240" is a fact — rather than making the field
 * conditionally absent and the column conditionally null.
 * ─────────────────────────────────────────────────────────────────────
 */

export type ReadinessIssueCode =
  | "infrastructure_unavailable"
  | "no_instrument"
  | "instrument_not_servable"
  | "no_questionnaire_content"
  | "no_departments"
  | "no_sub_units"
  | "no_office_locations";

export interface ReadinessIssue {
  code: ReadinessIssueCode;
  /** What is wrong, in a facilitator's terms. */
  message: string;
  /** The single next action. Never a list of possibilities. */
  fix: string;
  /** Where that action is taken, when it is somewhere in this product. */
  href?: string;
}

export interface CampaignReadiness {
  ready: boolean;
  issues: ReadinessIssue[];
}

/**
 * A MISSING TABLE AND AN EMPTY CATALOGUE ARE DIFFERENT FACTS.
 *
 * This module ran in production against a database that did not yet have
 * `wellbeing_sub_units` — the code had shipped, the migration had not. The
 * query errored, `data` came back null, and `(subUnits?.length ?? 0) === 0`
 * read that as "the catalogue exists and is empty". Every campaign was
 * reported as unready, and the facilitator was told to add a Sub-unit value
 * to a table that did not exist. There was no action they could take.
 *
 * The participant's message is the same either way, and should be: neither
 * state is theirs to fix. The facilitator's must not be, because one of them
 * is a deployment and the other is a minute of configuration.
 *
 * PostgREST reports a missing relation as PGRST205, and Postgres as 42P01.
 * Those are named because they are the case we can describe precisely — but
 * ANY error means the row count is meaningless, so any error marks the lookup
 * unavailable rather than empty. Reading a failed query as "zero rows" is the
 * whole shape of this bug, and it should not survive for the errors nobody
 * enumerated.
 */
const MISSING_RELATION_CODES = new Set(["PGRST205", "42P01"]);

interface LookupProbe {
  /** Rows found. Meaningless when `unavailable` is true. */
  count: number;
  /** The catalogue could not be consulted at all, for any reason. */
  unavailable: boolean;
  /** True for the case we can name: the relation does not exist yet. */
  missingRelation: boolean;
}

const probe = (result: {
  data: unknown[] | null;
  error: { code?: string } | null;
}): LookupProbe => ({
  count: result.data?.length ?? 0,
  unavailable: Boolean(result.error),
  missingRelation: Boolean(result.error && MISSING_RELATION_CODES.has(result.error.code ?? "")),
});

/** What a participant is told. Never the configuration detail. */
export const CAMPAIGN_NOT_READY_PARTICIPANT_MESSAGE =
  "This check-in is not open yet. Your organisation is still setting it up — please try the link again shortly, or ask whoever invited you.";

/**
 * The organisation is resolved HERE, from the campaign, rather than passed in.
 *
 * The public invitation calls this, and its own context deliberately carries
 * no organisation id — a page that renders before sign-in should hold as few
 * identifiers as possible. Looking it up inside a server-only module costs one
 * query and keeps the public payload minimal.
 */
export async function checkCampaignReadiness(
  campaignId: string,
  instrumentKeyRaw: string | null,
): Promise<CampaignReadiness> {
  const issues: ReadinessIssue[] = [];
  const settings = `/wellbeing/admin/campaigns/${campaignId}/settings`;

  /* ── the instrument ─────────────────────────────────────────────── */

  const instrumentKey: InstrumentKey | null =
    instrumentKeyRaw && isInstrumentKey(instrumentKeyRaw) ? instrumentKeyRaw : null;

  if (!instrumentKey) {
    issues.push({
      code: "no_instrument",
      message: "No questionnaire is selected for this campaign.",
      fix: "Choose a questionnaire in Settings. It is fixed once the first person answers.",
      href: settings,
    });
  } else {
    const decision = canServeToParticipants(instrumentKey, {
      isProduction: isProductionEnvironment(),
      demoEnabled: isWellbeingDemoEnabled(),
    });
    if (!decision.allowed) {
      issues.push({
        code: "instrument_not_servable",
        message: `${INSTRUMENTS[instrumentKey].name} cannot be served to participants yet.`,
        // The licensing gate is doing its job. Naming it is more useful than
        // "unavailable", which reads as a fault in the product.
        fix: decision.reason ?? "Its content is awaiting licence confirmation.",
        href: "/wellbeing/admin/instruments",
      });
    }
  }

  const admin = createSupabaseAdminClient();

  const { data: campaign } = await admin
    .from("teams")
    .select("organization_id")
    .eq("id", campaignId)
    .maybeSingle();
  const organizationId = (campaign?.organization_id as string | null) ?? null;

  /* ── the questionnaire actually exists ──────────────────────────── */

  if (instrumentKey) {
    const { data: version } = await admin
      .from("wellbeing_versions")
      .select("id")
      .eq("instrument_key", instrumentKey)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (!version) {
      issues.push({
        code: "no_questionnaire_content",
        message: `No active ${INSTRUMENTS[instrumentKey].name} questionnaire is installed.`,
        fix: "Its items are installed by a migration, not by configuration — this needs a deployment.",
      });
    }
  }

  /* ── the governed lookups the context form is built from ────────── */
  //
  // Platform-level rows (organization_id null) count: an organisation that has
  // not customised its taxonomy still has a usable form. Sub-units are the
  // exception — there is no platform catalogue of them, by design.

  if (organizationId) {
    const [departmentsResult, subUnitsResult, officesResult] = await Promise.all([
      admin
        .from("wellbeing_departments")
        .select("id")
        .is("archived_at", null)
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .limit(1),
      admin
        .from("wellbeing_sub_units")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .limit(1),
      admin
        .from("wellbeing_office_locations")
        .select("id")
        .is("archived_at", null)
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .limit(1),
    ]);

    const departments = probe(departmentsResult);
    const subUnits = probe(subUnitsResult);
    const offices = probe(officesResult);

    // Schema first, and on its own. A deployment that has not finished is one
    // fact about the platform, not three facts about this organisation's
    // catalogues — listing "add a Department", "add a Sub-unit" and "add an
    // Office Location" underneath it would be three instructions nobody can
    // carry out.
    const unavailable = [
      departments.unavailable && "Department / Function",
      subUnits.unavailable && WELLBEING_SUB_UNIT_LABEL,
      offices.unavailable && "Office Location",
    ].filter((label): label is string => typeof label === "string");

    const missing = [departments, subUnits, offices].filter((p) => p.missingRelation).length;

    if (unavailable.length > 0) {
      issues.push({
        code: "infrastructure_unavailable",
        message: "Wellbeing campaign infrastructure is still being activated.",
        // Named so whoever reads it can tell a deployment engineer what is
        // missing, without implying the facilitator can configure it.
        fix: `${unavailable.join(", ")} could not be read on this deployment${
          missing === 0
            ? ""
            : missing === 1
              ? " — its table is not installed yet"
              : " — their tables are not installed yet"
        }. This is resolved by a release, not by configuration; no action is needed from you.`,
      });
      return { ready: false, issues };
    }

    if (departments.count === 0) {
      issues.push({
        code: "no_departments",
        message: "This organisation has no Department / Function values.",
        fix: "Wellbeing governance must add at least one before the campaign opens.",
      });
    }
    if (subUnits.count === 0) {
      issues.push({
        code: "no_sub_units",
        message: `This organisation has no ${WELLBEING_SUB_UNIT_LABEL} values.`,
        // The explicit escape hatch, stated as configuration rather than left
        // for somebody to work out.
        fix: `Add at least one ${WELLBEING_SUB_UNIT_LABEL} before opening this campaign. If your organisation does not use sub-units, add a single value called “Not Applicable”.`,
      });
    }
    if (offices.count === 0) {
      issues.push({
        code: "no_office_locations",
        // Office Location is asked only of office-based respondents, but the
        // campaign cannot know in advance who those will be — so an empty
        // catalogue is a campaign that half its participants cannot finish.
        message: "This organisation has no Office Location values.",
        fix: "Office-based participants are asked for one, so at least one value is needed before the campaign opens.",
      });
    }
  }

  return { ready: issues.length === 0, issues };
}

/**
 * Work Location needs no readiness check, and that is worth saying once.
 *
 * It is a fixed two-value enum in the schema — field-based and office-based —
 * not a governed catalogue. There is no configuration that can make it empty,
 * so there is nothing here that could be missing.
 */
export const WORK_LOCATION_NEEDS_NO_CONFIGURATION = true;
