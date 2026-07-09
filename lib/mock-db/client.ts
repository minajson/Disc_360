import { promises as fs } from "fs";
import path from "path";
import type {
  Answer,
  AssessmentSession,
  Result,
  Team,
  TeamMember,
  User,
} from "@/lib/types";
import { seedData } from "@/lib/mock-db/seed";

/**
 * Prisma-shaped JSON-file mock database.
 *
 * - In-memory Maps are the source of truth at runtime.
 * - Every mutation schedules a debounced write-through to .mockdb/db.json
 *   so state survives dev-server restarts.
 * - Stored on globalThis so Next.js hot reload reuses one instance —
 *   the same pattern used for real Prisma clients.
 *
 * Swapping to real Prisma later should only touch lib/mock-db.
 */

interface Tables {
  user: Map<string, User>;
  assessmentSession: Map<string, AssessmentSession>;
  answer: Map<string, Answer>;
  result: Map<string, Result>;
  team: Map<string, Team>;
  teamMember: Map<string, TeamMember>;
}

type TableName = keyof Tables;
type RowOf<T extends TableName> = Tables[T] extends Map<string, infer R>
  ? R
  : never;

const DB_DIR = path.join(process.cwd(), ".mockdb");
const DB_FILE = path.join(DB_DIR, "db.json");
const FLUSH_DELAY_MS = 150;

type SerializedTables = { [K in TableName]?: RowOf<K>[] };

class MockDb {
  private tables: Tables = {
    user: new Map(),
    assessmentSession: new Map(),
    answer: new Map(),
    result: new Map(),
    team: new Map(),
    teamMember: new Map(),
  };

  private loaded: Promise<void> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  /** Lazily load the JSON snapshot (or seed on first run). */
  private ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      this.loaded = this.loadFromDisk();
    }
    return this.loaded;
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const raw = await fs.readFile(DB_FILE, "utf8");
      const parsed = JSON.parse(raw) as SerializedTables;
      for (const name of Object.keys(this.tables) as TableName[]) {
        const rows = parsed[name] ?? [];
        const table = this.tables[name] as Map<string, { id: string }>;
        table.clear();
        for (const row of rows) table.set(row.id, row);
      }
    } catch {
      // First run (or corrupted snapshot): start from seed data.
      this.applySeed();
      this.scheduleFlush();
    }
    // Seed rows must always exist, even against an older snapshot.
    if (!this.tables.user.has(seedData.user.id)) {
      this.applySeed();
      this.scheduleFlush();
    }
  }

  private applySeed(): void {
    this.tables.user.set(seedData.user.id, seedData.user);
    this.tables.team.set(seedData.team.id, seedData.team);
    for (const result of seedData.results) {
      this.tables.result.set(result.id, result);
    }
    for (const member of seedData.teamMembers) {
      this.tables.teamMember.set(member.id, member);
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      void this.flush();
    }, FLUSH_DELAY_MS);
  }

  private async flush(): Promise<void> {
    const snapshot: SerializedTables = {};
    for (const name of Object.keys(this.tables) as TableName[]) {
      snapshot[name] = [...this.tables[name].values()] as never;
    }
    try {
      await fs.mkdir(DB_DIR, { recursive: true });
      await fs.writeFile(DB_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    } catch (error) {
      console.error("[mock-db] failed to persist snapshot", error);
    }
  }

  /** Prisma-like accessor for one table. */
  table<T extends TableName>(name: T) {
    const ensureLoaded = () => this.ensureLoaded();
    const scheduleFlush = () => this.scheduleFlush();

    type Row = RowOf<T> & { id: string };
    const table = this.tables[name] as unknown as Map<string, Row>;

    return {
      async create(args: { data: Row }): Promise<Row> {
        await ensureLoaded();
        table.set(args.data.id, args.data);
        scheduleFlush();
        return args.data;
      },

      async findUnique(args: { where: { id: string } }): Promise<Row | null> {
        await ensureLoaded();
        return table.get(args.where.id) ?? null;
      },

      async findMany(args?: {
        where?: Partial<Row>;
        orderBy?: { field: keyof Row & string; direction: "asc" | "desc" };
        take?: number;
      }): Promise<Row[]> {
        await ensureLoaded();
        let rows = [...table.values()];
        const where = args?.where;
        if (where) {
          rows = rows.filter((row) =>
            Object.entries(where).every(
              ([key, value]) => row[key as keyof Row] === value,
            ),
          );
        }
        const orderBy = args?.orderBy;
        if (orderBy) {
          rows.sort((a, b) => {
            const av = a[orderBy.field];
            const bv = b[orderBy.field];
            if (av === bv) return 0;
            const cmp = av < bv ? -1 : 1;
            return orderBy.direction === "asc" ? cmp : -cmp;
          });
        }
        if (args?.take !== undefined) rows = rows.slice(0, args.take);
        return rows;
      },

      async update(args: {
        where: { id: string };
        data: Partial<Row>;
      }): Promise<Row> {
        await ensureLoaded();
        const existing = table.get(args.where.id);
        if (!existing) {
          throw new Error(`[mock-db] ${name} ${args.where.id} not found`);
        }
        const updated = { ...existing, ...args.data };
        table.set(args.where.id, updated);
        scheduleFlush();
        return updated;
      },

      async delete(args: { where: { id: string } }): Promise<void> {
        await ensureLoaded();
        table.delete(args.where.id);
        scheduleFlush();
      },
    };
  }
}

function buildClient() {
  const store = new MockDb();
  return {
    user: store.table("user"),
    assessmentSession: store.table("assessmentSession"),
    answer: store.table("answer"),
    result: store.table("result"),
    team: store.table("team"),
    teamMember: store.table("teamMember"),
  };
}

const globalForDb = globalThis as unknown as {
  __disc360Db?: ReturnType<typeof buildClient>;
};

export const db = globalForDb.__disc360Db ?? buildClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__disc360Db = db;
}
