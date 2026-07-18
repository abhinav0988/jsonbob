import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "../lib/errors";
import type { AppBindings } from "../middleware/auth";
import { optionalAuth } from "../middleware/auth";
import { getCachedJson, setCachedJson } from "../services/cache";
import {
  assertCanAccessDocument,
  createDocument,
  getDocumentByPublicId,
  readDocumentBody,
  softDeleteDocument,
  updateDocumentContent,
} from "../services/documents";
import { enqueueAnalytics, hashIp } from "../services/queues";

export const publicJsonRoutes = new Hono<AppBindings>();

publicJsonRoutes.post("/api/json", optionalAuth, async (c) => {
  const raw = await c.req.json();
  let content: unknown = raw;
  let visibility: "public" | "private" | "password" | undefined;
  let name: string | null | undefined;
  let expireAt: string | null | undefined;
  let password: string | null | undefined;

  if (
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    "content" in (raw as Record<string, unknown>)
  ) {
    const parsed = z
      .object({
        content: z.unknown(),
        visibility: z.enum(["public", "private", "password"]).optional(),
        name: z.string().max(200).nullable().optional(),
        expireAt: z.string().datetime().nullable().optional(),
        password: z.string().min(4).max(128).nullable().optional(),
      })
      .parse(raw);
    content = parsed.content;
    visibility = parsed.visibility;
    name = parsed.name;
    expireAt = parsed.expireAt;
    password = parsed.password;
  }

  const user = c.get("user");
  const created = await createDocument(c.env, {
    content,
    userId: user?.sub ?? null,
    visibility,
    name,
    expireAt,
    password,
  });

  return c.json({ id: created.id, url: created.url }, 201);
});

publicJsonRoutes.get("/json/:id", optionalAuth, async (c) => {
  const id = c.req.param("id")!;
  const cached = await getCachedJson(c.env.CACHE, id);
  const password = c.req.header("X-Document-Password");
  const user = c.get("user");
  const ipHash = await hashIp(c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For"));

  if (cached && !password && !user) {
    const doc = await getDocumentByPublicId(c.env.DB, id);
    if (doc && doc.visibility === "public") {
      try {
        assertCanAccessDocument(doc, undefined, undefined);
        c.executionCtx.waitUntil(
          enqueueAnalytics(c.env, {
            documentId: id,
            userId: doc.user_id,
            ipHash,
            userAgent: c.req.header("User-Agent") ?? null,
            method: "GET",
            statusCode: 200,
          }),
        );
        return new Response(cached, {
          headers: { "Content-Type": "application/json", "X-Cache": "HIT" },
        });
      } catch {
        // fall through
      }
    }
  }

  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  await assertCanAccessDocument(doc, user?.sub, password);
  const content = await readDocumentBody(c.env.DOCUMENTS, doc);
  const body = JSON.stringify(content);

  if (doc.visibility === "public") {
    await setCachedJson(c.env.CACHE, id, body);
  }

  c.executionCtx.waitUntil(
    enqueueAnalytics(c.env, {
      documentId: id,
      userId: doc.user_id,
      ipHash,
      userAgent: c.req.header("User-Agent") ?? null,
      method: "GET",
      statusCode: 200,
    }),
  );

  return new Response(body, {
    headers: { "Content-Type": "application/json", "X-Cache": "MISS" },
  });
});

publicJsonRoutes.put("/json/:id", optionalAuth, async (c) => {
  const id = c.req.param("id")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  const user = c.get("user");
  if (doc.user_id) {
    if (!user || user.sub !== doc.user_id) {
      throw new AppError(403, "FORBIDDEN", "Only the owner can update this document");
    }
  }
  const content = await c.req.json();
  const version = await updateDocumentContent(c.env, doc, content, user?.sub ?? null);
  return c.json({ id, version });
});

publicJsonRoutes.delete("/json/:id", optionalAuth, async (c) => {
  const id = c.req.param("id")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  const user = c.get("user");
  if (doc.user_id) {
    if (!user || (user.sub !== doc.user_id && user.role !== "admin")) {
      throw new AppError(403, "FORBIDDEN", "Only the owner can delete this document");
    }
  }
  await softDeleteDocument(c.env, doc);
  return c.json({ ok: true });
});
