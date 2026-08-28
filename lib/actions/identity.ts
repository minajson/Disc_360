"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import { sendEmailChangeVerification } from "@/lib/email/notifications";
import { findProfileByEmail } from "@/lib/identity/queries";
import { isValidEmail, normalizeEmail } from "@/lib/identity/model";

/**
 * Platform-admin identity operations.
 *
 * Every action here starts with `requireSuperAdmin()`, and every SQL function
 * it calls independently re-checks that the actor holds platform scope. A team
 * facilitator — `is_team_admin`, an entirely different predicate — reaches
 * none of it, and no membership role grants platform scope.
 *
 * There is deliberately no code path that merges two identities from a name,
 * a shared domain, an organisation or a similarity score. Reconciliation takes
 * two explicitly-named profile ids and a typed confirmation, or it does not
 * happen.
 */

export interface IdentityActionResult {
  ok: boolean;
  message: string;
  /** Set when the operation opened a reconciliation record. */
  reconciliationId?: string;
  /**
   * The IRREVERSIBLE half is done: records have been merged in the database.
   *
   * ───────────────────────────────────────────────────────────────────
   * WHY THIS IS NOT DERIVABLE FROM `ok`.
   *
   * A reconciliation has two halves — the database merge, then the auth email
   * swap — and the second can fail after the first has succeeded. That returns
   * `ok: false` with a message explaining the records ARE merged and only the
   * sign-in address needs retrying.
   *
   * A caller reading `ok` alone therefore cannot tell "nothing happened, try
   * again" from "the merge is permanent, do not run it again". The only other
   * way to tell them apart is matching the message text, which is a sentence
   * written for a person and not a contract.
   *
   * So the fact is returned as a fact. `ReconcilePanel` uses it to refuse a
   * second submission once the merge has landed.
   * ───────────────────────────────────────────────────────────────────
   */
  recordsMerged?: boolean;
}

const TOMBSTONE_DOMAIN = "identity.disc360.invalid";

/* ── change sign-in email ─────────────────────────────────────────── */

const changeEmailSchema = z
  .object({
    profileId: z.uuid(),
    newEmail: z.string().trim().max(254),
    confirmEmail: z.string().trim().max(254),
  })
  .refine((value) => normalizeEmail(value.newEmail) === normalizeEmail(value.confirmEmail), {
    message: "The two addresses do not match.",
    path: ["confirmEmail"],
  });

/**
 * Move a participant to a new address that nobody has used before.
 *
 * Policy A: nobody has proven control of an unseen address, so the auth email
 * is NOT changed here. A verification link is generated and mailed to the new
 * address; `auth.users.email` moves only when it is clicked, and the trigger
 * from 00022 then syncs `profiles.email` and the alias history.
 *
 * If the link is never followed the participant simply keeps their current
 * login — a safe resting state, and the reason this flow can be offered
 * without risking locking anyone out.
 */
export async function changeSignInEmail(
  input: z.infer<typeof changeEmailSchema>,
): Promise<IdentityActionResult> {
  const parsed = changeEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." };
  }
  const { user } = await requireSuperAdmin();
  const newEmail = normalizeEmail(parsed.data.newEmail);

  if (!isValidEmail(newEmail)) {
    return { ok: false, message: "That is not a deliverable email address." };
  }
  if (newEmail.endsWith(`@${TOMBSTONE_DOMAIN}`)) {
    return { ok: false, message: "That address is reserved for retired identities." };
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, full_name, preferred_name, deactivated_at")
    .eq("id", parsed.data.profileId)
    .maybeSingle();
  if (!profile) return { ok: false, message: "Participant not found." };
  if (normalizeEmail(profile.email) === newEmail) {
    return { ok: false, message: "That is already this participant's sign-in email." };
  }

  // Occupied addresses are a reconciliation, not a rename. Say so rather than
  // silently overwriting somebody else's identity.
  const occupant = await findProfileByEmail(newEmail);
  if (occupant && occupant.profileId !== profile.id) {
    return {
      ok: false,
      message: `${newEmail} already belongs to an account (${occupant.fullName}). Use Reconcile identity if this is the same person.`,
    };
  }

  const link = await admin.auth.admin.generateLink({
    type: "email_change_new",
    email: profile.email,
    newEmail,
  });
  if (link.error || !link.data?.properties?.action_link) {
    return {
      ok: false,
      message: "Could not generate a verification link — the change was not applied.",
    };
  }

  const delivery = await sendEmailChangeVerification({
    to: newEmail,
    profileId: profile.id,
    firstName: profile.preferred_name || profile.full_name || "there",
    verifyUrl: link.data.properties.action_link,
  });
  if (delivery.status !== "sent") {
    return {
      ok: false,
      message:
        "We generated the change but could not deliver the verification email. The sign-in address is unchanged.",
    };
  }

  const { data: reconciliationId } = await admin.rpc("admin_record_email_change", {
    p_actor: user.id,
    p_profile: profile.id,
    p_new_email: newEmail,
    p_status: "pending_auth",
  });

  revalidatePath(`/admin/users/${profile.id}/identity`);
  return {
    ok: true,
    message: `Verification sent to ${newEmail}. The sign-in address changes when the participant confirms it.`,
    reconciliationId: (reconciliationId as string | null) ?? undefined,
  };
}

/* ── link an existing login ───────────────────────────────────────── */

export interface LinkLoginResult extends IdentityActionResult {
  /** The profile that owns the address, when one does. */
  profileId?: string;
  fullName?: string;
}

/**
 * Locate the identity behind an address so the administrator can decide
 * whether it is the same person. This resolves; it never merges.
 */
export async function findLoginToLink(
  profileId: string,
  email: string,
): Promise<LinkLoginResult> {
  if (!z.uuid().safeParse(profileId).success) {
    return { ok: false, message: "Invalid participant." };
  }
  await requireSuperAdmin();
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const occupant = await findProfileByEmail(normalized);
  if (!occupant) {
    return {
      ok: false,
      message: `No account signs in with ${normalized}. Use Change sign-in email to move this participant to it.`,
    };
  }
  if (occupant.profileId === profileId) {
    return { ok: false, message: "That address already belongs to this participant." };
  }
  return {
    ok: true,
    message: `${normalized} belongs to ${occupant.fullName}. Review both identities before reconciling.`,
    profileId: occupant.profileId,
    fullName: occupant.fullName,
  };
}

/* ── reconcile ────────────────────────────────────────────────────── */

const reconcileSchema = z.object({
  canonicalId: z.uuid(),
  retiringId: z.uuid(),
  /** The canonical account's current address, typed by the administrator. */
  confirmation: z.string().trim().max(254),
  note: z.string().trim().max(500).optional(),
});

/**
 * Reconcile a duplicate identity into a canonical one.
 *
 * Ordering, and why it is not negotiable:
 *
 *   1. the SQL transaction re-parents every row, resolves conflicts and
 *      asserts conservation — it either fully succeeds or fully rolls back;
 *   2. only then do the Auth mutations run, which cannot join that
 *      transaction.
 *
 * If step 2 fails the record stays `pending_auth`: the canonical identity
 * already owns everything and still signs in with its existing address. The
 * failure mode is a stale login, never inaccessible history — which is the
 * whole reason the database side goes first.
 *
 * Policy B applies to the email swap: the participant has already
 * authenticated with the incoming address, so control is proven and no second
 * confirmation click is required.
 */
export async function reconcileIdentity(
  input: z.infer<typeof reconcileSchema>,
): Promise<IdentityActionResult> {
  const parsed = reconcileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { user } = await requireSuperAdmin();
  const { canonicalId, retiringId, confirmation, note } = parsed.data;

  if (canonicalId === retiringId) {
    return { ok: false, message: "Choose two different identities." };
  }

  const admin = createSupabaseAdminClient();
  const { data: canonical } = await admin
    .from("profiles")
    .select("id, email")
    .eq("id", canonicalId)
    .maybeSingle();
  const { data: retiring } = await admin
    .from("profiles")
    .select("id, email")
    .eq("id", retiringId)
    .maybeSingle();
  if (!canonical || !retiring) return { ok: false, message: "Both identities must exist." };

  // Typed confirmation. A misclick must not be able to merge two people.
  if (normalizeEmail(confirmation) !== normalizeEmail(canonical.email)) {
    return {
      ok: false,
      message: "The typed address does not match the surviving identity. Nothing was changed.",
    };
  }

  const newEmail = retiring.email;

  // ── 1 · the atomic database side ──
  const { data: outcome, error: reconcileError } = await admin.rpc("admin_reconcile_identity", {
    p_actor: user.id,
    p_canonical: canonicalId,
    p_retiring: retiringId,
    p_note: note,
  });
  if (reconcileError || !outcome) {
    return {
      ok: false,
      message: reconcileError?.message
        ? `Reconciliation refused: ${reconcileError.message}`
        : "Reconciliation could not be completed. Nothing was changed.",
    };
  }
  const reconciliationId = (outcome as { reconciliation_id: string }).reconciliation_id;

  // ── 2 · Auth. Free the address first, then assign it ──
  const tombstone = `retired+${retiringId}@${TOMBSTONE_DOMAIN}`;
  const freed = await admin.auth.admin.updateUserById(retiringId, {
    email: tombstone,
    email_confirm: true,
  });
  if (freed.error) {
    await admin.rpc("admin_complete_reconciliation", {
      p_actor: user.id,
      p_reconciliation: reconciliationId,
      p_status: "pending_auth",
      p_note: `Auth step incomplete: ${freed.error.message}`,
    });
    return {
      ok: false,
      message:
        "Records were merged successfully, but the duplicate login could not be retired. The participant can still sign in with their existing address — retry the authentication step.",
      reconciliationId,
      recordsMerged: true,
    };
  }

  const moved = await admin.auth.admin.updateUserById(canonicalId, {
    email: newEmail,
    email_confirm: true,
  });
  if (moved.error) {
    await admin.rpc("admin_complete_reconciliation", {
      p_actor: user.id,
      p_reconciliation: reconciliationId,
      p_status: "pending_auth",
      p_note: `Auth step incomplete: ${moved.error.message}`,
    });
    return {
      ok: false,
      message:
        "Records were merged successfully, but the new sign-in address could not be applied. The participant can still sign in with their previous address — retry the authentication step.",
      reconciliationId,
      recordsMerged: true,
    };
  }

  await admin.rpc("admin_complete_reconciliation", {
    p_actor: user.id,
    p_reconciliation: reconciliationId,
    p_status: "completed",
    p_note: undefined,
  });

  /*
   * The identity page is deliberately NOT revalidated here.
   *
   * ───────────────────────────────────────────────────────────────────
   * WHY REVALIDATING IT DESTROYS THE CONFIRMATION.
   *
   * `revalidatePath` on the route the operator is currently looking at makes
   * Next re-render it as part of this action's response. After the merge, the
   * retiring identity is deactivated, so `getReconciliationPreflight` returns
   * null and the page no longer renders `ReconcilePanel` at all.
   *
   * The panel is where the confirmation lives. So revalidating here unmounts
   * the operator's only evidence that an irreversible merge succeeded — the
   * same failure as the `router.push` race it replaced, arriving by a
   * different route. The confirmation would flash and vanish.
   *
   * Freshness is not lost, it moves: the operator's acknowledgement navigates
   * AND refreshes, so the destination they land on is server-rendered after
   * the merge. The user list is revalidated here because nobody is looking at
   * it and it must not show a retired duplicate.
   * ───────────────────────────────────────────────────────────────────
   */
  revalidatePath("/admin/users");
  return {
    ok: true,
    message: `Identity reconciled. ${newEmail} now signs in to the canonical participant.`,
    reconciliationId,
    recordsMerged: true,
  };
}

/**
 * Retry only the authentication half of a reconciliation whose database side
 * already completed. Safe to call repeatedly: the data is already consistent.
 */
export async function retryReconciliationAuth(
  reconciliationId: string,
): Promise<IdentityActionResult> {
  if (!z.uuid().safeParse(reconciliationId).success) {
    return { ok: false, message: "Invalid reconciliation." };
  }
  const { user } = await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const { data: record } = await admin
    .from("identity_reconciliations")
    .select("id, canonical_profile_id, retired_profile_id, new_email, status, action")
    .eq("id", reconciliationId)
    .maybeSingle();
  if (!record || record.action !== "reconcile") {
    return { ok: false, message: "Reconciliation not found." };
  }
  if (record.status === "completed") {
    return { ok: true, message: "This reconciliation is already complete." };
  }
  if (!record.retired_profile_id || !record.new_email) {
    return { ok: false, message: "This record is missing the addresses needed to retry." };
  }

  const tombstone = `retired+${record.retired_profile_id}@${TOMBSTONE_DOMAIN}`;
  const freed = await admin.auth.admin.updateUserById(record.retired_profile_id, {
    email: tombstone,
    email_confirm: true,
  });
  // Already tombstoned from a previous attempt is success, not failure.
  if (freed.error && !freed.error.message.toLowerCase().includes("already")) {
    return { ok: false, message: `Could not retire the duplicate login: ${freed.error.message}` };
  }

  const moved = await admin.auth.admin.updateUserById(record.canonical_profile_id, {
    email: record.new_email,
    email_confirm: true,
  });
  if (moved.error) {
    return { ok: false, message: `Could not apply the new address: ${moved.error.message}` };
  }

  await admin.rpc("admin_complete_reconciliation", {
    p_actor: user.id,
    p_reconciliation: reconciliationId,
    p_status: "completed",
    p_note: undefined,
  });
  revalidatePath(`/admin/users/${record.canonical_profile_id}/identity`);
  return { ok: true, message: "Authentication step completed." };
}
