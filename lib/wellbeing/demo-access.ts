import "server-only";
import { redirect } from "next/navigation";
import { requireOnboarded, type AuthContext } from "@/lib/auth/guards";
import { isProductionEnvironment, isWellbeingDemoEnabled } from "@/lib/wellbeing/environment";

/**
 * The management demo gate.
 *
 * Two independent conditions, both required:
 *
 *  1 · The environment permits it — non-production with the explicit
 *      WELLBEING_DEMO_MODE flag. Same rule the licensing gate uses, so demo
 *      surfaces cannot appear in production even by misconfiguration.
 *  2 · The person holds elevated scope — platform admin, or a wellbeing role.
 *      An ordinary participant reaching a demo URL is redirected, not shown a
 *      permission error, so the surface's existence is not advertised.
 *
 * These pages show NO participant data at all — only registry metadata,
 * content-free structure previews and hard-coded illustrative numbers — so the
 * gate is about keeping an internal evaluation tool internal, not about
 * protecting anyone's wellbeing data. There is none here to protect.
 */
export async function requireManagementDemo(): Promise<AuthContext> {
  const environmentAllows = !isProductionEnvironment() && isWellbeingDemoEnabled();
  if (!environmentAllows) redirect("/wellbeing");

  const context = await requireOnboarded();
  if (context.profile.is_super_admin) return context;

  const { data: role } = await context.supabase
    .from("wellbeing_role_grants")
    .select("id")
    .eq("profile_id", context.user.id)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();

  if (!role) redirect("/wellbeing");
  return context;
}

/** Whether to offer the demo entry point in navigation. */
export function managementDemoEnabled(): boolean {
  return !isProductionEnvironment() && isWellbeingDemoEnabled();
}

/**
 * The management-surface gate, for pages that carry no participant data but
 * are still not for participants.
 *
 * The instrument comparison is the case this exists for. It shows only
 * registry metadata — what each instrument measures, how long it takes, what
 * it produces, where its licensing stands — so it needs no wellbeing role and
 * no demo flag, and a facilitator choosing an instrument for a campaign must
 * be able to reach it in any environment.
 *
 * But "carries no participant data" is not the same as "is for participants".
 * A person completing a pulse has no business on a page that weighs GHQ-28
 * against WHO-5 on licensing grounds; showing it to them invites the belief
 * that they choose, when the campaign chooses. So the requirement is elevated
 * scope of SOME kind — platform admin, a wellbeing role, or admin rights on
 * any team — and, as everywhere else in this area, a redirect rather than a
 * permission error, so the surface is not advertised.
 */
export async function requireManagementSurface(): Promise<AuthContext> {
  const context = await requireOnboarded();
  if (context.profile.is_super_admin) return context;

  const { data: role } = await context.supabase
    .from("wellbeing_role_grants")
    .select("id")
    .eq("profile_id", context.user.id)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  if (role) return context;

  const { data: teamAdmin } = await context.supabase
    .from("team_members")
    .select("id")
    .eq("profile_id", context.user.id)
    .eq("role", "team_admin")
    .limit(1)
    .maybeSingle();
  if (teamAdmin) return context;

  redirect("/wellbeing");
}
