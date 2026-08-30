import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The release endpoint is public, so what it may carry is the whole question.
 */

const route = readFileSync(
  new URL("../../app/api/release/route.ts", import.meta.url),
  "utf8",
);
const code = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("the release endpoint returns three facts and nothing else", () => {
  const body = code.slice(code.indexOf("Response.json("), code.indexOf("{ headers:"));
  const keys = [...body.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
  assert.deepEqual(keys, ["sha", "ref", "builtAt"]);
});

test("it reads only build-time release variables", () => {
  const envs = [...code.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]);
  const allowed = new Set([
    "NEXT_PUBLIC_RELEASE_SHA",
    "NEXT_PUBLIC_RELEASE_REF",
    "NEXT_PUBLIC_RELEASE_BUILT_AT",
    "VERCEL_GIT_COMMIT_SHA",
    "VERCEL_GIT_COMMIT_REF",
  ]);
  for (const name of envs) {
    assert.ok(allowed.has(name), `the public release endpoint reads ${name}`);
  }
  // In particular: no secret can be reached from here.
  for (const secret of ["SERVICE_ROLE", "RESEND", "ANTHROPIC", "CLIENT_SECRET"]) {
    assert.ok(!code.includes(secret), `the release endpoint references ${secret}`);
  }
});

test("an unset release reports 'unknown' rather than an empty string", () => {
  // An empty SHA in a deploy check reads as a failed request; "unknown" reads
  // as what it is — a build that was not told which commit it came from.
  assert.equal((code.match(/"unknown"/g) ?? []).length, 3);
});

test("it is never cached", () => {
  // A cached release identity is worse than none: it reports the previous
  // deploy as the current one, which is exactly the question being asked.
  assert.match(code, /"Cache-Control": "no-store"/);
  assert.match(code, /force-dynamic/);
});
