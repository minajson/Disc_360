import "server-only";
import { sendEmail, type EmailSendResult } from "@/lib/email/send";
import {
  AssessmentCompletionEmail,
  CampaignInvitationEmail,
  CampaignReminderEmail,
  EmailChangeVerificationEmail,
  IndividualReportEmail,
  PasswordChangedEmail,
  ReportReadyEmail,
  TeamCampaignCompletedEmail,
  TeamInvitationEmail,
  WelcomeEmail,
  WellbeingReportReadyEmail,
} from "@/emails/templates";
import { buildJoinUrl, getPublicBaseUrl } from "@/lib/utils/site-url";

const siteUrl = () => getPublicBaseUrl().url;

export async function sendWelcome(to: string, profileId: string, name: string) {
  await sendEmail({
    to,
    profileId,
    template: "welcome",
    subject: "Welcome to DISC360",
    category: "essential",
    react: <WelcomeEmail name={name} appUrl={`${siteUrl()}/app`} />,
  });
}

export async function sendTeamInvitation(options: {
  to: string;
  teamName: string;
  inviterName: string;
  token: string;
  message?: string;
}) {
  await sendEmail({
    to: options.to,
    profileId: null,
    template: "team_invitation",
    subject: `${options.inviterName} invited you to ${options.teamName} on DISC360`,
    category: "essential",
    react: (
      <TeamInvitationEmail
        teamName={options.teamName}
        inviterName={options.inviterName}
        message={options.message}
        joinUrl={buildJoinUrl(getPublicBaseUrl(), options.token)}
      />
    ),
  });
}

export async function sendCampaignInvitation(options: {
  to: string;
  profileId: string | null;
  teamName: string;
  campaignName: string;
  message?: string;
  deadline?: string;
}) {
  await sendEmail({
    to: options.to,
    profileId: options.profileId,
    template: "campaign_invitation",
    subject: `${options.teamName}: please complete your DISC360 assessment`,
    category: "team_updates",
    react: (
      <CampaignInvitationEmail
        teamName={options.teamName}
        campaignName={options.campaignName}
        message={options.message}
        deadline={options.deadline}
        startUrl={`${siteUrl()}/app/assessments`}
      />
    ),
  });
}

export async function sendCampaignReminder(options: {
  to: string;
  profileId: string | null;
  teamName: string;
  deadline?: string;
}) {
  await sendEmail({
    to: options.to,
    profileId: options.profileId,
    template: "campaign_reminder",
    subject: "A gentle reminder: your DISC360 assessment is open",
    category: "assessment_reminders",
    react: (
      <CampaignReminderEmail
        teamName={options.teamName}
        deadline={options.deadline}
        startUrl={`${siteUrl()}/app/assessments`}
      />
    ),
  });
}

export async function sendAssessmentCompletion(options: {
  to: string;
  profileId: string;
  name: string;
  resultId: string;
}) {
  await sendEmail({
    to: options.to,
    profileId: options.profileId,
    template: "assessment_completion",
    subject: "Your DISC360 assessment is complete",
    category: "report_notifications",
    react: (
      <AssessmentCompletionEmail
        name={options.name}
        reportUrl={`${siteUrl()}/app/results/${options.resultId}`}
      />
    ),
  });
}

export async function sendReportReady(options: {
  to: string;
  profileId: string;
  archetypeName: string;
  resultId: string;
}) {
  await sendEmail({
    to: options.to,
    profileId: options.profileId,
    template: "report_ready",
    subject: `Your DISC360 profile: ${options.archetypeName}`,
    category: "report_notifications",
    react: (
      <ReportReadyEmail
        archetypeName={options.archetypeName}
        reportUrl={`${siteUrl()}/app/results/${options.resultId}`}
      />
    ),
  });
}

/**
 * A participant asking for their own report, PDF attached.
 *
 * `essential` on purpose: this is not a broadcast the recipient may have
 * muted, it is a request they just made about themselves — silently dropping
 * it on a notification preference would look exactly like a bug. The result is
 * returned so the caller can report what actually happened.
 */
export async function sendIndividualReport(options: {
  to: string;
  profileId: string;
  firstName: string;
  reportPath: string;
  attachment: { filename: string; content: string };
}): Promise<EmailSendResult> {
  return sendEmail({
    to: options.to,
    profileId: options.profileId,
    template: "individual_report",
    subject: "Your DISC360 Report Is Ready",
    category: "essential",
    react: (
      <IndividualReportEmail
        firstName={options.firstName}
        reportUrl={`${siteUrl()}${options.reportPath}`}
      />
    ),
    attachments: [
      {
        filename: options.attachment.filename,
        content: options.attachment.content,
        contentType: "application/pdf",
      },
    ],
  });
}

/**
 * Proof-of-control for a new sign-in address, sent to that address alone.
 * `essential`: an account-security message is not a preference. The result is
 * returned so an administrator is never told a link went out that did not.
 */
export async function sendEmailChangeVerification(options: {
  to: string;
  profileId: string;
  firstName: string;
  verifyUrl: string;
}): Promise<EmailSendResult> {
  return sendEmail({
    to: options.to,
    profileId: options.profileId,
    template: "email_change_verification",
    subject: "Confirm your new DISC360 sign-in email",
    category: "essential",
    react: (
      <EmailChangeVerificationEmail
        firstName={options.firstName}
        verifyUrl={options.verifyUrl}
      />
    ),
  });
}

export async function sendTeamCampaignCompleted(options: {
  to: string;
  profileId: string | null;
  teamId: string;
  teamName: string;
  campaignName: string;
  completed: number;
  total: number;
}) {
  await sendEmail({
    to: options.to,
    profileId: options.profileId,
    template: "team_campaign_completed",
    subject: `${options.campaignName} is complete — the team map is ready`,
    category: "team_updates",
    react: (
      <TeamCampaignCompletedEmail
        teamName={options.teamName}
        campaignName={options.campaignName}
        completed={options.completed}
        total={options.total}
        resultsUrl={`${siteUrl()}/app/teams/${options.teamId}/results`}
      />
    ),
  });
}

export async function sendPasswordChanged(to: string, profileId: string) {
  await sendEmail({
    to,
    profileId,
    template: "password_changed",
    subject: "Your DISC360 password was changed",
    category: "essential",
    react: <PasswordChangedEmail supportEmail="hello@disc360.app" />,
  });
}

/**
 * Wellbeing Pulse — the opt-in report notice.
 *
 * `essential` because the participant explicitly asked for this specific
 * message about their own report; it is not a product notification they may
 * have muted. The subject deliberately names the product and nothing else: no
 * score, ever, in a subject line.
 *
 * The result is returned so the caller can tell the participant the truth. A
 * message that was only logged (no provider configured, or a real recipient
 * outside production) is a failure from the person's point of view.
 */
export async function sendWellbeingReportReady(options: {
  to: string;
  profileId: string;
  firstName: string;
  reportPath: string;
}): Promise<EmailSendResult> {
  return sendEmail({
    to: options.to,
    profileId: options.profileId,
    template: "wellbeing_report_ready",
    subject: "Your Wellbeing Pulse report is ready",
    category: "essential",
    react: (
      <WellbeingReportReadyEmail
        firstName={options.firstName}
        reportUrl={`${siteUrl()}${options.reportPath}`}
      />
    ),
  });
}
