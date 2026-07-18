import { Hono } from "hono";
import { AppError } from "../lib/errors";
import type { AppBindings } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { getDocumentByPublicId } from "../services/documents";
import { findUserById } from "../services/users";
import { getUserPlan } from "../services/plans";

export const analyticsRoutes = new Hono<AppBindings>();

analyticsRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const row = await findUserById(c.env.DB, user.sub);
  if (!row) throw new AppError(404, "NOT_FOUND", "User not found");
  const plan = await getUserPlan(c.env.DB, user.sub);

  const recent = await c.env.DB.prepare(
    `SELECT document_id, name, visibility, size, version, created_at, updated_at
     FROM documents WHERE user_id = ? AND is_deleted = 0
     ORDER BY updated_at DESC LIMIT 5`,
  )
    .bind(user.sub)
    .all();

  const reqCount = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(s.total_requests), 0) as total
     FROM document_stats s
     INNER JOIN documents d ON d.document_id = s.document_id
     WHERE d.user_id = ? AND d.is_deleted = 0`,
  )
    .bind(user.sub)
    .first<{ total: number }>();

  return c.json({
    totalDocuments: row.document_count,
    storageUsedBytes: row.storage_used_bytes,
    storageQuotaBytes: plan.storage_quota_bytes,
    documentQuota: plan.document_quota,
    apiRequestCount: Number(reqCount?.total ?? 0),
    recentDocuments: (recent.results ?? []).map((d) => ({
      id: d.document_id,
      name: d.name,
      visibility: d.visibility,
      size: d.size,
      version: d.version,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    })),
  });
});

analyticsRoutes.get("/documents/:id", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (doc.user_id !== user.sub && user.role !== "admin") {
    throw new AppError(403, "FORBIDDEN", "Not allowed");
  }
  const stats = await c.env.DB.prepare(
    "SELECT * FROM document_stats WHERE document_id = ?",
  )
    .bind(id)
    .first();
  return c.json({
    documentId: id,
    totalRequests: Number(stats?.total_requests ?? 0),
    lastAccessedAt: stats?.last_accessed_at ?? null,
  });
});

analyticsRoutes.get("/admin", requireAdmin, async (c) => {
  const users = await c.env.DB.prepare("SELECT COUNT(*) as c FROM users").first<{ c: number }>();
  const docs = await c.env.DB.prepare(
    "SELECT COUNT(*) as c FROM documents WHERE is_deleted = 0",
  ).first<{ c: number }>();
  const storage = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(size), 0) as s FROM documents WHERE is_deleted = 0",
  ).first<{ s: number }>();
  const requests = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(total_requests), 0) as r FROM document_stats",
  ).first<{ r: number }>();

  return c.json({
    totalUsers: Number(users?.c ?? 0),
    totalDocuments: Number(docs?.c ?? 0),
    storageUsedBytes: Number(storage?.s ?? 0),
    apiRequestCount: Number(requests?.r ?? 0),
  });
});
