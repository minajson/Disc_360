import type { Dimension } from "../types/index.ts";
import type {
  ReportBar,
  ReportDocument,
  ReportScale,
  ReportSection,
  ReportSeries,
} from "./model.ts";
import type { ReportProduct } from "./identity.ts";

/**
 * A PDF writer for the individual report.
 *
 * Deliberately dependency-free. Every PDF library worth using in Node pulls in
 * either a headless browser or a font stack an order of magnitude larger than
 * this file, and a participant downloading their own eight-page report should
 * not cost a Chromium launch per request. The report is text, rules and filled
 * rectangles, so the base-14 fonts and a hand-rolled layout pass cover it.
 *
 * Pure: `renderReportPdf(document)` in, bytes out. No I/O, no clock (pass
 * `generatedAt` for a deterministic file), which is what makes it testable.
 */

/* ── page geometry (A4) ───────────────────────────────────── */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 54;
const MARGIN_TOP = 58;
const MARGIN_BOTTOM = 62;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

/* ── palette (Meridian tokens, as PDF device RGB) ─────────── */

const INK = "0.090 0.125 0.114";
const SLATE = "0.373 0.412 0.396";
const FAINT = "0.545 0.580 0.561";
const BOTANICAL = "0.090 0.298 0.235";
const TEAL = "0.294 0.510 0.459";
const HAIRLINE = "0.867 0.851 0.824";
const SAND = "0.945 0.933 0.914";
// Wellbeing Pulse accents. Attention is warm and low-chroma on purpose: an
// above-threshold screening score is a prompt to notice, never an alarm, so
// no red enters the participant's own report.
const PULSE = "0.122 0.306 0.373";
const PULSE_SOFT = "0.843 0.894 0.906";
const PULSE_ATTENTION = "0.541 0.416 0.184";

const DIMENSION_TONE: Record<Dimension, string> = {
  D: "0.761 0.290 0.180",
  I: "0.663 0.463 0.078",
  S: "0.184 0.478 0.341",
  C: "0.200 0.392 0.561",
};

/* ── base-14 metrics (units per 1000) ─────────────────────── */

// prettier-ignore
const HELVETICA_WIDTHS = [
  278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,
  278,278,584,584,584,556,1015,
  667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
  278,278,278,469,556,333,
  556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,
  334,260,334,584,
];

// prettier-ignore
const HELVETICA_BOLD_WIDTHS = [
  278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,
  333,333,584,584,584,611,975,
  722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
  333,278,333,584,556,333,
  556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,
  389,280,389,584,
];

export type PdfFont = "regular" | "bold";

/**
 * Unicode the report copy actually contains → its WinAnsi byte and width.
 * Em dashes, curly quotes and middle dots are all over the insight maps; left
 * unmapped they would render as mojibake in the one artefact people keep.
 */
const WIN_ANSI: Record<string, { byte: number; regular: number; bold: number }> = {
  "–": { byte: 0x96, regular: 556, bold: 556 },
  "—": { byte: 0x97, regular: 1000, bold: 1000 },
  "‘": { byte: 0x91, regular: 222, bold: 278 },
  "’": { byte: 0x92, regular: 222, bold: 278 },
  "“": { byte: 0x93, regular: 333, bold: 500 },
  "”": { byte: 0x94, regular: 333, bold: 500 },
  "…": { byte: 0x85, regular: 1000, bold: 1000 },
  "•": { byte: 0x95, regular: 350, bold: 350 },
  "·": { byte: 0xb7, regular: 278, bold: 278 },
  "×": { byte: 0xd7, regular: 584, bold: 584 },
  " ": { byte: 0x20, regular: 278, bold: 278 },
};

const ASCII_FALLBACK: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "′": "'",
  "″": '"',
};

/** One WinAnsi byte per character; anything unmappable is folded, then dropped. */
function toWinAnsi(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text.normalize("NFC")) {
    const fallback = ASCII_FALLBACK[char];
    if (fallback) {
      for (const plain of fallback) bytes.push(plain.charCodeAt(0));
      continue;
    }
    const mapped = WIN_ANSI[char];
    if (mapped) {
      bytes.push(mapped.byte);
      continue;
    }
    const code = char.charCodeAt(0);
    if (code >= 32 && code <= 255) {
      bytes.push(code);
      continue;
    }
    // Fold accents that NFC kept composed but WinAnsi cannot express.
    const folded = char.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    for (const plain of folded) {
      const plainCode = plain.charCodeAt(0);
      if (plainCode >= 32 && plainCode <= 255) bytes.push(plainCode);
    }
  }
  return bytes;
}

function charWidth(char: string, font: PdfFont): number {
  const mapped = WIN_ANSI[char];
  if (mapped) return font === "bold" ? mapped.bold : mapped.regular;
  const fallback = ASCII_FALLBACK[char];
  if (fallback) {
    let total = 0;
    for (const plain of fallback) total += charWidth(plain, font);
    return total;
  }
  const code = char.charCodeAt(0);
  const table = font === "bold" ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  if (code >= 32 && code <= 126) return table[code - 32] ?? 556;
  return font === "bold" ? 611 : 556;
}

export function measureText(text: string, size: number, font: PdfFont): number {
  let width = 0;
  for (const char of text) width += charWidth(char, font);
  return (width * size) / 1000;
}

/** Greedy wrap; a single word wider than the column is broken rather than clipped. */
export function wrapText(text: string, size: number, font: PdfFont, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measureText(candidate, size, font) <= maxWidth || !line) {
        if (measureText(candidate, size, font) > maxWidth && !line) {
          let chunk = "";
          for (const char of word) {
            if (measureText(chunk + char, size, font) > maxWidth && chunk) {
              lines.push(chunk);
              chunk = char;
            } else {
              chunk += char;
            }
          }
          line = chunk;
          continue;
        }
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines.length > 0 ? lines : [""];
}

/* ── content-stream builder ───────────────────────────────── */

const escapeLiteral = (bytes: number[]): string =>
  bytes
    .map((byte) => {
      if (byte === 0x28 || byte === 0x29 || byte === 0x5c) return `\\${String.fromCharCode(byte)}`;
      return String.fromCharCode(byte);
    })
    .join("");

const num = (value: number): string => (Math.round(value * 100) / 100).toString();

interface TextOptions {
  x: number;
  y: number;
  size: number;
  font?: PdfFont;
  color?: string;
  /** Extra space between glyphs, for small caps-style eyebrows. */
  tracking?: number;
}

class PageCanvas {
  readonly parts: string[] = [];

  text(value: string, options: TextOptions): void {
    const bytes = toWinAnsi(value);
    if (bytes.length === 0) return;
    const font = options.font === "bold" ? "/F2" : "/F1";
    const tracking = options.tracking ?? 0;
    this.parts.push(
      `BT ${options.color ?? INK} rg ${font} ${num(options.size)} Tf` +
        (tracking ? ` ${num(tracking)} Tc` : "") +
        ` 1 0 0 1 ${num(options.x)} ${num(options.y)} Tm (${escapeLiteral(bytes)}) Tj` +
        (tracking ? " 0 Tc" : "") +
        " ET",
    );
  }

  rect(x: number, y: number, width: number, height: number, color: string): void {
    this.parts.push(`${color} rg ${num(x)} ${num(y)} ${num(width)} ${num(height)} re f`);
  }

  roundedBar(x: number, y: number, width: number, height: number, color: string): void {
    // A 2pt-tall bar with square ends reads fine at print size; keeping it a
    // plain rect avoids bezier arithmetic for no visible gain.
    this.rect(x, y, Math.max(width, 0), height, color);
  }

  rule(x: number, y: number, width: number, color = HAIRLINE): void {
    this.rect(x, y, width, 0.6, color);
  }
}

/* ── layout ───────────────────────────────────────────────── */

class ReportLayout {
  private readonly pages: PageCanvas[] = [];
  private current: PageCanvas;
  private y = PAGE_HEIGHT - MARGIN_TOP;

  constructor() {
    this.current = new PageCanvas();
    this.pages.push(this.current);
  }

  get canvas(): PageCanvas {
    return this.current;
  }

  get cursor(): number {
    return this.y;
  }

  get pageCount(): number {
    return this.pages.length;
  }

  get all(): PageCanvas[] {
    return this.pages;
  }

  move(delta: number): void {
    this.y -= delta;
  }

  breakPage(): void {
    this.current = new PageCanvas();
    this.pages.push(this.current);
    this.y = PAGE_HEIGHT - MARGIN_TOP;
  }

  /** Start a new page when `height` would not fit under the current cursor. */
  reserve(height: number): void {
    if (this.y - height < MARGIN_BOTTOM) this.breakPage();
  }

  paragraph(
    value: string,
    options: { size: number; font?: PdfFont; color?: string; leading?: number; indent?: number },
  ): void {
    const indent = options.indent ?? 0;
    const leading = options.leading ?? options.size * 1.45;
    const lines = wrapText(value, options.size, options.font ?? "regular", CONTENT_WIDTH - indent);
    for (const line of lines) {
      this.reserve(leading);
      this.current.text(line, {
        x: MARGIN_X + indent,
        y: this.y - options.size,
        size: options.size,
        font: options.font,
        color: options.color,
      });
      this.y -= leading;
    }
  }

  bullet(value: string, color = BOTANICAL): void {
    const size = 9.5;
    const leading = 13.5;
    const indent = 14;
    const lines = wrapText(value, size, "regular", CONTENT_WIDTH - indent);
    lines.forEach((line, index) => {
      this.reserve(leading);
      if (index === 0) {
        this.current.rect(MARGIN_X + 1.5, this.y - size + 2.6, 3, 3, color);
      }
      this.current.text(line, {
        x: MARGIN_X + indent,
        y: this.y - size,
        size,
        color: SLATE,
      });
      this.y -= leading;
    });
  }
}

/* ── report rendering ─────────────────────────────────────── */

/**
 * The wordmark on the cover.
 *
 * Wellbeing Pulse reports carry the Wellbeing Pulse mark, not DISC360's. A
 * participant who reached this product through a Wellbeing Pulse code has no
 * relationship with DISC360, and their private wellbeing report is not the
 * place to introduce one.
 */
function drawWordmark(canvas: PageCanvas, y: number, product: ReportProduct): void {
  if (product === "wellbeing") {
    canvas.text("Wellbeing", { x: MARGIN_X, y, size: 13, font: "bold", color: INK });
    canvas.text("Pulse", {
      x: MARGIN_X + measureText("Wellbeing ", 13, "bold"),
      y,
      size: 13,
      font: "bold",
      color: PULSE,
    });
    return;
  }
  canvas.text("DISC", { x: MARGIN_X, y, size: 13, font: "bold", color: INK });
  canvas.text("360", {
    x: MARGIN_X + measureText("DISC", 13, "bold"),
    y,
    size: 13,
    font: "bold",
    color: BOTANICAL,
  });
}

/**
 * A 0–max screening scale with the configured threshold marked.
 *
 * Every cell is drawn, so the axis is the same width whatever the score, and
 * the threshold is a labelled rule rather than a colour change — the same
 * reading as the on-screen scale, which is what makes "the PDF says something
 * the page does not" impossible rather than merely unlikely.
 */
function drawScale(layout: ReportLayout, scale: ReportScale): void {
  const cellCount = scale.max + 1;
  const gap = 2.5;
  const cellWidth = (CONTENT_WIDTH - gap * (cellCount - 1)) / cellCount;
  const cellHeight = 22;
  const tone = scale.atOrAboveThreshold ? PULSE_ATTENTION : PULSE;

  layout.reserve(cellHeight + 46);
  const canvas = layout.canvas;
  let top = layout.cursor;

  // Headline figure, e.g. "7 / 12".
  const figure = `${scale.value} / ${scale.max}`;
  canvas.text(figure, { x: MARGIN_X, y: top - 20, size: 22, font: "bold", color: tone });
  canvas.text(scale.label.toUpperCase(), {
    x: MARGIN_X + measureText(figure, 22, "bold") + 12,
    y: top - 13,
    size: 7.5,
    color: FAINT,
    tracking: 0.9,
  });
  layout.move(30);
  top = layout.cursor;

  for (let cell = 0; cell < cellCount; cell += 1) {
    const x = MARGIN_X + cell * (cellWidth + gap);
    const filled = scale.value > 0 && cell <= scale.value;
    canvas.rect(x, top - cellHeight, cellWidth, cellHeight, filled ? tone : PULSE_SOFT);
    const caption = String(cell);
    canvas.text(caption, {
      x: x + (cellWidth - measureText(caption, 6.5, "regular")) / 2,
      y: top - cellHeight - 9,
      size: 6.5,
      color: FAINT,
    });
  }

  // Threshold rule, drawn at the left edge of the threshold cell — but ONLY
  // for instruments that have one. A threshold outside the scale means the
  // instrument declares none, and nothing is drawn or captioned: an
  // unvalidated instrument must not acquire a line by rendering accident.
  const hasThreshold = scale.threshold >= 0 && scale.threshold <= scale.max;
  if (hasThreshold) {
    const thresholdX = MARGIN_X + scale.threshold * (cellWidth + gap) - gap / 2;
    canvas.rect(thresholdX, top - cellHeight - 3, 0.9, cellHeight + 6, PULSE_ATTENTION);
  }

  layout.move(cellHeight + 14);
  if (hasThreshold) {
    layout.paragraph(`Current screening threshold: ${scale.threshold}`, {
      size: 8.5,
      font: "bold",
      color: PULSE_ATTENTION,
      leading: 12,
    });
  }
  if (scale.caption) {
    layout.move(2);
    layout.paragraph(scale.caption, { size: 9.5, color: SLATE, leading: 13.5 });
  }
  layout.move(6);
}

/**
 * A line chart of a participant's own scores over time.
 *
 * Every point is also printed as a value, and the labels run along the base,
 * so the series is legible in greyscale and after a photocopy — which is how
 * a fair number of these will actually be read.
 */
function drawSeries(layout: ReportLayout, series: ReportSeries): void {
  const points = series.points;
  if (points.length === 0) return;

  const plotHeight = 96;
  layout.reserve(plotHeight + 40);
  const canvas = layout.canvas;
  const top = layout.cursor;
  const baseline = top - plotHeight;
  const leftGutter = 18;
  const plotWidth = CONTENT_WIDTH - leftGutter;
  const originX = MARGIN_X + leftGutter;

  const x = (index: number) =>
    points.length === 1
      ? originX + plotWidth / 2
      : originX + (index / (points.length - 1)) * plotWidth;
  const y = (value: number) =>
    baseline + (series.max > 0 ? Math.min(Math.max(value, 0), series.max) / series.max : 0) * plotHeight;

  // Gridlines at 0, half, max.
  for (const gridValue of [0, Math.round(series.max / 2), series.max]) {
    canvas.rule(originX, y(gridValue), plotWidth, HAIRLINE);
    canvas.text(String(gridValue), {
      x: MARGIN_X,
      y: y(gridValue) - 2.5,
      size: 6.5,
      color: FAINT,
    });
  }

  if (series.threshold !== undefined) {
    // Dashed by hand: short segments, so no graphics-state dash array is needed.
    const dashY = y(series.threshold);
    for (let dashX = originX; dashX < originX + plotWidth; dashX += 7) {
      canvas.rect(dashX, dashY, 4, 0.8, PULSE_ATTENTION);
    }
    const label = series.thresholdLabel ?? `Threshold ${series.threshold}`;
    canvas.text(label, {
      x: originX + plotWidth - measureText(label, 6.5, "regular"),
      y: dashY + 4,
      size: 6.5,
      color: PULSE_ATTENTION,
    });
  }

  // The line, as a run of thin quads between consecutive points.
  for (let index = 0; index < points.length - 1; index += 1) {
    const x1 = x(index);
    const y1 = y(points[index]!.value);
    const x2 = x(index + 1);
    const y2 = y(points[index + 1]!.value);
    const steps = Math.max(1, Math.ceil(Math.abs(x2 - x1) / 2));
    for (let step = 0; step < steps; step += 1) {
      const t0 = step / steps;
      const t1 = (step + 1) / steps;
      const segX = x1 + (x2 - x1) * t0;
      const segY = y1 + (y2 - y1) * t0;
      const segW = (x2 - x1) * (t1 - t0) + 1.4;
      canvas.rect(segX, segY - 0.7, segW, 1.4, PULSE);
    }
  }

  points.forEach((point, index) => {
    const px = x(index);
    const py = y(point.value);
    canvas.rect(px - 2.2, py - 2.2, 4.4, 4.4, PULSE);
    const value = String(point.value);
    canvas.text(value, {
      x: px - measureText(value, 7.5, "bold") / 2,
      y: py + 6,
      size: 7.5,
      font: "bold",
      color: INK,
    });
    const label = point.label;
    canvas.text(label, {
      x: Math.max(MARGIN_X, px - measureText(label, 6.5, "regular") / 2),
      y: baseline - 11,
      size: 6.5,
      color: FAINT,
    });
  });

  layout.move(plotHeight + 24);
}

function drawBars(layout: ReportLayout, bars: ReportBar[]): void {
  for (const bar of bars) {
    const rowHeight = bar.note ? 34 : 24;
    layout.reserve(rowHeight);
    const canvas = layout.canvas;
    const top = layout.cursor;
    canvas.text(bar.label, { x: MARGIN_X, y: top - 9, size: 9, font: "bold", color: INK });
    const valueLabel = String(bar.value);
    canvas.text(valueLabel, {
      x: MARGIN_X + CONTENT_WIDTH - measureText(valueLabel, 9, "bold"),
      y: top - 9,
      size: 9,
      font: "bold",
      color: SLATE,
    });
    const trackY = top - 15.5;
    canvas.rect(MARGIN_X, trackY, CONTENT_WIDTH, 4, SAND);
    const ratio = bar.max > 0 ? Math.min(Math.max(bar.value / bar.max, 0), 1) : 0;
    canvas.roundedBar(
      MARGIN_X,
      trackY,
      CONTENT_WIDTH * ratio,
      4,
      bar.tone ? DIMENSION_TONE[bar.tone] : TEAL,
    );
    layout.move(20);
    if (bar.note) {
      layout.paragraph(bar.note, { size: 8, color: FAINT, leading: 11 });
      layout.move(2);
    } else {
      layout.move(4);
    }
  }
}

function drawSection(layout: ReportLayout, section: ReportSection): void {
  // Deliberate page structure, where a report defines one.
  if (section.pageBreakBefore) layout.breakPage();
  // Keep a title with at least its first line of content.
  layout.reserve(52);
  layout.move(12);
  layout.canvas.rule(MARGIN_X, layout.cursor, CONTENT_WIDTH);
  layout.move(14);
  layout.paragraph(section.title, { size: 13, font: "bold", color: INK, leading: 17 });
  layout.move(3);

  if (section.lead) {
    layout.paragraph(section.lead, { size: 9.5, color: SLATE, leading: 13.5 });
    layout.move(4);
  }
  for (const paragraph of section.paragraphs ?? []) {
    layout.paragraph(paragraph, { size: 9.5, color: SLATE, leading: 13.5 });
    layout.move(5);
  }
  if (section.scale) {
    layout.move(4);
    drawScale(layout, section.scale);
  }
  if (section.series) {
    layout.move(4);
    drawSeries(layout, section.series);
  }
  if (section.bars) {
    layout.move(2);
    drawBars(layout, section.bars);
  }
  for (const bullet of section.bullets ?? []) {
    layout.bullet(bullet);
  }
  for (const column of section.columns ?? []) {
    layout.move(8);
    layout.reserve(26);
    layout.paragraph(column.heading.toUpperCase(), {
      size: 8,
      font: "bold",
      color: FAINT,
      leading: 12,
    });
    layout.move(2);
    for (const bullet of column.bullets) layout.bullet(bullet, TEAL);
  }
  layout.move(8);
}

function drawCover(layout: ReportLayout, document: ReportDocument): void {
  const canvas = layout.canvas;
  const top = layout.cursor;
  drawWordmark(canvas, top - 10, document.product);
  const label = document.productLabel.toUpperCase();
  canvas.text(label, {
    x: MARGIN_X + CONTENT_WIDTH - measureText(label, 7.5, "regular") - 7.5 * 0.14 * label.length,
    y: top - 9,
    size: 7.5,
    color: FAINT,
    tracking: 7.5 * 0.14,
  });
  layout.move(20);
  canvas.rule(MARGIN_X, layout.cursor, CONTENT_WIDTH);
  layout.move(30);

  layout.paragraph(document.eyebrow.toUpperCase(), {
    size: 8,
    font: "bold",
    color: TEAL,
    leading: 12,
  });
  layout.move(6);
  layout.paragraph(document.headline, { size: 24, font: "bold", color: INK, leading: 29 });
  layout.move(6);
  layout.paragraph(`Prepared for ${document.participantName}`, {
    size: 10.5,
    color: SLATE,
    leading: 15,
  });
  layout.move(10);
  layout.paragraph(document.summary, { size: 10, color: SLATE, leading: 15 });
  layout.move(16);

  for (const item of document.meta) {
    layout.reserve(19);
    const rowTop = layout.cursor;
    layout.canvas.text(item.label.toUpperCase(), {
      x: MARGIN_X,
      y: rowTop - 8,
      size: 7.5,
      color: FAINT,
      tracking: 0.9,
    });
    layout.canvas.text(item.value, {
      x: MARGIN_X + CONTENT_WIDTH - measureText(item.value, 9.5, "bold"),
      y: rowTop - 8.5,
      size: 9.5,
      font: "bold",
      color: INK,
    });
    layout.move(13);
    layout.canvas.rule(MARGIN_X, layout.cursor, CONTENT_WIDTH);
    layout.move(6);
  }
}

function drawFooters(pages: PageCanvas[], document: ReportDocument): void {
  pages.forEach((canvas, index) => {
    canvas.rule(MARGIN_X, MARGIN_BOTTOM - 16, CONTENT_WIDTH);
    const brand = document.product === "wellbeing" ? "Wellbeing Pulse" : "DISC360";
    canvas.text(`${brand} · ${document.participantName}`, {
      x: MARGIN_X,
      y: MARGIN_BOTTOM - 28,
      size: 7.5,
      color: FAINT,
    });
    const page = `Page ${index + 1} of ${pages.length}`;
    canvas.text(page, {
      x: MARGIN_X + CONTENT_WIDTH - measureText(page, 7.5, "regular"),
      y: MARGIN_BOTTOM - 28,
      size: 7.5,
      color: FAINT,
    });
  });
}

/* ── PDF file assembly ────────────────────────────────────── */

const pdfString = (value: string): string => `(${escapeLiteral(toWinAnsi(value))})`;

export interface RenderOptions {
  /** ISO-8601 timestamp for the document metadata. Explicit, so tests are stable. */
  generatedAt?: string;
}

export function renderReportPdf(document: ReportDocument, options: RenderOptions = {}): Uint8Array {
  const layout = new ReportLayout();
  drawCover(layout, document);
  for (const section of document.sections) drawSection(layout, section);

  layout.move(10);
  layout.reserve(30);
  layout.canvas.rule(MARGIN_X, layout.cursor, CONTENT_WIDTH);
  layout.move(12);
  layout.paragraph(document.disclaimer, { size: 8, color: FAINT, leading: 11 });

  const pages = layout.all;
  drawFooters(pages, document);

  const objects: string[] = [];
  const addObject = (body: string): number => {
    objects.push(body);
    return objects.length;
  };

  // 1 catalog, 2 pages tree, 3/4 fonts — page and stream objects follow.
  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("");
  const regularId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  const boldId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );

  const pageIds: number[] = [];
  for (const canvas of pages) {
    const content = canvas.parts.join("\n");
    const streamId = addObject(
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(PAGE_WIDTH)} ${num(PAGE_HEIGHT)}] ` +
        `/Resources << /Font << /F1 ${regularId} 0 R /F2 ${boldId} 0 R >> >> /Contents ${streamId} 0 R >>`,
    );
    pageIds.push(pageId);
  }
  objects[pagesId - 1] =
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;

  // Document metadata is visible in every PDF reader's properties panel and to
  // desktop file indexers, so it carries the same brand the cover does. A
  // Wellbeing Pulse participant's private report must not identify DISC360
  // anywhere, including in a field nobody thinks to look at.
  const brandName = document.product === "wellbeing" ? "Wellbeing Pulse" : "DISC360";
  const infoId = addObject(
    // An aggregate document must not describe itself as somebody's individual
    // report — including in metadata, which is what a file manager shows and
    // what a recipient sees before opening it.
    `<< /Title ${pdfString(
      `${document.participantName} — ${brandName} ${
        document.audience === "aggregate" ? "aggregate report" : "individual report"
      }`,
    )} ` +
      `/Author ${pdfString(brandName)} /Creator ${pdfString(brandName)} ` +
      `/Producer ${pdfString(brandName)} ` +
      `/Subject ${pdfString(document.productLabel)} ` +
      `/CreationDate ${pdfString(pdfDate(options.generatedAt ?? document.completedAt))} >>`,
  );

  let file = "%PDF-1.4\n%âãÏÓ\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(file.length);
    file += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = file.length;
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    file += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  file +=
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;

  const bytes = new Uint8Array(file.length);
  for (let index = 0; index < file.length; index++) {
    bytes[index] = file.charCodeAt(index) & 0xff;
  }
  return bytes;
}

/** PDF date syntax: D:YYYYMMDDHHmmSSZ */
function pdfDate(iso: string): string {
  const date = new Date(iso);
  const time = Number.isNaN(date.getTime()) ? new Date(0) : date;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return (
    `D:${time.getUTCFullYear()}${pad(time.getUTCMonth() + 1)}${pad(time.getUTCDate())}` +
    `${pad(time.getUTCHours())}${pad(time.getUTCMinutes())}${pad(time.getUTCSeconds())}Z`
  );
}
