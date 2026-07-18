import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "../lib/errors";
import type { AppBindings } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { findUserById, toPublicUser } from "../services/users";
import { softDeleteDocument, getDocumentByPublicId, mapDocumentSummary } from "../services/documents";
import { nowIso } from "../lib/ids";
import { upsertPlanForRole } from "../services/plans";
import type { Role } from "../types";

export const adminRoutes = new Hono<AppBindings>();

adminRoutes.use("*", requireAdmin);

adminRoutes.get("/users", async (c) => {
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 20)));
  const offset = (page - 1) * limit;
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(limit, offset)
    .all();
  return c.json({
    items: (results ?? []).map((u) => toPublicUser(u as never)),
    page,
    limit,
  });
});

adminRoutes.patch("/users/:id", async (c) => {
  const id = c.req.param("id")!;
  const body = z
    .object({
      role: z.enum(["free", "premium", "admin"]).optional(),
      isActive: z.boolean().optional(),
    })
    .parse(await c.req.json());

  const user = await findUserById(c.env.DB, id);
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");

  const role = (body.role ?? user.role) as Role;
  const isActive = body.isActive === undefined ? user.is_active : body.isActive ? 1 : 0;
  const now = nowIso();

  await c.env.DB.prepare(
    `UPDATE users SET role = ?, is_active = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(role, isActive, now, id)
    .run();

  if (body.role) await upsertPlanForRole(c.env.DB, id, role);

  const updated = await findUserById(c.env.DB, id);
  return c.json({ user: toPublicUser(updated!) });
});

adminRoutes.get("/documents", async (c) => {
  const search = c.req.query("search")?.trim();
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 20)));
  const offset = (page - 1) * limit;

  if (search) {
    const like = `%${search}%`;
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM documents
       WHERE is_deleted = 0 AND (document_id LIKE ? OR IFNULL(name, '') LIKE ?)
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(like, like, limit, offset)
      .all();
    return c.json({
      items: (results ?? []).map((d) => mapDocumentSummary(d as never, c.env)),
      page,
      limit,
    });
  }

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM documents WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(limit, offset)
    .all();
  return c.json({
    items: (results ?? []).map((d) => mapDocumentSummary(d as never, c.env)),
    page,
    limit,
  });
});

adminRoutes.delete("/documents/:id", async (c) => {
  const id = c.req.param("id")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  await softDeleteDocument(c.env, doc);
  return c.json({ ok: true });
});
