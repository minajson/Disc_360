/**
 * Report identity helpers — the download filename and the masked address a
 * participant confirms before their report is emailed.
 *
 * Both are pure and unit-tested. A filename that carries a path separator and
 * an address printed in full on a shared screen are exactly the two mistakes
 * that are invisible in review and obvious in production.
 */

export type ReportProduct = "disc" | "focus" | "combined";

const PRODUCT_FILENAME_TOKEN: Record<ReportProduct, string> = {
  disc: "",
  focus: "Focus",
  combined: "Combined",
};

const MAX_NAME_LENGTH = 60;

/**
 * `DISC360_Mina_Allison_Report.pdf`
 *
 * ASCII only, underscore-joined, no path separators and no leading dot — the
 * value is written into a Content-Disposition header, so anything that could
 * be read as a directory traversal or a header injection is stripped rather
 * than escaped.
 */
export function reportFilename(fullName: string, product: ReportProduct = "disc"): string {
  const name = sanitizeNameSegment(fullName) || "Participant";
  const token = PRODUCT_FILENAME_TOKEN[product];
  return ["DISC360", name, token, "Report"].filter(Boolean).join("_") + ".pdf";
}

/**
 * Latin letters NFKD leaves composed. Without these a name like "Ødegård"
 * loses its first letter rather than transliterating it — the participant's
 * own name, misspelt on their own report.
 */
const LATIN_FOLD: Record<string, string> = {
  Æ: "AE", æ: "ae", Ø: "O", ø: "o", Œ: "OE", œ: "oe",
  Đ: "D", đ: "d", Ð: "D", ð: "d", Ł: "L", ł: "l",
  Þ: "Th", þ: "th", ß: "ss", İ: "I", ı: "i", Ħ: "H", ħ: "h",
};

/** Diacritic-folded, alphanumeric, underscore-joined, length-capped. */
export function sanitizeNameSegment(value: string): string {
  return value
    .replace(/[ÆæØøŒœĐđÐðŁłÞþßİıĦħ]/g, (char) => LATIN_FOLD[char] ?? char)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_NAME_LENGTH)
    .replace(/_+$/g, "");
}

/**
 * `mina@company.com` → `m***@company.com`.
 *
 * The confirmation step happens on whatever device the participant just
 * finished the assessment on — frequently a shared laptop in a workshop room.
 * Enough of the address to recognise, not enough to copy.
 */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

/** Server-side address validation for the "no email on file" fallback. */
export function isDeliverableEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  if (/\s/.test(trimmed)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(trimmed);
}
