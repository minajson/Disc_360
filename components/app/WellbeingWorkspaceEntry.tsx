import Link from "next/link";
import type { AuthContext } from "@/lib/auth/guards";
import { WELLBEING_PRODUCT_NAME } from "@/data/wellbeing-content";
import { PulseGlyph } from "@/components/wellbeing/PulseChrome";

/**
 * The doorway from DISC360 into Wellbeing Pulse.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT ANOTHER ASSESSMENT CARD.
 *
 * DISC, Focus and Combined are three assessments inside one product: same
 * navigation, same team dashboard, same idea of a result. Wellbeing Pulse is
 * a different PRODUCT on the same platform — its own shell, its own privacy
 * model, its own governance, and results that nobody but the participant can
 * ever see.
 *
 * Presented as a fourth assessment card it would inherit every expectation the
 * other three set: that a facilitator can see who scored what, that a team
 * dashboard compares members, that a result is something to discuss in a
 * session. Every one of those is false here, and the first two are the exact
 * failures this product must never have. So it is set apart deliberately — its
 * own mark, its own colour, its own row — and the copy says "workspace", not
 * "assessment".
 *
 * WHO SEES IT.
 *
 * Only people with a reason: a wellbeing role, membership of a wellbeing
 * campaign, or platform administration. It renders nothing for anybody else,
 * rather than advertising a workspace they cannot open. That is presentation,
 * not protection — every wellbeing surface authorises independently on the
 * server, so hiding this card is courtesy and the guards are the security.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function WellbeingWorkspaceEntry({ context }: { context: AuthContext }) {
  const { supabase, user, profile } = context;

  const [{ data: role }, { data: campaign }] = await Promise.all([
    supabase
      .from("wellbeing_role_grants")
      .select("id")
      .eq("profile_id", user.id)
      .is("revoked_at", null)
      .limit(1)
      .maybeSingle(),
    // Membership of a wellbeing campaign, read through the caller's own client
    // so it is their own membership row that decides.
    supabase
      .from("team_members")
      .select("role, teams!inner (id, assessment_type, archived_at)")
      .eq("profile_id", user.id)
      .eq("teams.assessment_type", "wellbeing")
      .is("teams.archived_at", null)
      .limit(1)
      .maybeSingle(),
  ]);

  const isAdmin = profile.is_super_admin;
  if (!role && !campaign && !isAdmin) return null;

  const facilitates =
    Boolean(role) || isAdmin || (campaign?.role as string | undefined) === "team_admin";

  // A facilitator lands on the campaigns they run; a participant lands on the
  // participant home, which is the only wellbeing surface that is theirs.
  const href = facilitates ? "/wellbeing/admin/pilot" : "/wellbeing";

  return (
    <section
      aria-labelledby="wellbeing-workspace-heading"
      className="flex flex-col gap-5 rounded-2xl border border-[rgba(31,78,95,0.2)] bg-pulse-mist p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-7"
    >
      {/* The glyph alone — the heading below already names the product. */}
      <PulseGlyph className="text-pulse sm:h-9 sm:w-9" />

      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="font-mono text-[10px] tracking-[0.18em] text-pulse-teal uppercase">
          Separate workspace
        </p>
        <h2
          id="wellbeing-workspace-heading"
          className="font-display text-lg font-semibold text-ink"
        >
          {WELLBEING_PRODUCT_NAME}
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-slate">
          Organisational wellbeing measurement, trends and protected cohort insights.
          {facilitates
            ? " Individual results stay private to the participant — this workspace reports groups only."
            : " Your answers and your score are private to you."}
        </p>
      </div>

      <Link
        href={href}
        className="pulse-focus shrink-0 self-start rounded-full bg-pulse-deep px-5 py-2.5 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-ink sm:ml-auto sm:self-center"
      >
        Open Wellbeing
      </Link>
    </section>
  );
}
