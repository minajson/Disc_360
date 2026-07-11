import { EmailShell, EmailText } from "@/emails/components";

/**
 * The ten transactional templates. Account verification and password reset
 * links are delivered by Supabase Auth's mailer; the templates here cover
 * product notifications (and a verification/confirmation pair kept reusable
 * for custom-SMTP setups).
 */

export function AccountVerificationEmail({ verifyUrl }: { verifyUrl: string }) {
  return (
    <EmailShell
      preview="Confirm your DISC360 account"
      heading="Confirm your email"
      cta={{ href: verifyUrl, label: "Verify my account" }}
      footerNote="If you didn't create a DISC360 account, you can ignore this email."
    >
      <EmailText>
        One click and your account is live — your profile, reports and teams
        are waiting on the other side.
      </EmailText>
    </EmailShell>
  );
}

export function WelcomeEmail({ name, appUrl }: { name: string; appUrl: string }) {
  return (
    <EmailShell
      preview="Welcome to DISC360"
      heading={`Welcome, ${name}.`}
      cta={{ href: appUrl, label: "Open your dashboard" }}
    >
      <EmailText>
        Your account is ready. The assessment takes about seven minutes — 24
        honest choices, autosaved as you go — and ends in a working profile of
        how you lead, communicate and respond under pressure.
      </EmailText>
      <EmailText>
        No right answers. Go with your first instinct.
      </EmailText>
    </EmailShell>
  );
}

export function TeamInvitationEmail({
  teamName,
  inviterName,
  message,
  joinUrl,
}: {
  teamName: string;
  inviterName: string;
  message?: string;
  joinUrl: string;
}) {
  return (
    <EmailShell
      preview={`${inviterName} invited you to ${teamName} on DISC360`}
      heading={`Join ${teamName}`}
      cta={{ href: joinUrl, label: "Accept invitation" }}
      footerNote="If you weren't expecting this invitation, you can ignore it — it expires on its own."
    >
      <EmailText>
        {inviterName} invited you to join <strong>{teamName}</strong> on
        DISC360 — a short behavioral assessment that helps the team understand
        how everyone communicates and works.
      </EmailText>
      {message ? <EmailText>“{message}”</EmailText> : null}
      <EmailText>
        Your individual answers stay private; the team sees only what the
        team&rsquo;s visibility settings allow.
      </EmailText>
    </EmailShell>
  );
}

export function CampaignInvitationEmail({
  teamName,
  campaignName,
  message,
  deadline,
  startUrl,
}: {
  teamName: string;
  campaignName: string;
  message?: string;
  deadline?: string;
  startUrl: string;
}) {
  return (
    <EmailShell
      preview={`${teamName}: please complete your DISC360 assessment`}
      heading={campaignName}
      cta={{ href: startUrl, label: "Start the assessment" }}
    >
      <EmailText>
        Your team <strong>{teamName}</strong> is running a DISC360 assessment
        round. It takes about seven minutes and autosaves as you go.
      </EmailText>
      {message ? <EmailText>“{message}”</EmailText> : null}
      {deadline ? (
        <EmailText>
          Please complete it by <strong>{deadline}</strong>.
        </EmailText>
      ) : null}
    </EmailShell>
  );
}

export function CampaignReminderEmail({
  teamName,
  deadline,
  startUrl,
}: {
  teamName: string;
  deadline?: string;
  startUrl: string;
}) {
  return (
    <EmailShell
      preview="A gentle reminder from your team on DISC360"
      heading="Seven minutes, when you have them"
      cta={{ href: startUrl, label: "Continue the assessment" }}
    >
      <EmailText>
        A reminder from <strong>{teamName}</strong>: your DISC360 assessment
        is still open{deadline ? (
          <>
            {" "}
            until <strong>{deadline}</strong>
          </>
        ) : null}
        . Anything you&rsquo;ve already answered is saved.
      </EmailText>
    </EmailShell>
  );
}

export function AssessmentCompletionEmail({
  name,
  reportUrl,
}: {
  name: string;
  reportUrl: string;
}) {
  return (
    <EmailShell
      preview="Your DISC360 assessment is complete"
      heading={`Nice work, ${name}.`}
      cta={{ href: reportUrl, label: "Open your report" }}
    >
      <EmailText>
        Your assessment is complete and your profile has been computed. Your
        full report — communication, leadership, conflict, motivation and
        growth — is ready whenever you are.
      </EmailText>
    </EmailShell>
  );
}

export function ReportReadyEmail({
  archetypeName,
  reportUrl,
}: {
  archetypeName: string;
  reportUrl: string;
}) {
  return (
    <EmailShell
      preview={`Your DISC360 profile: ${archetypeName}`}
      heading={`Your profile is ready: ${archetypeName}`}
      cta={{ href: reportUrl, label: "Read your report" }}
    >
      <EmailText>
        Your behavioral profile has been computed as{" "}
        <strong>{archetypeName}</strong>. The report reads like guidance from a
        good coach — specific, humane and usable this week.
      </EmailText>
    </EmailShell>
  );
}

export function TeamCampaignCompletedEmail({
  teamName,
  campaignName,
  completed,
  total,
  resultsUrl,
}: {
  teamName: string;
  campaignName: string;
  completed: number;
  total: number;
  resultsUrl: string;
}) {
  return (
    <EmailShell
      preview={`${campaignName} is complete — the team map is ready`}
      heading="The team map is ready"
      cta={{ href: resultsUrl, label: "Open team intelligence" }}
    >
      <EmailText>
        <strong>{campaignName}</strong> for {teamName} has finished with{" "}
        {completed} of {total} profiles completed. Culture summary,
        communication gaps and the recommended action plan are ready — and
        presentation mode is built for your next team meeting.
      </EmailText>
    </EmailShell>
  );
}

export function PasswordChangedEmail({ supportEmail }: { supportEmail: string }) {
  return (
    <EmailShell
      preview="Your DISC360 password was changed"
      heading="Your password was changed"
      footerNote="This is an essential account notification and cannot be disabled."
    >
      <EmailText>
        Your DISC360 password was just changed. If this was you, no action is
        needed.
      </EmailText>
      <EmailText>
        If you didn&rsquo;t make this change, reset your password immediately
        and contact {supportEmail}.
      </EmailText>
    </EmailShell>
  );
}

export function AdminNotificationEmail({
  heading,
  body,
  actionUrl,
  actionLabel,
}: {
  heading: string;
  body: string;
  actionUrl: string;
  actionLabel: string;
}) {
  return (
    <EmailShell
      preview={heading}
      heading={heading}
      cta={{ href: actionUrl, label: actionLabel }}
    >
      <EmailText>{body}</EmailText>
    </EmailShell>
  );
}
