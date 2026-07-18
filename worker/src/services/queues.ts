import type { AnalyticsQueueMessage, ExpireQueueMessage } from "../types";
import { createId, nowIso } from "../lib/ids";
import { sha256Hex } from "../lib/crypto";
import type { DocumentRow } from "../types";
import { invalidateDocCache } from "./cache";

export async function enqueueExpire(env: Env, documentId: string) {
  const msg: ExpireQueueMessage = { type: "purge-document", documentId };
  await env.EXPIRE_QUEUE.send(msg);
}

export async function enqueueAnalytics(
  env: Env,
  input: Omit<AnalyticsQueueMessage, "type" | "createdAt">,
) {
  const msg: AnalyticsQueueMessage = {
    type: "request",
    createdAt: nowIso(),
    ...input,
  };
  await env.ANALYTICS_QUEUE.send(msg);
}

export async function hashIp(ip: string | null | undefined) {
  return sha256Hex(ip || "unknown").then((h) => h.slice(0, 32));
}

export async function processExpireBatch(env: Env, messages: ExpireQueueMessage[]) {
  for (const msg of messages) {
    if (msg.type !== "purge-document") continue;
    await hardPurgeDocument(env, msg.documentId);
  }
}

export async function hardPurgeDocument(env: Env, documentId: string) {
  const doc = await env.DB.prepare("SELECT * FROM documents WHERE document_id = ?")
    .bind(documentId)
    .first<DocumentRow>();
  if (!doc) return;

  const wasActive = doc.is_deleted === 0;

  const versions = await env.DB.prepare(
    "SELECT r2_key FROM document_versions WHERE document_id = ?",
  )
    .bind(documentId)
    .all<{ r2_key: string }>();

  const keys = new Set<string>([doc.r2_key, ...(versions.results ?? []).map((v) => v.r2_key)]);
  await Promise.all([...keys].map((key) => env.DOCUMENTS.delete(key)));

  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM document_versions WHERE document_id = ?").bind(documentId),
    env.DB.prepare("DELETE FROM document_stats WHERE document_id = ?").bind(documentId),
    env.DB.prepare("DELETE FROM analytics_events WHERE document_id = ?").bind(documentId),
    env.DB.prepare(
      `UPDATE documents SET is_deleted = 1, deleted_at = COALESCE(deleted_at, ?), updated_at = ? WHERE document_id = ?`,
    ).bind(now, now, documentId),
  ]);

  if (wasActive && doc.user_id) {
    await env.DB.prepare(
      `UPDATE users SET document_count = MAX(0, document_count - 1), storage_used_bytes = MAX(0, storage_used_bytes - ?), updated_at = ? WHERE id = ?`,
    )
      .bind(doc.size, now, doc.user_id)
      .run();
  }

  await invalidateDocCache(env.CACHE, documentId);
}

export async function processAnalyticsBatch(env: Env, messages: AnalyticsQueueMessage[]) {
  const stmts: D1PreparedStatement[] = [];
  const stats = new Map<string, { count: number; last: string }>();

  for (const msg of messages) {
    if (msg.type !== "request") continue;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO analytics_events
          (id, document_id, user_id, ip_hash, user_agent, method, status_code, request_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      ).bind(
        createId(),
        msg.documentId,
        msg.userId,
        msg.ipHash,
        msg.userAgent,
        msg.method,
        msg.statusCode,
        msg.createdAt,
      ),
    );
    const prev = stats.get(msg.documentId) ?? { count: 0, last: msg.createdAt };
    stats.set(msg.documentId, {
      count: prev.count + 1,
      last: msg.createdAt > prev.last ? msg.createdAt : prev.last,
    });
  }

  for (const [documentId, agg] of stats) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO document_stats (document_id, total_requests, last_accessed_at, unique_ips_approx)
         VALUES (?, ?, ?, 0)
         ON CONFLICT(document_id) DO UPDATE SET
           total_requests = total_requests + excluded.total_requests,
           last_accessed_at = excluded.last_accessed_at`,
      ).bind(documentId, agg.count, agg.last),
    );
  }

  if (stmts.length) await env.DB.batch(stmts);
}

export async function scanAndEnqueueExpired(env: Env) {
  const now = nowIso();
  const { results } = await env.DB.prepare(
    `SELECT document_id FROM documents
     WHERE is_deleted = 0 AND expire_at IS NOT NULL AND expire_at <= ?
     LIMIT 100`,
  )
    .bind(now)
    .all<{ document_id: string }>();

  for (const row of results ?? []) {
    await enqueueExpire(env, row.document_id);
  }
  return results?.length ?? 0;
}
