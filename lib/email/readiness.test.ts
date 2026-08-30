import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Email readiness.
 *
 * `readEmailReadiness` is `server-only` and cannot be imported by the Node
 * runner, so its RULES are asserted from source. What matters here is not the
 * arithmetic — it is that a provider credential can never be rendered.
 */

const source = readFileSync(new URL("./readiness.ts", import.meta.url), "utf8");
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("the readiness report exposes presence, never the key", () => {
  // The only thing said about the key is whether there is one.
  assert.match(code, /hasKey: boolean/);
  assert.match(code, /hasKey = Boolean\(env\.RESEND_API_KEY\?\.trim\(\)\)/);

  // The value must not be returned. The returned object literal is the whole
  // surface area, so that is what is checked — `missing` carries the variable
  // NAME, which is the point, and lives outside it.
  const start = code.indexOf("  return {");
  const returned = code.slice(start, code.indexOf("\n  };", start));
  assert.ok(returned.length > 0, "the returned object must be found");
  assert.ok(
    !/RESEND_API_KEY|env\.EMAIL_FROM/.test(returned),
    `the provider key must never reach the returned object:\n${returned}`,
  );
  assert.match(returned, /hasKey,/);
});

test("no admin surface prints the provider key", () => {
  const page = readFileSync(
    new URL("../../app/admin/emails/page.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(!page.includes("RESEND_API_KEY?"), "the key is never read on a page");
  assert.ok(!page.includes("process.env.RESEND"), "the key is never read on a page");
  // It names the missing variables, which is the point.
  assert.match(page, /email\.missing\.join/);
});

test("every variable the product needs is named in the readiness report", () => {
  for (const variable of ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_REPLY_TO"]) {
    assert.ok(code.includes(variable), `${variable} must be reported as missing when unset`);
  }
});

test("the runbook documents the same three variables, with formats", () => {
  const runbook = readFileSync(
    new URL("../../docs/DEPLOYMENT_RUNBOOK.md", import.meta.url),
    "utf8",
  );
  const phase = runbook.slice(runbook.indexOf("## Phase 6"), runbook.indexOf("## Phase 7"));
  for (const variable of ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_REPLY_TO"]) {
    assert.ok(phase.includes(variable), `the runbook must name ${variable}`);
  }
  // Where they go, now that production is not on Netlify.
  assert.match(phase, /Vercel/);
  // And the trap that will otherwise waste a day.
  assert.match(phase, /verified in Resend/i);
});

test("the runbook's verification does not accept logs as proof", () => {
  const runbook = readFileSync(
    new URL("../../docs/DEPLOYMENT_RUNBOOK.md", import.meta.url),
    "utf8",
  );
  const phase = runbook.slice(runbook.indexOf("## Phase 6"), runbook.indexOf("## Phase 7"));
  assert.match(phase, /not\*\* mark email as passing from logs alone/i);
  assert.match(phase, /real inbox/i);
  // And it checks the things that are easy to get wrong.
  assert.match(phase, /twice quickly/i, "double-send must be verified");
  assert.match(phase, /masked/i, "the masked recipient state must be verified");
  assert.match(phase, /all four questionnaires/i);
});
