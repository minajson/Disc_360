import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The confirmation contract for an irreversible reconciliation.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT WENT WRONG, AND WHY A TEST HAD TO EXIST FOR IT.
 *
 * `ReconcilePanel.submit()` called `setResult(outcome)` and then
 * `router.push(...)` inside one `startTransition`. React commits both together,
 * so the panel unmounted before the success message painted: an administrator
 * who had just merged two people's records permanently was navigated away
 * without being told whether it had worked.
 *
 * It surfaced as an INTERMITTENT test failure on a reconciliation that had in
 * fact SUCCEEDED — which is why it survived. A red test that points at the
 * wrong thing gets re-run, not read.
 *
 * The rule now is: the mutation returns, the outcome renders, and navigation
 * happens only when the operator dismisses it. These tests hold that shape in
 * place. They read source because the panel is a client component and the
 * action needs a database; the browser-level proof that the confirmation is
 * reached and navigation waits for it is in
 * `e2e/identity-reconciliation.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────
 */

const ROOT = new URL("../../", import.meta.url);
/** Source with comments stripped — a comment describing a rule is not the rule. */
const code = (path: string) =>
  readFileSync(new URL(path, ROOT), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");

const PANEL = "components/admin/identity/ReconcilePanel.tsx";
const ACTION = "lib/actions/identity.ts";

/* ── 1 · the action states whether the irreversible half happened ────── */

test("every post-merge return marks the records as merged", () => {
  const action = code(ACTION);

  // The database merge is one RPC. Everything returned after it — success and
  // both partial-auth failures — must say the merge landed.
  const merged = action.match(/recordsMerged:\s*true/g) ?? [];
  assert.equal(
    merged.length,
    3,
    "expected the success path and BOTH pending_auth paths to set recordsMerged",
  );

  // The two partial failures are `ok: false` yet permanent. That combination is
  // the whole reason the flag exists.
  assert.match(
    action,
    /Records were merged successfully, but the duplicate login could not be retired[\s\S]{0,400}?recordsMerged: true/,
    "the retire-login failure merged records and must say so",
  );
  assert.match(
    action,
    /Records were merged successfully, but the new sign-in address could not be applied[\s\S]{0,400}?recordsMerged: true/,
    "the address-swap failure merged records and must say so",
  );
});

test("a refusal that changed nothing does NOT claim the records were merged", () => {
  const action = code(ACTION);
  assert.match(
    action,
    /Reconciliation could not be completed\. Nothing was changed\.[\s\S]{0,200}?\}/,
    "the refusal path must remain free of recordsMerged",
  );
  const refusal = action.slice(
    action.indexOf("Reconciliation could not be completed"),
    action.indexOf("Reconciliation could not be completed") + 200,
  );
  assert.ok(
    !refusal.includes("recordsMerged"),
    "nothing was changed, so the panel must stay retryable",
  );
});

/* ── 2 · the panel neither navigates nor owns the confirmation ───────── */

const CONFIRMATION = "components/admin/identity/ReconciliationConfirmation.tsx";
const PAGE = "app/admin/users/[userId]/identity/page.tsx";

test("the mutation transition performs no navigation and no waiting", () => {
  const panel = code(PANEL);
  const start = panel.indexOf("const submit =");
  assert.ok(start > -1, "submit() must exist");
  const submit = panel.slice(start, start + 700);

  assert.ok(
    !submit.includes("router.push"),
    "navigating inside the mutation transition unmounts the confirmation",
  );
  assert.ok(
    !/setTimeout|setInterval|await new Promise/.test(submit),
    "the contract must not be satisfied by waiting; no duration means 'seen'",
  );
  assert.match(submit, /setResult\(outcome\)/, "the outcome is recorded, and only recorded");
});

test("the panel navigates nowhere at all", () => {
  const panel = code(PANEL);
  assert.equal(
    (panel.match(/router\.(push|replace|refresh)\(/g) ?? []).length,
    0,
    "navigation belongs to the server-rendered confirmation's own link",
  );
});

test("the confirmation is server-rendered from the durable record", () => {
  const confirmation = code(CONFIRMATION);

  // Not a client component: it must survive the Server Action's re-render of
  // the route, which is what destroyed every client-held version of this.
  assert.ok(
    !confirmation.includes('"use client"'),
    "a client component cannot outlive its server parent deciding not to render it",
  );
  assert.match(confirmation, /entry\.status === "completed"/);
  assert.match(confirmation, /entry\.id/, "the audit record is shown");
  assert.match(confirmation, /role="status"/);
  assert.match(confirmation, /aria-label="Reconciliation outcome"/);
  assert.match(confirmation, /Continue to the surviving identity/);

  // `pending_auth` is a merged reconciliation with an outstanding auth step.
  // It must never read as a failure — there is nothing to undo.
  assert.match(confirmation, /Records merged/);
});

test("the page renders the confirmation exactly when the merge has landed", () => {
  const page = code(PAGE);
  assert.match(page, /ReconciliationConfirmation/, "the page must render it");
  // Shown when a counterpart was named but no longer reconcilable — precisely
  // the post-merge state the Server Action re-render lands in.
  assert.match(page, /counterpartId && !context/);
  assert.match(page, /entry\.retiredProfileId === counterpartId/);
  assert.match(page, /entry\.status === "completed" \|\| entry\.status === "pending_auth"/);
});

test("leaving the confirmation is a plain server-rendered link", () => {
  const confirmation = code(CONFIRMATION);
  // A link, not a click handler: no client state, works with the keyboard and
  // middle-click, and cannot race anything.
  assert.match(confirmation, /<Link\s+href=\{continueHref\}/);
  assert.ok(
    !confirmation.includes("useRouter"),
    "the confirmation must not depend on client navigation",
  );
});

/* ── 3 · a landed merge is never offered twice ───────────────────────── */

test("submission is refused once the merge has landed", () => {
  const panel = code(PANEL);
  assert.match(
    panel,
    /const settled = result\?\.recordsMerged === true/,
    "the terminal state must be derived from the action's fact, not from message text",
  );
  const submit = panel.slice(panel.indexOf("const submit ="), panel.indexOf("const submit =") + 700);
  assert.match(submit, /if \(settled\) return/, "a permanent merge must not be re-runnable");
  assert.match(
    panel,
    /step === "confirm" && !settled/,
    "the confirm form must disappear once the merge is permanent",
  );
});

test("only a non-merged failure is reported by the panel itself", () => {
  const panel = code(PANEL);
  assert.match(
    panel,
    /\{result && !settled \? \(/,
    "a merged reconciliation is confirmed by the server, not by leftover panel state",
  );
});

/* ── 4 · nothing re-renders the page the confirmation lives on ───────── */

test("the action does not revalidate the route hosting the confirmation", () => {
  const action = code(ACTION);
  const start = action.indexOf("export async function reconcileIdentity");
  const body = action.slice(start, action.indexOf("export ", start + 40));

  /*
   * The second way this confirmation was destroyed.
   *
   * `revalidatePath("/admin/users/<id>/identity")` makes Next re-render the
   * operator's current route as part of the action's response. After the merge
   * the retiring identity is deactivated, `getReconciliationPreflight` returns
   * null, and the page stops rendering `ReconcilePanel` — taking the
   * confirmation with it. It flashed and vanished, exactly like the
   * `router.push` race it had replaced.
   */
  assert.ok(
    !/revalidatePath\(\s*`\/admin\/users\/\$\{[^}]+\}\/identity`\s*\)/.test(body),
    "revalidating the identity page unmounts the panel holding the confirmation",
  );
  // The list is a different route, nobody is looking at it, and it must not
  // keep showing a retired duplicate.
  assert.match(body, /revalidatePath\("\/admin\/users"\)/, "the user list must still refresh");
});
