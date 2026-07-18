import { sha256Hex } from "../lib/crypto";
import { AppError } from "../lib/errors";
import { createId, nowIso } from "../lib/ids";
import type { Role } from "../types";

/** Stored as `${sha256Hex}:${prefix}` so list can show prefix without a DB column. */
export type ApiKeyRow = {
  key_id: string;
  user_id: string;
  key_hash: string;
  name: string | null;
  last_used_at: string | null;
  created_at: string;
  revoked: number;
};

const KEY_SECRET_LEN = 32;
const PREFIX_LEN = 11; // "jb_" + 8 chars

function packKeyHash(hashHex: string, prefix: string) {
  return `${hashHex}:${prefix}`;
}

export function unpackKeyHash(stored: string): { hashHex: string; prefix: string } {
  const idx = stored.indexOf(":");
  if (idx === -1) return { hashHex: stored, prefix: "jb_********" };
  return { hashHex: stored.slice(0, idx), prefix: stored.slice(idx + 1) };
}

function generateRawKey(): { raw: string; prefix: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(KEY_SECRET_LEN));
  const secret = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const raw = `jb_${secret}`;
  return { raw, prefix: raw.slice(0, PREFIX_LEN) };
}

export function mapApiKeyPublic(row: ApiKeyRow) {
  const { prefix } = unpackKeyHash(row.key_hash);
  return {
    id: row.key_id,
    name: row.name,
    prefix,
    created_at: row.created_at,
    last_used_at: row.last_used_at,
  };
}

export async function listApiKeys(db: D1Database, userId: string) {
  const { results } = await db
    .prepare(
      `SELECT key_id, user_id, key_hash, name, last_used_at, created_at, revoked
       FROM api_keys
       WHERE user_id = ? AND revoked = 0
       ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<ApiKeyRow>();
  return (results ?? []).map(mapApiKeyPublic);
}

export async function createApiKey(
  db: D1Database,
  userId: string,
  name?: string | null,
) {
  const keyId = createId();
  const now = nowIso();
  const { raw, prefix } = generateRawKey();
  const hashHex = await sha256Hex(raw);
  const stored = packKeyHash(hashHex, prefix);

  await db
    .prepare(
      `INSERT INTO api_keys (key_id, user_id, key_hash, name, last_used_at, created_at, revoked)
       VALUES (?, ?, ?, ?, NULL, ?, 0)`,
    )
    .bind(keyId, userId, stored, name ?? null, now)
    .run();

  return {
    id: keyId,
    key: raw,
    name: name ?? null,
    prefix,
  };
}

export async function revokeApiKey(db: D1Database, keyId: string, userId: string) {
  const existing = await db
    .prepare(
      `SELECT key_id FROM api_keys WHERE key_id = ? AND user_id = ? AND revoked = 0`,
    )
    .bind(keyId, userId)
    .first<{ key_id: string }>();
  if (!existing) throw new AppError(404, "NOT_FOUND", "API key not found");

  await db
    .prepare(`UPDATE api_keys SET revoked = 1 WHERE key_id = ? AND user_id = ?`)
    .bind(keyId, userId)
    .run();
}

export async function findUserByApiKey(
  db: D1Database,
  rawKey: string,
): Promise<{ id: string; email: string; role: Role } | null> {
  if (!rawKey.startsWith("jb_")) return null;
  const hashHex = await sha256Hex(rawKey);
  const row = await db
    .prepare(
      `SELECT k.key_id, k.key_hash, u.id, u.email, u.role, u.is_active
       FROM api_keys k
       JOIN users u ON u.id = k.user_id
       WHERE k.revoked = 0 AND (k.key_hash = ? OR k.key_hash LIKE ?)`,
    )
    .bind(hashHex, `${hashHex}:%`)
    .first<{
      key_id: string;
      key_hash: string;
      id: string;
      email: string;
      role: Role;
      is_active: number;
    }>();

  if (!row || !row.is_active) return null;

  const { hashHex: storedHash } = unpackKeyHash(row.key_hash);
  if (storedHash !== hashHex) return null;

  await db
    .prepare(`UPDATE api_keys SET last_used_at = ? WHERE key_id = ?`)
    .bind(nowIso(), row.key_id)
    .run();

  return { id: row.id, email: row.email, role: row.role };
}
