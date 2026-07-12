import assert from "node:assert/strict";
import { test } from "node:test";
import { buildJoinUrl, classifyBaseUrl } from "./site-url.ts";

test("production URLs are never flagged local and never emit localhost", () => {
  const base = classifyBaseUrl("https://disc360.com");
  assert.equal(base.isLocal, false);
  const url = buildJoinUrl(base, "abc-token");
  assert.equal(url, "https://disc360.com/join/abc-token");
  assert.doesNotMatch(url, /localhost|127\.0\.0\.1/);
});

test("localhost and loopback variants are flagged local", () => {
  for (const raw of [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:3000",
    undefined,
  ]) {
    assert.equal(classifyBaseUrl(raw).isLocal, true, String(raw));
  }
});

test("trailing slashes are normalized", () => {
  const base = classifyBaseUrl("https://disc360.com///");
  assert.equal(buildJoinUrl(base, "t"), "https://disc360.com/join/t");
});
