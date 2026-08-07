import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isDeliverableEmail,
  maskEmail,
  reportFilename,
  sanitizeNameSegment,
} from "./identity.ts";

test("report filename matches the product convention", () => {
  assert.equal(reportFilename("Mina Allison"), "DISC360_Mina_Allison_Report.pdf");
  assert.equal(reportFilename("Mina Allison", "focus"), "DISC360_Mina_Allison_Focus_Report.pdf");
  assert.equal(
    reportFilename("Mina Allison", "combined"),
    "DISC360_Mina_Allison_Combined_Report.pdf",
  );
});

test("report filename is safe to put in a Content-Disposition header", () => {
  // Path separators, quotes and header terminators must not survive.
  const hostile = reportFilename('../../etc/passwd"\r\nX-Injected: 1');
  assert.ok(!hostile.includes("/"), "no path separator");
  assert.ok(!hostile.includes(".."), "no traversal");
  assert.ok(!hostile.includes('"'), "no quote");
  assert.ok(!/[\r\n]/.test(hostile), "no header break");
  assert.match(hostile, /^DISC360_[A-Za-z0-9_]+_Report\.pdf$/);
});

test("names fold to ASCII and never collapse to an empty segment", () => {
  assert.equal(reportFilename("Renée Ødegård"), "DISC360_Renee_Odegard_Report.pdf");
  assert.equal(reportFilename("   "), "DISC360_Participant_Report.pdf");
  assert.equal(reportFilename("春樹"), "DISC360_Participant_Report.pdf");
  assert.equal(sanitizeNameSegment("O'Brien-Smith"), "O_Brien_Smith");
});

test("very long names stay bounded", () => {
  const filename = reportFilename("A".repeat(400));
  assert.ok(filename.length < 100, `filename length ${filename.length}`);
  assert.match(filename, /^DISC360_A+_Report\.pdf$/);
});

test("masked email shows one character and the domain, never the local part", () => {
  assert.equal(maskEmail("mina@company.com"), "m***@company.com");
  assert.equal(maskEmail("  Mina.Allison@Company.co.uk  "), "M***@Company.co.uk");
  // Nothing recognisable survives when there is no address to mask.
  assert.equal(maskEmail("not-an-email"), "***");
  assert.equal(maskEmail("@company.com"), "***");
  assert.equal(maskEmail(""), "***");
});

test("masked email never leaks the full local part", () => {
  const address = "confidential.person@example.com";
  const masked = maskEmail(address);
  assert.ok(!masked.includes("confidential"), masked);
  assert.ok(!masked.includes("person"), masked);
});

test("server-side email validation rejects what a browser would wave through", () => {
  assert.ok(isDeliverableEmail("mina@company.com"));
  assert.ok(isDeliverableEmail("first.last+tag@sub.example.co.uk"));
  assert.ok(!isDeliverableEmail(""));
  assert.ok(!isDeliverableEmail("mina@company"));
  assert.ok(!isDeliverableEmail("mina@@company.com"));
  assert.ok(!isDeliverableEmail("mina @company.com"));
  assert.ok(!isDeliverableEmail("mina@company.com\nbcc: someone@else.com"));
  assert.ok(!isDeliverableEmail(`${"a".repeat(250)}@company.com`));
});
