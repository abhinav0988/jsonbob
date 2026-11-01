/**
 * Daily D1 rows_read budget for the free-tier account cap (5M/day shared).
 * Soft limit → skip cron/queue drain that would keep scanning.
 * Hard limit → 503 API responses (health/ready stay up).
 *
 * Counter lives in CACHE KV so we don't need an extra D1 migration.
 */
export const D1_ACCOUNT_DAILY_CAP = 5_000_000;
export const D1_DEFAULT_HARD_LIMIT = 2_000_000;
export const D1_DEFAULT_SOFT_LIMIT = 1_500_000;

const COUNTER_PREFIX = "d1:rows_read:";
const ORIG = Symbol("d1BudgetOrig");

export type D1BudgetOptions = {
  hardLimit?: number;
  softLimit?: number;
};

export type D1BudgetEnv = {
  DB: D1Database;
  CACHE: KVNamespace;
  D1_DAILY_ROWS_READ_LIMIT?: string;
};

export type D1BudgetSession<E extends D1BudgetEnv> = {
  env: E;
  pending: number;
  hardLimit: number;
  softLimit: number;
  flush: () => Promise<void>;
  getUsage: () => Promise<number>;
  isOverHardLimit: () => Promise<boolean>;
  isOverSoftLimit: () => Promise<boolean>;
};

const utcDay = (nowMs = Date.now()) => new Date(nowMs).toISOString().slice(0, 10);

const endOfUtcDayMs = (nowMs = Date.now()) => {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
};

const parseLimit = (raw: string | undefined, fallback: number) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

export function resolveLimits(env: { D1_DAILY_ROWS_READ_LIMIT?: string }, opts?: D1BudgetOptions) {
  const hardLimit = opts?.hardLimit ?? parseLimit(env.D1_DAILY_ROWS_READ_LIMIT, D1_DEFAULT_HARD_LIMIT);
  const softLimit = opts?.softLimit ?? Math.min(D1_DEFAULT_SOFT_LIMIT, Math.floor(hardLimit * 0.75));
  return { hardLimit, softLimit };
}

async function readCounter(cache: KVNamespace, nowMs = Date.now()) {
  return Number((await cache.get(`${COUNTER_PREFIX}${utcDay(nowMs)}`)) || "0") || 0;
}

async function addCounter(cache: KVNamespace, delta: number, nowMs = Date.now()) {
  if (delta <= 0) return;
  const key = `${COUNTER_PREFIX}${utcDay(nowMs)}`;
  const current = await readCounter(cache, nowMs);
  const ttl = Math.max(60, Math.ceil((endOfUtcDayMs(nowMs) - nowMs) / 1000));
  await cache.put(key, String(current + delta), { expirationTtl: ttl });
}

function unwrapStmt(stmt: D1PreparedStatement): D1PreparedStatement {
  const orig = (stmt as D1PreparedStatement & { [ORIG]?: D1PreparedStatement })[ORIG];
  return orig ?? stmt;
}

function trackPrepared(stmt: D1PreparedStatement, sink: { add(n: number): void }): D1PreparedStatement {
  const wrapped = {
    [ORIG]: unwrapStmt(stmt),
    bind(...values: unknown[]) {
      return trackPrepared(unwrapStmt(stmt).bind(...values), sink);
    },
    async first<T = unknown>(colName?: string) {
      const result = await unwrapStmt(stmt).all<T>();
      sink.add(result.meta?.rows_read ?? 0);
      const row = result.results?.[0];
      if (row == null) return null;
      if (colName) return (row as Record<string, unknown>)[colName] as T;
      return row as T;
    },
    async run<T = Record<string, unknown>>() {
      const result = await unwrapStmt(stmt).run<T>();
      sink.add(result.meta?.rows_read ?? 0);
      return result;
    },
    async all<T = Record<string, unknown>>() {
      const result = await unwrapStmt(stmt).all<T>();
      sink.add(result.meta?.rows_read ?? 0);
      return result;
    },
    raw<T = unknown[]>(options?: { columnNames?: boolean }) {
      return unwrapStmt(stmt).raw<T>(options);
    },
  };
  return wrapped as unknown as D1PreparedStatement;
}

export function trackD1(db: D1Database, sink: { add(n: number): void }): D1Database {
  return {
    prepare(query: string) {
      return trackPrepared(db.prepare(query), sink);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]) {
      const results = await db.batch<T>(statements.map(unwrapStmt));
      for (const result of results) sink.add(result.meta?.rows_read ?? 0);
      return results;
    },
    async exec(query: string) {
      return db.exec(query);
    },
    withSession(constraintOrBookmark?: D1SessionBookmark | D1SessionConstraint) {
      return trackD1(db.withSession(constraintOrBookmark) as unknown as D1Database, sink) as unknown as D1DatabaseSession;
    },
  } as D1Database;
}

export function attachD1Budget<E extends D1BudgetEnv>(env: E, opts?: D1BudgetOptions): D1BudgetSession<E> {
  const { hardLimit, softLimit } = resolveLimits(env, opts);
  const rawDb = env.DB;
  const cache = env.CACHE;
  let pending = 0;
  const sink = {
    add(n: number) {
      if (n > 0) pending += n;
    },
  };
  const tracked = trackD1(rawDb, sink);
  return {
    env: { ...env, DB: tracked },
    get pending() {
      return pending;
    },
    hardLimit,
    softLimit,
    async flush() {
      const delta = pending;
      pending = 0;
      await addCounter(cache, delta);
    },
    getUsage: () => readCounter(cache),
    async isOverHardLimit() {
      return (await readCounter(cache)) >= hardLimit;
    },
    async isOverSoftLimit() {
      return (await readCounter(cache)) >= softLimit;
    },
  };
}

export function d1BudgetRetryAfterSec(nowMs = Date.now()) {
  return Math.max(1, Math.ceil((endOfUtcDayMs(nowMs) - nowMs) / 1000));
}

export function isD1BudgetExemptPath(pathname: string) {
  return (
    pathname === "/health" ||
    pathname === "/ready" ||
    pathname === "/api-docs" ||
    pathname.startsWith("/api-docs/")
  );
}
