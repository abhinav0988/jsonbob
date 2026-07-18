import { createId, nowIso } from "../lib/ids";

export async function setDocumentTags(
  db: D1Database,
  userId: string,
  documentId: string,
  tags: string[],
) {
  const cleaned = [
    ...new Set(
      tags
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 40),
    ),
  ].slice(0, 20);

  await db
    .prepare(`DELETE FROM document_tags WHERE user_id = ? AND document_id = ?`)
    .bind(userId, documentId)
    .run();

  const now = nowIso();
  for (const tag of cleaned) {
    await db
      .prepare(
        `INSERT INTO document_tags (user_id, document_id, tag, created_at) VALUES (?, ?, ?, ?)`,
      )
      .bind(userId, documentId, tag, now)
      .run();
  }
  return cleaned;
}

export async function getTagsForDocuments(db: D1Database, userId: string, documentIds: string[]) {
  const map: Record<string, string[]> = {};
  if (documentIds.length === 0) return map;
  for (const id of documentIds) map[id] = [];

  // D1 has limited IN binding; batch by chunks
  const chunk = 50;
  for (let i = 0; i < documentIds.length; i += chunk) {
    const slice = documentIds.slice(i, i + chunk);
    const placeholders = slice.map(() => "?").join(",");
    const rows = await db
      .prepare(
        `SELECT document_id, tag FROM document_tags
         WHERE user_id = ? AND document_id IN (${placeholders})
         ORDER BY tag`,
      )
      .bind(userId, ...slice)
      .all<{ document_id: string; tag: string }>();
    for (const r of rows.results ?? []) {
      (map[r.document_id] ??= []).push(r.tag);
    }
  }
  return map;
}

export async function getTagMap(db: D1Database, userId: string) {
  const rows = await db
    .prepare(`SELECT document_id, tag FROM document_tags WHERE user_id = ? ORDER BY tag`)
    .bind(userId)
    .all<{ document_id: string; tag: string }>();
  const map: Record<string, string[]> = {};
  for (const r of rows.results ?? []) {
    (map[r.document_id] ??= []).push(r.tag);
  }
  return map;
}

export async function setFavorite(
  db: D1Database,
  userId: string,
  documentId: string,
  favorite: boolean,
) {
  if (!favorite) {
    await db
      .prepare(`DELETE FROM document_favorites WHERE user_id = ? AND document_id = ?`)
      .bind(userId, documentId)
      .run();
    return false;
  }
  await db
    .prepare(
      `INSERT INTO document_favorites (user_id, document_id, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, document_id) DO NOTHING`,
    )
    .bind(userId, documentId, nowIso())
    .run();
  return true;
}

export async function listFavoriteIds(db: D1Database, userId: string) {
  const rows = await db
    .prepare(`SELECT document_id FROM document_favorites WHERE user_id = ?`)
    .bind(userId)
    .all<{ document_id: string }>();
  return (rows.results ?? []).map((r) => r.document_id);
}

export async function getDocumentSchema(db: D1Database, documentId: string, userId: string) {
  return db
    .prepare(
      `SELECT schema_json FROM document_schemas WHERE document_id = ? AND user_id = ?`,
    )
    .bind(documentId, userId)
    .first<{ schema_json: string }>();
}

export async function setDocumentSchema(
  db: D1Database,
  userId: string,
  documentId: string,
  schemaJson: string | null,
) {
  if (!schemaJson?.trim()) {
    await db
      .prepare(`DELETE FROM document_schemas WHERE document_id = ? AND user_id = ?`)
      .bind(documentId, userId)
      .run();
    return null;
  }
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO document_schemas (document_id, user_id, schema_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(document_id) DO UPDATE SET
         schema_json = excluded.schema_json,
         updated_at = excluded.updated_at,
         user_id = excluded.user_id`,
    )
    .bind(documentId, userId, schemaJson.trim(), now)
    .run();
  return schemaJson.trim();
}

export async function writeAudit(
  db: D1Database,
  input: {
    userId?: string | null;
    action: string;
    resourceType?: string;
    resourceId?: string;
    meta?: Record<string, unknown>;
  },
) {
  await db
    .prepare(
      `INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, meta, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      createId(),
      input.userId ?? null,
      input.action,
      input.resourceType ?? null,
      input.resourceId ?? null,
      input.meta ? JSON.stringify(input.meta) : null,
      nowIso(),
    )
    .run();
}

export async function listAudit(
  db: D1Database,
  userId: string,
  opts: { limit?: number } = {},
) {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 40));
  const rows = await db
    .prepare(
      `SELECT id, action, resource_type, resource_id, meta, created_at
       FROM audit_log WHERE user_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(userId, limit)
    .all<{
      id: string;
      action: string;
      resource_type: string | null;
      resource_id: string | null;
      meta: string | null;
      created_at: string;
    }>();
  return (rows.results ?? []).map((r) => ({
    id: r.id,
    action: r.action,
    resourceType: r.resource_type,
    resourceId: r.resource_id,
    meta: r.meta ? (JSON.parse(r.meta) as unknown) : null,
    createdAt: r.created_at,
  }));
}
