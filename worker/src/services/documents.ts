import type { DocumentRow, DocumentVersionRow, Visibility } from "../types";
import { ANON_LIMITS } from "../types";
import { AppError } from "../lib/errors";
import { createDocumentId, createId, nowIso, r2Key } from "../lib/ids";
import { byteSize, sanitizeJson } from "../lib/json";
import { hashPassword, verifyPassword } from "../lib/crypto";
import { invalidateDocCache } from "./cache";
import { assertExpireWithinPlan, getUserPlan } from "./plans";

export async function getDocumentByPublicId(db: D1Database, documentId: string) {
  return db
    .prepare("SELECT * FROM documents WHERE document_id = ? AND is_deleted = 0")
    .bind(documentId)
    .first<DocumentRow>();
}

export function assertNotExpired(doc: DocumentRow) {
  if (doc.expire_at && new Date(doc.expire_at).getTime() <= Date.now()) {
    throw new AppError(410, "DOCUMENT_EXPIRED", "Document has expired");
  }
}

export async function readDocumentBody(bucket: R2Bucket, doc: DocumentRow) {
  const obj = await bucket.get(doc.r2_key);
  if (!obj) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document content missing");
  const text = await obj.text();
  return JSON.parse(text) as unknown;
}

export async function createDocument(
  env: Env,
  input: {
    content: unknown;
    userId: string | null;
    visibility?: Visibility;
    name?: string | null;
    expireAt?: string | null;
    password?: string | null;
  },
) {
  const content = sanitizeJson(input.content);
  const size = byteSize(content);

  let maxSize = ANON_LIMITS.max_size_bytes as number;
  let maxTtl: number = ANON_LIMITS.max_ttl_days;
  let versionRetention = 5;

  if (input.userId) {
    const plan = await getUserPlan(env.DB, input.userId);
    maxSize = Math.min(plan.storage_quota_bytes, plan.role === "free" ? 100 * 1024 : 5 * 1024 * 1024);
    if (plan.role === "premium" || plan.role === "admin") {
      maxSize = Math.min(5 * 1024 * 1024, plan.storage_quota_bytes);
    }
    if (plan.role === "admin") maxSize = 5 * 1024 * 1024;
    maxTtl = plan.max_ttl_days;
    versionRetention = plan.version_retention;

    const user = await env.DB.prepare(
      "SELECT document_count, storage_used_bytes FROM users WHERE id = ?",
    )
      .bind(input.userId)
      .first<{ document_count: number; storage_used_bytes: number }>();
    if (!user) throw new AppError(401, "UNAUTHORIZED", "User not found");
    if (user.document_count >= plan.document_quota) {
      throw new AppError(403, "QUOTA_EXCEEDED", "Document quota exceeded");
    }
    if (user.storage_used_bytes + size > plan.storage_quota_bytes) {
      throw new AppError(403, "QUOTA_EXCEEDED", "Storage quota exceeded");
    }
  }

  if (size > maxSize) {
    throw new AppError(413, "QUOTA_EXCEEDED", `Document exceeds maximum size of ${maxSize} bytes`);
  }
  assertExpireWithinPlan(input.expireAt, maxTtl);

  const visibility: Visibility = input.visibility ?? "public";
  if (visibility === "private" && !input.userId) {
    throw new AppError(400, "VALIDATION_ERROR", "Private documents require authentication");
  }
  if (visibility === "password" && !input.password) {
    throw new AppError(400, "VALIDATION_ERROR", "Password is required for password visibility");
  }
  if (visibility === "password" && !input.userId) {
    throw new AppError(400, "VALIDATION_ERROR", "Password documents require authentication");
  }

  const id = createId();
  const documentId = createDocumentId();
  const now = nowIso();
  const key = r2Key(input.userId, documentId);
  const password_hash = input.password ? await hashPassword(input.password) : null;

  await env.DOCUMENTS.put(key, JSON.stringify(content), {
    httpMetadata: { contentType: "application/json" },
  });

  await env.DB.prepare(
    `INSERT INTO documents
      (id, document_id, user_id, name, visibility, password_hash, r2_key, size, content_type, expire_at, version, is_deleted, created_at, updated_at, content_preview)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'application/json', ?, 1, 0, ?, ?, ?)`,
  )
    .bind(
      id,
      documentId,
      input.userId,
      input.name ?? null,
      visibility,
      password_hash,
      key,
      size,
      input.expireAt ?? null,
      now,
      now,
      JSON.stringify(content).slice(0, 8000),
    )
    .run();

  const vKey = r2Key(input.userId, documentId, 1);
  await env.DOCUMENTS.put(vKey, JSON.stringify(content), {
    httpMetadata: { contentType: "application/json" },
  });
  await env.DB.prepare(
    `INSERT INTO document_versions (id, document_id, version, r2_key, size, created_by, created_at)
     VALUES (?, ?, 1, ?, ?, ?, ?)`,
  )
    .bind(createId(), documentId, vKey, size, input.userId, now)
    .run();

  if (input.userId) {
    await env.DB.prepare(
      `UPDATE users SET document_count = document_count + 1, storage_used_bytes = storage_used_bytes + ?, updated_at = ? WHERE id = ?`,
    )
      .bind(size, now, input.userId)
      .run();
  }

  void versionRetention;

  return {
    id: documentId,
    url: `${env.APP_URL}/view/${documentId}`,
    apiUrl: `${env.API_URL}/json/${documentId}`,
    visibility,
    size,
    version: 1,
    createdAt: now,
  };
}

export async function listUserDocuments(
  db: D1Database,
  userId: string,
  opts: {
    search?: string;
    page: number;
    limit: number;
    visibility?: string;
    from?: string;
    to?: string;
    folder?: string;
    tag?: string;
    favorite?: boolean;
  },
) {
  const offset = (opts.page - 1) * opts.limit;
  const clauses = ["d.user_id = ?", "d.is_deleted = 0"];
  const binds: unknown[] = [userId];

  if (opts.search?.trim()) {
    clauses.push(
      "(d.document_id LIKE ? OR IFNULL(d.name, '') LIKE ? OR IFNULL(d.content_preview, '') LIKE ?)",
    );
    const like = `%${opts.search.trim()}%`;
    binds.push(like, like, like);
  }
  if (opts.visibility) {
    clauses.push("d.visibility = ?");
    binds.push(opts.visibility);
  }
  if (opts.from) {
    clauses.push("d.created_at >= ?");
    binds.push(opts.from);
  }
  if (opts.to) {
    clauses.push("d.created_at <= ?");
    binds.push(opts.to);
  }
  if (opts.folder === "__none__") {
    clauses.push(
      `NOT EXISTS (SELECT 1 FROM document_folders f WHERE f.document_id = d.document_id AND f.user_id = ?)`,
    );
    binds.push(userId);
  } else if (opts.folder?.trim()) {
    clauses.push(
      `EXISTS (SELECT 1 FROM document_folders f WHERE f.document_id = d.document_id AND f.user_id = ? AND f.folder = ?)`,
    );
    binds.push(userId, opts.folder.trim());
  }
  if (opts.tag?.trim()) {
    clauses.push(
      `EXISTS (SELECT 1 FROM document_tags t WHERE t.document_id = d.document_id AND t.user_id = ? AND t.tag = ?)`,
    );
    binds.push(userId, opts.tag.trim().toLowerCase());
  }
  if (opts.favorite) {
    clauses.push(
      `EXISTS (SELECT 1 FROM document_favorites fav WHERE fav.document_id = d.document_id AND fav.user_id = ?)`,
    );
    binds.push(userId);
  }

  binds.push(opts.limit, offset);
  const { results } = await db
    .prepare(
      `SELECT d.* FROM documents d WHERE ${clauses.join(" AND ")}
       ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
    )
    .bind(...binds)
    .all<DocumentRow>();
  return results ?? [];
}

export async function updateDocumentContent(
  env: Env,
  doc: DocumentRow,
  content: unknown,
  userId: string | null,
) {
  const sanitized = sanitizeJson(content);
  const size = byteSize(sanitized);
  const now = nowIso();
  const nextVersion = doc.version + 1;

  await env.DOCUMENTS.put(doc.r2_key, JSON.stringify(sanitized), {
    httpMetadata: { contentType: "application/json" },
  });

  const vKey = r2Key(doc.user_id, doc.document_id, nextVersion);
  await env.DOCUMENTS.put(vKey, JSON.stringify(sanitized), {
    httpMetadata: { contentType: "application/json" },
  });

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE documents SET size = ?, version = ?, updated_at = ?, content_preview = ? WHERE document_id = ?`,
    ).bind(size, nextVersion, now, JSON.stringify(sanitized).slice(0, 8000), doc.document_id),
    env.DB.prepare(
      `INSERT INTO document_versions (id, document_id, version, r2_key, size, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(createId(), doc.document_id, nextVersion, vKey, size, userId, now),
  ]);

  if (doc.user_id) {
    const plan = await getUserPlan(env.DB, doc.user_id);
    await pruneOldVersions(env, doc.document_id, plan.version_retention);
    const delta = size - doc.size;
    await env.DB.prepare(
      `UPDATE users SET storage_used_bytes = MAX(0, storage_used_bytes + ?), updated_at = ? WHERE id = ?`,
    )
      .bind(delta, now, doc.user_id)
      .run();
  }

  await invalidateDocCache(env.CACHE, doc.document_id);
  return nextVersion;
}

async function pruneOldVersions(env: Env, documentId: string, keep: number) {
  const { results } = await env.DB.prepare(
    `SELECT id, r2_key, version FROM document_versions
     WHERE document_id = ? ORDER BY version DESC`,
  )
    .bind(documentId)
    .all<{ id: string; r2_key: string; version: number }>();

  const extra = (results ?? []).slice(keep);
  for (const row of extra) {
    await env.DOCUMENTS.delete(row.r2_key);
    await env.DB.prepare("DELETE FROM document_versions WHERE id = ?").bind(row.id).run();
  }
}

export async function softDeleteDocument(env: Env, doc: DocumentRow) {
  const now = nowIso();
  await env.DB.prepare(
    `UPDATE documents SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE document_id = ?`,
  )
    .bind(now, now, doc.document_id)
    .run();

  if (doc.user_id) {
    await env.DB.prepare(
      `UPDATE users SET document_count = MAX(0, document_count - 1), storage_used_bytes = MAX(0, storage_used_bytes - ?), updated_at = ? WHERE id = ?`,
    )
      .bind(doc.size, now, doc.user_id)
      .run();
  }

  await invalidateDocCache(env.CACHE, doc.document_id);
}

export async function listDeletedDocuments(db: D1Database, userId: string) {
  const { results } = await db
    .prepare(
      `SELECT * FROM documents
       WHERE is_deleted = 1 AND user_id = ?
       ORDER BY deleted_at DESC, updated_at DESC`,
    )
    .bind(userId)
    .all<DocumentRow>();
  return results ?? [];
}

async function getDeletedDocumentForUser(
  db: D1Database,
  documentId: string,
  userId: string,
) {
  return db
    .prepare(
      `SELECT * FROM documents WHERE document_id = ? AND user_id = ? AND is_deleted = 1`,
    )
    .bind(documentId, userId)
    .first<DocumentRow>();
}

export async function restoreDocument(env: Env, documentId: string, userId: string) {
  const doc = await getDeletedDocumentForUser(env.DB, documentId, userId);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Deleted document not found");

  const plan = await getUserPlan(env.DB, userId);
  const user = await env.DB.prepare(
    "SELECT document_count, storage_used_bytes FROM users WHERE id = ?",
  )
    .bind(userId)
    .first<{ document_count: number; storage_used_bytes: number }>();
  if (!user) throw new AppError(401, "UNAUTHORIZED", "User not found");
  if (user.document_count >= plan.document_quota) {
    throw new AppError(403, "QUOTA_EXCEEDED", "Document quota exceeded");
  }
  if (user.storage_used_bytes + doc.size > plan.storage_quota_bytes) {
    throw new AppError(403, "QUOTA_EXCEEDED", "Storage quota exceeded");
  }

  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE documents SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE document_id = ? AND user_id = ?`,
    ).bind(now, documentId, userId),
    env.DB.prepare(
      `UPDATE users SET document_count = document_count + 1, storage_used_bytes = storage_used_bytes + ?, updated_at = ? WHERE id = ?`,
    ).bind(doc.size, now, userId),
  ]);

  await invalidateDocCache(env.CACHE, documentId);
  return getDocumentByPublicId(env.DB, documentId);
}

export async function purgeDocument(env: Env, documentId: string, userId: string) {
  const doc = await getDeletedDocumentForUser(env.DB, documentId, userId);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Deleted document not found");

  const versions = await env.DB.prepare(
    "SELECT r2_key FROM document_versions WHERE document_id = ?",
  )
    .bind(documentId)
    .all<{ r2_key: string }>();

  const keys = new Set<string>([doc.r2_key, ...(versions.results ?? []).map((v) => v.r2_key)]);
  await Promise.all([...keys].map((key) => env.DOCUMENTS.delete(key)));

  await env.DB.batch([
    env.DB.prepare("DELETE FROM document_tags WHERE document_id = ?").bind(documentId),
    env.DB.prepare("DELETE FROM document_favorites WHERE document_id = ?").bind(documentId),
    env.DB.prepare("DELETE FROM document_schemas WHERE document_id = ?").bind(documentId),
    env.DB.prepare("DELETE FROM document_folders WHERE document_id = ?").bind(documentId),
    env.DB.prepare("DELETE FROM one_time_tokens WHERE document_id = ?").bind(documentId),
    env.DB.prepare("DELETE FROM document_versions WHERE document_id = ?").bind(documentId),
    env.DB.prepare("DELETE FROM document_stats WHERE document_id = ?").bind(documentId),
    env.DB.prepare("DELETE FROM analytics_events WHERE document_id = ?").bind(documentId),
    env.DB.prepare(
      "DELETE FROM documents WHERE document_id = ? AND user_id = ? AND is_deleted = 1",
    ).bind(documentId, userId),
  ]);

  await invalidateDocCache(env.CACHE, documentId);
}

export async function patchDocumentMeta(
  env: Env,
  doc: DocumentRow,
  patch: {
    name?: string | null;
    visibility?: Visibility;
    expireAt?: string | null;
    password?: string | null;
  },
) {
  if (doc.user_id) {
    const plan = await getUserPlan(env.DB, doc.user_id);
    assertExpireWithinPlan(patch.expireAt, plan.max_ttl_days);
  }

  let password_hash = doc.password_hash;
  if (patch.visibility === "password" && patch.password) {
    password_hash = await hashPassword(patch.password);
  }
  if (patch.visibility && patch.visibility !== "password") {
    password_hash = null;
  }

  const now = nowIso();
  await env.DB.prepare(
    `UPDATE documents SET
      name = COALESCE(?, name),
      visibility = COALESCE(?, visibility),
      expire_at = CASE WHEN ? IS NOT NULL THEN ? ELSE expire_at END,
      password_hash = ?,
      updated_at = ?
     WHERE document_id = ?`,
  )
    .bind(
      patch.name === undefined ? null : patch.name,
      patch.visibility ?? null,
      patch.expireAt === undefined ? null : "set",
      patch.expireAt === undefined ? doc.expire_at : patch.expireAt,
      password_hash,
      now,
      doc.document_id,
    )
    .run();

  await invalidateDocCache(env.CACHE, doc.document_id);
}

export async function listVersions(db: D1Database, documentId: string) {
  const { results } = await db
    .prepare(
      `SELECT id, document_id, version, size, created_by, created_at, r2_key
       FROM document_versions WHERE document_id = ? ORDER BY version DESC`,
    )
    .bind(documentId)
    .all<DocumentVersionRow>();
  return results ?? [];
}

export async function getVersionContent(env: Env, documentId: string, version: number) {
  const row = await env.DB.prepare(
    `SELECT * FROM document_versions WHERE document_id = ? AND version = ?`,
  )
    .bind(documentId, version)
    .first<DocumentVersionRow>();
  if (!row) throw new AppError(404, "NOT_FOUND", "Version not found");
  const obj = await env.DOCUMENTS.get(row.r2_key);
  if (!obj) throw new AppError(404, "NOT_FOUND", "Version content missing");
  return { meta: row, content: JSON.parse(await obj.text()) as unknown };
}

export async function restoreVersion(
  env: Env,
  doc: DocumentRow,
  version: number,
  userId: string,
) {
  const { content } = await getVersionContent(env, doc.document_id, version);
  return updateDocumentContent(env, doc, content, userId);
}

export async function assertCanAccessDocument(
  doc: DocumentRow,
  userId: string | undefined,
  passwordHeader: string | undefined,
) {
  assertNotExpired(doc);

  if (doc.visibility === "public") return;

  if (doc.visibility === "private") {
    if (!userId || userId !== doc.user_id) {
      throw new AppError(403, "FORBIDDEN", "Private document");
    }
    return;
  }

  if (doc.visibility === "password") {
    if (userId && userId === doc.user_id) return;
    if (!passwordHeader || !doc.password_hash) {
      throw new AppError(401, "UNAUTHORIZED", "Password required");
    }
    const ok = await verifyPassword(passwordHeader, doc.password_hash);
    if (!ok) throw new AppError(403, "FORBIDDEN", "Invalid document password");
  }
}

export function mapDocumentSummary(doc: DocumentRow, env: Env) {
  return {
    id: doc.document_id,
    name: doc.name,
    visibility: doc.visibility,
    size: doc.size,
    version: doc.version,
    expireAt: doc.expire_at,
    deletedAt: doc.deleted_at,
    url: `${env.APP_URL}/view/${doc.document_id}`,
    apiUrl: `${env.API_URL}/json/${doc.document_id}`,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}
