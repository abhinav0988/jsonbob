import type { PublicUser, Role, UserRow } from "../types";
import { FREE_PLAN } from "../types";
import { createId, nowIso } from "../lib/ids";
import { hashPassword, verifyPassword } from "../lib/crypto";
import { AppError } from "../lib/errors";

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    storageUsedBytes: row.storage_used_bytes,
    documentCount: row.document_count,
    createdAt: row.created_at,
  };
}

export async function findUserByEmail(db: D1Database, email: string) {
  return db
    .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .bind(email.trim().toLowerCase())
    .first<UserRow>();
}

export async function findUserById(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
}

export async function registerUser(
  db: D1Database,
  input: { name: string; email: string; password: string },
) {
  const email = input.email.trim().toLowerCase();
  const existing = await findUserByEmail(db, email);
  if (existing) {
    throw new AppError(409, "EMAIL_TAKEN", "Email is already registered");
  }

  const id = createId();
  const now = nowIso();
  const password_hash = await hashPassword(input.password);
  const role: Role = "free";

  await db.batch([
    db
      .prepare(
        `INSERT INTO users (id, name, email, password_hash, role, storage_used_bytes, document_count, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, 0, 1, ?, ?)`,
      )
      .bind(id, input.name.trim(), email, password_hash, role, now, now),
    db
      .prepare(
        `INSERT INTO user_plans (user_id, role, storage_quota_bytes, document_quota, api_rate_per_minute, max_ttl_days, version_retention, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        role,
        FREE_PLAN.storage_quota_bytes,
        FREE_PLAN.document_quota,
        FREE_PLAN.api_rate_per_minute,
        FREE_PLAN.max_ttl_days,
        FREE_PLAN.version_retention,
        now,
      ),
  ]);

  const user = await findUserById(db, id);
  if (!user) throw new AppError(500, "INTERNAL", "Failed to create user");
  return user;
}

export async function authenticateUser(db: D1Database, email: string, password: string) {
  const user = await findUserByEmail(db, email);
  if (!user || !user.password_hash || !user.is_active) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
  return user;
}

export async function updateProfile(
  db: D1Database,
  userId: string,
  input: { name?: string; password?: string; currentPassword?: string },
) {
  const user = await findUserById(db, userId);
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");

  let password_hash = user.password_hash;
  if (input.password) {
    if (!input.currentPassword || !user.password_hash) {
      throw new AppError(400, "VALIDATION_ERROR", "currentPassword is required to change password");
    }
    const ok = await verifyPassword(input.currentPassword, user.password_hash);
    if (!ok) throw new AppError(403, "FORBIDDEN", "Current password is incorrect");
    password_hash = await hashPassword(input.password);
  }

  const name = input.name?.trim() || user.name;
  const now = nowIso();
  await db
    .prepare(`UPDATE users SET name = ?, password_hash = ?, updated_at = ? WHERE id = ?`)
    .bind(name, password_hash, now, userId)
    .run();

  const updated = await findUserById(db, userId);
  if (!updated) throw new AppError(500, "INTERNAL", "Failed to update profile");
  return updated;
}
