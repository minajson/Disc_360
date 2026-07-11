const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CsvMemberRow {
  display_name: string;
  email: string;
  department: string | null;
}

/** Tiny CSV importer: lines of `name,email[,department]`, header optional. */
export function parseMemberCsv(text: string): {
  rows: CsvMemberRow[];
  errors: string[];
} {
  const rows: CsvMemberRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const [index, line] of lines.entries()) {
    if (index === 0 && /email/i.test(line) && /name/i.test(line)) continue; // header
    const cells = line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const [name, email, department] = cells;
    if (!name || !email || !EMAIL_PATTERN.test(email)) {
      errors.push(`Line ${index + 1}: expected "name, email[, department]"`);
      continue;
    }
    const normalized = email.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    rows.push({
      display_name: name,
      email: normalized,
      department: department || null,
    });
  }
  return { rows, errors };
}
