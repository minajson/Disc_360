import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireOnboarded } from "@/lib/auth/guards";
import { getActiveQuestionnaire, getWellbeingFormOptions } from "@/lib/wellbeing/queries";
import { PulseFlow } from "@/components/wellbeing/PulseFlow";
import type { WorkLocation } from "@/data/wellbeing-taxonomy";

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
      "id, profile_id, status, version_id, organization_id, current_index, department_name, work_location, office_location_name, job_title, self_reported_first_time, email_opt_in, contact_email",
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

  const [questionnaire, options, { data: responses }] = await Promise.all([
    getActiveQuestionnaire(context),
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
  const contextComplete = Boolean(
    session.department_name &&
      workLocation &&
      (workLocation === "field_based" || session.office_location_name),
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-8 sm:py-14">
      <PulseFlow
        sessionId={sessionId}
        items={questionnaire.items}
        options={options}
        accountEmail={context.profile.email}
        initial={{
          departmentName: (session.department_name as string | null) ?? null,
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
