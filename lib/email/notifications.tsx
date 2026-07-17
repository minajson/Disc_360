import "server-only";
import { sendEmail } from "@/lib/email/send";
import {
  AssessmentCompletionEmail,
  CampaignInvitationEmail,
  CampaignReminderEmail,
  PasswordChangedEmail,
  ReportReadyEmail,
  TeamCampaignCompletedEmail,
  TeamInvitationEmail,
  WelcomeEmail,
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
