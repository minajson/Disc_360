import type { Metadata } from "next";
import { requireOnboarded } from "@/lib/auth/guards";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ProfileSettingsForm } from "@/components/app/ProfileSettingsForm";
import { NotificationPrefsForm } from "@/components/app/NotificationPrefsForm";
import { PrivacyControls } from "@/components/app/PrivacyControls";

export const metadata: Metadata = { title: "Settings" };

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function SettingsPage() {
  const { supabase, user, profile } = await requireOnboarded();

  const [{ data: prefs }, { data: notifications }, { data: profileRow }] =
    await Promise.all([
      supabase
        .from("notification_preferences")
        .select("assessment_reminders, team_updates, report_notifications, product_updates")
        .eq("profile_id", user.id)
        .maybeSingle(),
      supabase
        .from("notification_logs")
        .select("id, template, subject, status, created_at")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("profiles")
        .select("deletion_requested_at")
        .eq("id", user.id)
        .single(),
    ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-12 sm:px-8">
      <div className="flex flex-col gap-2">
        <Eyebrow>Settings</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">Your account</h1>
        <p className="text-sm text-slate">
          Signed in as <span className="font-medium text-ink">{profile.email}</span>
        </p>
      </div>

      <ProfileSettingsForm profile={profile} />

      <NotificationPrefsForm
        prefs={
          prefs ?? {
            assessment_reminders: true,
            team_updates: true,
            report_notifications: true,
            product_updates: false,
          }
        }
      />

      <PrivacyControls
        deletionRequestedAt={profileRow?.deletion_requested_at ?? null}
      />

      {(notifications ?? []).length > 0 ? (
        <section aria-label="Recent notifications" className="paper-card flex flex-col gap-4 p-7">
          <h2 className="font-display text-base font-semibold">Recent notifications</h2>
          <ul className="flex flex-col gap-2">
            {(notifications ?? []).map((log) => (
              <li key={log.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="text-sm text-ink">{log.subject}</span>
                <span className="font-mono text-[11px] text-faint">
                  {log.status} · {formatDateTime(log.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
