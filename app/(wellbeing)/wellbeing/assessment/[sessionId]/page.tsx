import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireOnboarded } from "@/lib/auth/guards";
import { getQuestionnaireByVersion, getWellbeingFormOptions } from "@/lib/wellbeing/queries";
import { PulseFlow } from "@/components/wellbeing/PulseFlow";
import type { WorkLocation } from "@/data/wellbeing-taxonomy";
import { isInstrumentKey } from "@/data/wellbeing-instruments";

export const metadata: Metadata = { title: "Your check-in" };

/**
 * The questionnaire runner.
 *
 * Authorization is ownership: the session is read through the participant's
 * own RLS-scoped client and compared to their id, so a session id belonging to
 * someone else is a 404 — indistinguishable from one that does not exist.
 *
 * A session that is already complete redirects to its result rather than
 * offering a second scoring pass.
 */
export default async function WellbeingAssessmentPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  if (!z.uuid().safeParse(sessionId).success) notFound();

  const context = await requireOnboarded();
  const { supabase, user } = context;

  const { data: session } = await supabase
    .from("wellbeing_sessions")
    .select(
      "id, profile_id, status, version_id, instrument_key, organization_id, current_index, department_name, sub_unit_name, work_location, office_location_name, job_title, self_reported_first_time, email_opt_in, contact_email",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || session.profile_id !== user.id) notFound();

  if (session.status === "completed") {
    const { data: existing } = await supabase
      .from("wellbeing_results")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (existing) redirect(`/wellbeing/result/${existing.id}`);
    redirect("/wellbeing");
  }

  const instrumentKey = session.instrument_key as string;
  if (!isInstrumentKey(instrumentKey)) redirect("/wellbeing");

  const [questionnaire, options, { data: responses }] = await Promise.all([
    /*
     * The questionnaire is the one THIS session was started with.
     *
     * ─────────────────────────────────────────────────────────────────
     * THE COMMENT THAT WAS TRUE AND THE CALL THAT WAS NOT.
     *
     * This block already carried a note saying "never a freshly resolved
     * active one, which could differ if a facilitator changed the campaign
     * mid-flight" — and then called `getActiveQuestionnaire(context,
     * instrumentKey)`, which resolves by `is_active` and never looks at
     * `session.version_id` at all.
     *
     * So the stated invariant was not implemented. Activate a new version
     * while somebody is part-way through and their remaining items would come
     * from the new wording, silently, while their answers were scored as one
     * set. It went unnoticed because exactly one version per instrument may be
     * active, which made "the active one" accidentally equal to "theirs".
     *
     * It now reads the session's own version id — the one the campaign pinned,
     * copied onto the session at creation and refused by the database if it
     * ever disagreed with the campaign.
     * ─────────────────────────────────────────────────────────────────
     */
    getQuestionnaireByVersion(context, session.version_id as string),
    getWellbeingFormOptions(context, (session.organization_id as string | null) ?? null),
    supabase
      .from("wellbeing_responses")
      .select("item_id, option_position")
      .eq("session_id", sessionId),
  ]);

  if (!questionnaire) redirect("/wellbeing?unavailable=1");

  const answers: Record<string, number> = {};
  for (const response of responses ?? []) {
    answers[response.item_id as string] = response.option_position as number;
  }

  const workLocation = (session.work_location as WorkLocation | null) ?? null;
  // Exactly the database's own `wellbeing_sessions_completed_is_complete`
  // predicate — department, work location, and an office when office-based.
  //
  // Sub-unit / Team is deliberately NOT here. It is optional, so a blank one
  // is a complete answer; requiring it would return the participant to the
  // context step every time they submitted it empty, which is a loop with no
  // way out rather than a prompt.
  const contextComplete = Boolean(
    session.department_name &&
      workLocation &&
      (workLocation === "field_based" || session.office_location_name),
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-8 sm:py-14">
      <PulseFlow
        sessionId={sessionId}
        instruction={questionnaire.instruction}
        items={questionnaire.items}
        options={options}
        accountEmail={context.profile.email}
        initial={{
          departmentName: (session.department_name as string | null) ?? null,
          subUnitName: (session.sub_unit_name as string | null) ?? null,
          workLocation,
          officeLocationName: (session.office_location_name as string | null) ?? null,
          jobTitle: (session.job_title as string | null) ?? null,
          selfReportedFirstTime: (session.self_reported_first_time as boolean | null) ?? null,
          emailOptIn: Boolean(session.email_opt_in),
          contactEmail: (session.contact_email as string | null) ?? null,
          answers,
          currentIndex: (session.current_index as number | null) ?? 0,
          contextComplete,
        }}
      />
    </div>
  );
}
