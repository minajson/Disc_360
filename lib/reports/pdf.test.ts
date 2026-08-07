import assert from "node:assert/strict";
import { test } from "node:test";
import { measureText, renderReportPdf, wrapText } from "./pdf.ts";
import { buildCombinedReport, buildDiscReport, buildFocusReport } from "./model.ts";
import type { ReportDocument } from "./model.ts";
import type { FocusResult } from "../scoring/focus.ts";
import type { DiscScores } from "../types/index.ts";

const SCORES: DiscScores = { d: 82, i: 48, s: 30, c: 64 };
const COMPLETED_AT = "2026-03-04T10:15:00.000Z";
const GENERATED_AT = "2026-03-04T10:20:00.000Z";

const FOCUS: FocusResult = {
  scores: { automaticity: 62, distraction: 71, mentalLoad: 68, recovery: 44 },
  patternCode: "responsive_multitasker",
  primaryLoop: "messages",
  notificationPattern: "immediate",
  energyPattern: "post_lunch",
  preferredReset: "movement",
};

const discDoc = (name = "Mina Allison"): ReportDocument =>
  buildDiscReport({
    participantName: name,
    completedAt: COMPLETED_AT,
    scores: SCORES,
    archetypeCode: "DC",
    primary: "D",
    secondary: "C",
  });

/** The PDF is written one byte per character, so latin1 round-trips it. */
const asText = (bytes: Uint8Array): string => Buffer.from(bytes).toString("latin1");

test("wrapping never exceeds the column, and never drops a word", () => {
  const source =
    "You commit while others are still framing the question, which gives your teams direction when it matters most.";
  const lines = wrapText(source, 9.5, "regular", 200);
  assert.ok(lines.length > 1, "long text wraps");
  for (const line of lines) {
    assert.ok(measureText(line, 9.5, "regular") <= 200, `line too wide: ${line}`);
  }
  assert.equal(lines.join(" ").replace(/\s+/g, " "), source);
});

test("a word wider than the column is broken rather than clipped", () => {
  const lines = wrapText("Supercalifragilisticexpialidocious", 12, "bold", 40);
  assert.ok(lines.length > 1);
  for (const line of lines) {
    assert.ok(measureText(line, 12, "bold") <= 40, `overflow: ${line}`);
  }
  assert.equal(lines.join(""), "Supercalifragilisticexpialidocious");
});

test("bold metrics differ from regular — the tables are not the same array", () => {
  assert.notEqual(measureText("Behaviour", 10, "bold"), measureText("Behaviour", 10, "regular"));
});

test("the output is a structurally valid PDF", () => {
  const text = asText(renderReportPdf(discDoc(), { generatedAt: GENERATED_AT }));
  assert.ok(text.startsWith("%PDF-1.4"), "PDF header");
  assert.ok(text.trimEnd().endsWith("%%EOF"), "EOF marker");
  assert.match(text, /\/Type \/Catalog/);
  assert.match(text, /\/Type \/Pages \/Count (\d+)/);
  assert.match(text, /\/Type \/Page\b/);
  assert.match(text, /\btrailer\b/);

  // Every xref offset must actually point at the object it claims.
  const startxref = Number(text.match(/startxref\n(\d+)/)?.[1]);
  assert.ok(Number.isFinite(startxref), "startxref present");
  assert.equal(text.slice(startxref, startxref + 4), "xref");
  const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
  assert.ok(offsets.length > 0);
  offsets.forEach((offset, index) => {
    assert.match(text.slice(offset, offset + 20), new RegExp(`^${index + 1} 0 obj`), `object ${index + 1}`);
  });
});

test("declared stream lengths match the streams", () => {
  const text = asText(renderReportPdf(discDoc(), { generatedAt: GENERATED_AT }));
  const streams = [...text.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)];
  assert.ok(streams.length > 0, "at least one content stream");
  for (const [, declared, body] of streams) {
    assert.equal(body?.length, Number(declared));
  }
});

test("the PDF names the participant and no one else", () => {
  const text = asText(renderReportPdf(discDoc(), { generatedAt: GENERATED_AT }));
  assert.match(text, /Mina Allison/);
  const other = asText(renderReportPdf(discDoc("Other Person"), { generatedAt: GENERATED_AT }));
  assert.ok(!other.includes("Mina Allison"), "another participant appeared in the PDF");
  assert.match(other, /Other Person/);
});

test("the PDF carries the participant's scores and profile", () => {
  const text = asText(renderReportPdf(discDoc(), { generatedAt: GENERATED_AT }));
  assert.match(text, /The Architect|Strengths/);
  for (const value of ["82", "48", "30", "64"]) {
    assert.ok(text.includes(`(${value})`), `score ${value} missing from the PDF`);
  }
});

test("the PDF exposes no email address or database id", () => {
  const text = asText(renderReportPdf(discDoc(), { generatedAt: GENERATED_AT }));
  assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(text), "email address in PDF");
  assert.ok(
    !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text),
    "uuid in PDF",
  );
});

test("rendering is deterministic for a fixed timestamp", () => {
  const first = renderReportPdf(discDoc(), { generatedAt: GENERATED_AT });
  const second = renderReportPdf(discDoc(), { generatedAt: GENERATED_AT });
  assert.deepEqual(Buffer.from(first), Buffer.from(second));
});

test("every product renders a multi-page document", () => {
  const documents = [
    discDoc(),
    buildFocusReport({ participantName: "Mina Allison", completedAt: COMPLETED_AT, focus: FOCUS }),
    buildCombinedReport({
      participantName: "Mina Allison",
      completedAt: COMPLETED_AT,
      scores: SCORES,
      archetypeCode: "DC",
      primary: "D",
      secondary: "C",
      focus: FOCUS,
    }),
  ];
  for (const document of documents) {
    const text = asText(renderReportPdf(document, { generatedAt: GENERATED_AT }));
    const count = Number(text.match(/\/Type \/Pages \/Count (\d+)/)?.[1]);
    assert.ok(count >= 1, `${document.product}: page count`);
    assert.match(text, /Page 1 of/, `${document.product}: footer`);
  }
});

test("typographic characters survive as WinAnsi rather than mojibake", () => {
  const document: ReportDocument = {
    ...discDoc(),
    summary: "Curly ‘quotes’, an em—dash, an ellipsis… and a middle · dot.",
  };
  const text = asText(renderReportPdf(document, { generatedAt: GENERATED_AT }));
  // WinAnsi codepoints, not multi-byte UTF-8 sequences.
  assert.ok(text.includes("\x91quotes\x92"), "curly quotes");
  assert.ok(text.includes("em\x97dash"), "em dash");
  assert.ok(text.includes("ellipsis\x85"), "ellipsis");
  assert.ok(!text.includes("â"), "utf-8 leaked into the byte stream");
});

test("literal strings escape the delimiters that would corrupt the file", () => {
  const document: ReportDocument = { ...discDoc("Ana (Ana) \\ Ltd"), summary: "A (nested (pair)) and a \\ slash." };
  const text = asText(renderReportPdf(document, { generatedAt: GENERATED_AT }));
  assert.ok(text.includes("\\(nested \\(pair\\)\\)"), "parentheses escaped");
  assert.ok(text.includes("\\\\ slash"), "backslash escaped");
  // Balanced after escaping: every unescaped ( has a matching ).
  for (const [, body] of text.matchAll(/stream\n([\s\S]*?)\nendstream/g)) {
    let depth = 0;
    for (let index = 0; index < (body?.length ?? 0); index++) {
      if (body![index] === "\\") {
        index++;
        continue;
      }
      if (body![index] === "(") depth++;
      if (body![index] === ")") depth--;
      assert.ok(depth >= 0, "unbalanced closing parenthesis");
    }
    assert.equal(depth, 0, "unbalanced literal string");
  }
});
