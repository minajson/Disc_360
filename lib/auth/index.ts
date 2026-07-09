import { db } from "@/lib/mock-db/client";
import { seedData } from "@/lib/mock-db/seed";
import type { User } from "@/lib/types";

/**
 * Auth stub — returns the seeded demo user.
 * Replace with a real NextAuth session lookup later; the call sites
 * (API routes and Server Components) will not need to change.
 */
export async function getCurrentUser(): Promise<User> {
  const user = (await db.user.findUnique({
    where: { id: seedData.user.id },
  })) as User | null;
  return user ?? seedData.user;
}
