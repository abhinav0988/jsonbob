import { createId, nowIso } from "../lib/ids";
import { AppError } from "../lib/errors";

export async function setDocumentFolder(
  db: D1Database,
  userId: string,
  documentId: string,
  folder: string | null,
) {
  if (!folder?.trim()) {
    await db
      .prepare(`DELETE FROM document_folders WHERE document_id = ? AND user_id = ?`)
      .bind(documentId, userId)
      .run();
    return;
  }
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO document_folders (document_id, user_id, folder, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(document_id) DO UPDATE SET folder = excluded.folder, updated_at = excluded.updated_at, user_id = excluded.user_id`,
    )
    .bind(documentId, userId, folder.trim(), now)
    .run();
}

export async function listFolders(db: D1Database, userId: string) {
  const rows = await db
    .prepare(
      `SELECT folder, COUNT(*) as c FROM document_folders WHERE user_id = ? GROUP BY folder ORDER BY folder`,
    )
    .bind(userId)
    .all<{ folder: string; c: number }>();
  return rows.results ?? [];
}

export async function getFolderMap(db: D1Database, userId: string) {
  const rows = await db
    .prepare(`SELECT document_id, folder FROM document_folders WHERE user_id = ?`)
    .bind(userId)
    .all<{ document_id: string; folder: string }>();
  const map: Record<string, string> = {};
  for (const r of rows.results ?? []) map[r.document_id] = r.folder;
  return map;
}

export async function createOneTimeToken(
  db: D1Database,
  documentId: string,
  userId: string | null,
) {
  const token = `ot_${createId().replace(/-/g, "").slice(0, 20)}`;
  await db
    .prepare(
      `INSERT INTO one_time_tokens (token, document_id, user_id, created_at, used_at)
       VALUES (?, ?, ?, ?, NULL)`,
    )
    .bind(token, documentId, userId, nowIso())
    .run();
  return token;
}

/** Consume burn-after-read token. Returns document_id once. */
export async function consumeOneTimeToken(db: D1Database, token: string) {
  const row = await db
    .prepare(`SELECT token, document_id, used_at FROM one_time_tokens WHERE token = ?`)
    .bind(token)
    .first<{ token: string; document_id: string; used_at: string | null }>();
  if (!row) throw new AppError(404, "NOT_FOUND", "Invalid or expired one-time link");
  if (row.used_at) throw new AppError(410, "GONE", "One-time link already used");
  await db
    .prepare(`UPDATE one_time_tokens SET used_at = ? WHERE token = ?`)
    .bind(nowIso(), token)
    .run();
  return row.document_id;
}
