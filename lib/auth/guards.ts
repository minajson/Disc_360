import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/db/server";

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  preferred_name: string;
  profession: string | null;
  country: string | null;
  timezone: string | null;
  is_super_admin: boolean;
  onboarding_intent: string | null;
  consented_at: string | null;
  onboarded_at: string | null;
  deactivated_at: string | null;
}

export interface AuthContext {
  supabase: SupabaseClient;
  user: User;
  profile: ProfileRow;
}

/** Signed-in user or redirect to /sign-in. */
export async function requireUser(): Promise<AuthContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, preferred_name, profession, country, timezone, is_super_admin, onboarding_intent, consented_at, onboarded_at, deactivated_at",
    )
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/sign-in");
  if (profile.deactivated_at) {
    await supabase.auth.signOut();
    redirect("/sign-in?error=deactivated");
  }
  return { supabase, user, profile: profile as ProfileRow };
}

/** Platform owner scope. All admin-area data access happens after this. */
export async function requireSuperAdmin(): Promise<AuthContext> {
  const context = await requireOnboarded();
  if (!context.profile.is_super_admin) redirect("/app");
  return context;
}

/** Signed-in AND onboarded, or redirect into onboarding. */
export async function requireOnboarded(): Promise<AuthContext> {
  const context = await requireUser();
  if (!context.profile.onboarded_at) redirect("/onboarding");
  return context;
}

/**
 * Team admin scope (direct team_admin role, or org admin/coach of the
 * owning organization). Server-side check — never trust client ids.
 */
export async function requireTeamAdmin(teamId: string): Promise<AuthContext> {
  const context = await requireOnboarded();
  const { data: isAdmin } = await context.supabase.rpc("is_team_admin", {
    team: teamId,
  });
  if (!isAdmin) redirect("/app/teams");
  return context;
}

/** Team member OR admin scope. */
export async function requireTeamAccess(teamId: string): Promise<AuthContext> {
  const context = await requireOnboarded();
  const [{ data: isMember }, { data: isAdmin }] = await Promise.all([
    context.supabase.rpc("is_team_member", { team: teamId }),
    context.supabase.rpc("is_team_admin", { team: teamId }),
  ]);
  if (!isMember && !isAdmin) redirect("/app/teams");
  return context;
}
