import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/guards";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { NewTeamForm } from "@/components/teams/NewTeamForm";

export const metadata: Metadata = { title: "New team" };

export default async function NewTeamPage() {
  const { supabase, user } = await requireOnboarded();

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organizations (id, name)")
    .eq("profile_id", user.id)
    .in("role", ["organization_admin", "coach"]);

  const organizations = (memberships ?? [])
    .map((row) => (Array.isArray(row.organizations) ? row.organizations[0] : row.organizations))
    .filter((org): org is { id: string; name: string } => Boolean(org));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-12 sm:px-8">
      <div className="flex flex-col gap-2">
        <Eyebrow>New team</Eyebrow>
        <h1 className="font-display text-h2 font-semibold">Create a team</h1>
      </div>

      {organizations.length > 0 ? (
        <NewTeamForm organizations={organizations} />
      ) : (
        <div className="paper-card flex flex-col items-start gap-3 p-8">
          <p className="max-w-md text-sm leading-relaxed text-slate">
            Creating teams requires an organization you administer. Your
            account isn&rsquo;t an organization admin yet — set one up from
            onboarding, or ask your organization&rsquo;s administrator to make
            you a team admin.
          </p>
          <Link href="/app/teams" className="text-sm font-medium text-botanical hover:underline">
            Back to teams →
          </Link>
        </div>
      )}
    </div>
  );
}
