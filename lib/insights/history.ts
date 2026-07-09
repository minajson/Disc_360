import { insightMap } from "@/data/insight-maps";
import { db } from "@/lib/mock-db/client";
import type { ArchetypeCode, DiscScores, Result } from "@/lib/types";

export interface HistoryItem {
  resultId: string;
  archetypeCode: ArchetypeCode;
  archetypeName: string;
  normalized: DiscScores;
  createdAt: string;
}

/** Newest-first assessment history for a user. */
export async function getHistory(
  userId: string,
  limit?: number,
): Promise<{ items: HistoryItem[]; total: number }> {
  const all = (await db.result.findMany({
    where: { userId },
    orderBy: { field: "createdAt", direction: "desc" },
  })) as Result[];

  const items = (limit !== undefined ? all.slice(0, limit) : all).map(
    (result) => ({
      resultId: result.id,
      archetypeCode: result.archetypeCode,
      archetypeName: insightMap[result.archetypeCode].name,
      normalized: result.normalized,
      createdAt: result.createdAt,
    }),
  );

  return { items, total: all.length };
}

/** Most recent full result for a user, or null. */
export async function getLatestResult(userId: string): Promise<Result | null> {
  const results = (await db.result.findMany({
    where: { userId },
    orderBy: { field: "createdAt", direction: "desc" },
    take: 1,
  })) as Result[];
  return results[0] ?? null;
}
