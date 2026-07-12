import assert from "node:assert/strict";
import { test } from "node:test";
import { buildJoinUrl, classifyBaseUrl, getPublicBaseUrl } from "./site-url.ts";

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

test("runtime SITE_URL overrides the build-time public value", () => {
  const saved = { site: process.env.SITE_URL, pub: process.env.NEXT_PUBLIC_SITE_URL };
  try {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    process.env.SITE_URL = "https://runtime.disc360.com";
    assert.equal(getPublicBaseUrl().url, "https://runtime.disc360.com");
    delete process.env.SITE_URL;
    assert.equal(getPublicBaseUrl().url, "http://localhost:3000");
  } finally {
    if (saved.site === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = saved.site;
    if (saved.pub === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = saved.pub;
  }
});
