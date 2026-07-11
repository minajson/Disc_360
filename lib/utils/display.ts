import type { ArchetypeCode } from "@/lib/types";

/**
 * User-facing archetype code. The internal Analytical key stays "C";
 * displayed hybrid blends render it as "A" (DC → DA, CS → AS, C → A).
 */
export function displayArchetypeCode(code: ArchetypeCode): string {
  if (code === "BAL") return "BAL";
  return code.replaceAll("C", "A");
}
