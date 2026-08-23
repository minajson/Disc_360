import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Report delivery safety.
 *
 * Source-level, for the same reason as the isolation suite: the requirements
 * here are absolutes ("never a score in a subject line", "never automatic"),
 * and an absolute is best defended by making the offending edit fail the
 * build rather than by exercising the current happy path.
 */

const ROOT = new URL("../../", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const ACTIONS = read("lib/actions/wellbeing.ts");
const TEMPLATES = read("emails/templates.tsx");
const NOTIFICATIONS = read("lib/email/notifications.tsx");
const ROUTE = read("app/api/wellbeing/report/[resultId]/route.ts");

/** The wellbeing send helper, isolated to the end of its declaration. */
function wellbeingSender(): string {
  const start = NOTIFICATIONS.indexOf("export async function sendWellbeingReportReady");
  assert.ok(start >= 0, "sendWellbeingReportReady must exist");
  const next = NOTIFICATIONS.indexOf("\nexport ", start + 1);
  return NOTIFICATIONS.slice(start, next === -1 ? undefined : next);
}

/** The wellbeing email template, isolated. */
function wellbeingTemplate(): string {
  const start = TEMPLATES.indexOf("export function WellbeingReportReadyEmail");
  assert.ok(start >= 0, "WellbeingReportReadyEmail must exist");
  return TEMPLATES.slice(start);
}

/* ── no score anywhere it could be seen ─────────────────────────────── */

test("the subject line names the product and carries no score", () => {
  const sender = wellbeingSender();
  const subject = /subject:\s*"([^"]+)"/.exec(sender)?.[1];
  assert.equal(subject, "Your Wellbeing Pulse report is ready");
  assert.ok(!/\d/.test(subject!), "a subject line must never contain a figure");
  assert.ok(!/score/i.test(subject!), "a subject line must never mention a score");
});

test("the subject line is a constant, not interpolated from result data", () => {
  const sender = wellbeingSender();
  assert.ok(
    !/subject:\s*[`$]/.test(sender),
    "an interpolated subject is how a score reaches an inbox preview",
  );
});

test("the email template receives no score and no item response", () => {
  const sender = wellbeingSender();
  const props = /<WellbeingReportReadyEmail([\s\S]*?)\/>/.exec(sender)?.[1] ?? "";
  for (const forbidden of ["score", "total", "threshold", "positions", "atOrAbove"]) {
    assert.ok(
      !new RegExp(forbidden, "i").test(props),
      `the email must not be passed ${forbidden}`,
    );
  }
  assert.match(props, /firstName/);
  assert.match(props, /reportUrl/);
});

test("the email body carries no score placeholder at all", () => {
  const template = wellbeingTemplate();
  assert.ok(!/\{\s*score/i.test(template));
  assert.ok(!/\{\s*total/i.test(template));
  assert.ok(!/out of 12/i.test(template));
});

test("the email links to an authenticated page, never a token URL", () => {
  const sender = wellbeingSender();
  assert.match(sender, /reportPath/, "the link is a path into the authenticated product");
  assert.ok(
    !/token/i.test(sender),
    "a tokenised link would make the message itself a credential",
  );
});

/* ── opt-in only ────────────────────────────────────────────────────── */

test("nothing sends a wellbeing report except the explicit action", () => {
  const senders = [...ACTIONS.matchAll(/sendWellbeingReportReady\(/g)];
  assert.equal(senders.length, 1, "exactly one call site");

  // …and that call site is inside emailMyWellbeingReport, not completion.
  const emailAction = ACTIONS.slice(ACTIONS.indexOf("export async function emailMyWellbeingReport"));
  assert.match(emailAction, /sendWellbeingReportReady\(/);

  const completion = ACTIONS.slice(
    ACTIONS.indexOf("export async function completeWellbeingPulse"),
    ACTIONS.indexOf("export async function startWellbeingPulseAction"),
  );
  assert.ok(
    !completion.includes("sendWellbeing"),
    "completing a pulse must never dispatch an email as a side effect",
  );
});

test("the recipient is resolved server-side from the account, not from input", () => {
  const emailAction = ACTIONS.slice(ACTIONS.indexOf("export async function emailMyWellbeingReport"));
  assert.match(emailAction, /report\.accountEmail/);
  assert.match(emailAction, /isDeliverableEmail\(recipient\)/);
  // The only parameter is a result id.
  assert.match(ACTIONS, /emailMyWellbeingReport\(\s*resultId: string,?\s*\)/);
});

/* ── honest reporting ───────────────────────────────────────────────── */

test("only a provider-accepted send is reported as sent", () => {
  const emailAction = ACTIONS.slice(ACTIONS.indexOf("export async function emailMyWellbeingReport"));
  assert.match(emailAction, /outcome\.status === "sent"/);
  assert.match(emailAction, /status: "not_delivered"/);
  // A merely-logged message must not fall into the success branch.
  const successBranch = emailAction.slice(emailAction.indexOf('if (outcome.status === "sent")'));
  assert.ok(!successBranch.includes('"logged"'), "logged is never success");
});

test("the request is recorded before the attempt, and the outcome after", () => {
  const emailAction = ACTIONS.slice(ACTIONS.indexOf("export async function emailMyWellbeingReport"));
  const requested = emailAction.indexOf('status: "requested"');
  const attempt = emailAction.indexOf("await sendWellbeingReportReady(");
  const resolved = emailAction.indexOf("resolved_at");
  assert.ok(requested > 0 && attempt > requested, "the request is logged before the send");
  assert.ok(resolved > attempt, "the outcome is logged after the send");
});

test("the delivery log stores a masked address and never a score", () => {
  const emailAction = ACTIONS.slice(ACTIONS.indexOf("export async function emailMyWellbeingReport"));
  assert.match(emailAction, /masked_recipient: masked/);
  const insert = emailAction.slice(
    emailAction.indexOf('.from("wellbeing_report_deliveries")'),
    emailAction.indexOf(".select(\"id\")"),
  );
  for (const forbidden of ["total_score", "score", "item_positions"]) {
    assert.ok(!insert.includes(forbidden), `the delivery log must not store ${forbidden}`);
  }
});

/* ── the download route ─────────────────────────────────────────────── */

test("the PDF route answers 404 for both missing and not-yours", () => {
  const notFound = [...ROUTE.matchAll(/status:\s*404/g)];
  assert.ok(notFound.length >= 1);
  assert.match(ROUTE, /loadOwnWellbeingReport\(resultId\)/);
  assert.ok(
    !/status:\s*40[13]/.test(ROUTE),
    "a 401 or 403 would reveal that the result exists and belongs to someone else",
  );
});

test("the PDF response is private, uncached and sends no referrer", () => {
  assert.match(ROUTE, /"Cache-Control":\s*"private, no-store"/);
  assert.match(ROUTE, /"Referrer-Policy":\s*"no-referrer"/);
});

test("no wellbeing action logs a score, a response or an address", () => {
  assert.ok(!/console\.(log|info|warn|error)/.test(ACTIONS), "no console logging in this flow");
  // Audit metadata must stay structural.
  for (const match of ACTIONS.matchAll(/metadata:\s*\{([^}]*)\}/g)) {
    const metadata = match[1]!;
    for (const forbidden of ["score", "email", "positions", "response"]) {
      assert.ok(
        !new RegExp(forbidden, "i").test(metadata),
        `audit metadata must not carry ${forbidden}: ${metadata}`,
      );
    }
  }
});
