import type { Role, UserPlanRow } from "../types";
import { ADMIN_PLAN, FREE_PLAN, PREMIUM_PLAN } from "../types";
import { nowIso } from "../lib/ids";
import { AppError } from "../lib/errors";

export function planDefaults(role: Role) {
  if (role === "admin") return ADMIN_PLAN;
  if (role === "premium") return PREMIUM_PLAN;
  return FREE_PLAN;
}

export async function getUserPlan(db: D1Database, userId: string): Promise<UserPlanRow> {
  const plan = await db
    .prepare("SELECT * FROM user_plans WHERE user_id = ?")
    .bind(userId)
    .first<UserPlanRow>();
  if (plan) return plan;

  const user = await db
    .prepare("SELECT role FROM users WHERE id = ?")
    .bind(userId)
    .first<{ role: Role }>();
  const role = user?.role ?? "free";
  const defaults = planDefaults(role);
  const updated_at = nowIso();
  await db
    .prepare(
      `INSERT OR REPLACE INTO user_plans
        (user_id, role, storage_quota_bytes, document_quota, api_rate_per_minute, max_ttl_days, version_retention, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      userId,
      role,
      defaults.storage_quota_bytes,
      defaults.document_quota,
      defaults.api_rate_per_minute,
      defaults.max_ttl_days,
      defaults.version_retention,
      updated_at,
    )
    .run();

  return {
    user_id: userId,
    role,
    ...defaults,
    updated_at,
  };
}

export async function upsertPlanForRole(db: D1Database, userId: string, role: Role) {
  const defaults = planDefaults(role);
  const updated_at = nowIso();
  await db
    .prepare(
      `INSERT OR REPLACE INTO user_plans
        (user_id, role, storage_quota_bytes, document_quota, api_rate_per_minute, max_ttl_days, version_retention, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      userId,
      role,
      defaults.storage_quota_bytes,
      defaults.document_quota,
      defaults.api_rate_per_minute,
      defaults.max_ttl_days,
      defaults.version_retention,
      updated_at,
    )
    .run();
}

export function assertExpireWithinPlan(expireAt: string | null | undefined, maxTtlDays: number) {
  if (!expireAt) return;
  const ms = new Date(expireAt).getTime() - Date.now();
  if (Number.isNaN(ms) || ms < 0) {
    throw new AppError(400, "VALIDATION_ERROR", "expireAt must be in the future");
  }
  const maxMs = maxTtlDays * 24 * 60 * 60 * 1000;
  if (ms > maxMs) {
    throw new AppError(403, "QUOTA_EXCEEDED", `Expiry exceeds plan max TTL of ${maxTtlDays} days`);
  }
}
