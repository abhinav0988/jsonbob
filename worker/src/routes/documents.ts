import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "../lib/errors";
import type { AppBindings } from "../middleware/auth";
import { optionalAuth, requireAuth } from "../middleware/auth";
import {
  assertCanAccessDocument,
  createDocument,
  getDocumentByPublicId,
  getVersionContent,
  listDeletedDocuments,
  listUserDocuments,
  listVersions,
  mapDocumentSummary,
  patchDocumentMeta,
  purgeDocument,
  readDocumentBody,
  restoreDocument,
  restoreVersion,
  softDeleteDocument,
  updateDocumentContent,
} from "../services/documents";
import {
  createOneTimeToken,
  getFolderMap,
  listFolders,
  setDocumentFolder,
} from "../services/foldersOt";
import {
  getDocumentSchema,
  getTagMap,
  getTagsForDocuments,
  listAudit,
  listFavoriteIds,
  setDocumentSchema,
  setDocumentTags,
  setFavorite,
  writeAudit,
} from "../services/documentMeta";

const visibilitySchema = z.enum(["public", "private", "password"]);

const createSchema = z.object({
  content: z.unknown(),
  visibility: visibilitySchema.optional(),
  name: z.string().max(200).nullable().optional(),
  expireAt: z.string().datetime().nullable().optional(),
  password: z.string().min(4).max(128).nullable().optional(),
});

export const documentRoutes = new Hono<AppBindings>();

documentRoutes.post("/", optionalAuth, async (c) => {
  const body = createSchema.parse(await c.req.json());
  if (body.content === undefined) {
    throw new AppError(400, "VALIDATION_ERROR", "content is required");
  }
  const user = c.get("user");
  const created = await createDocument(c.env, {
    content: body.content,
    userId: user?.sub ?? null,
    visibility: body.visibility,
    name: body.name,
    expireAt: body.expireAt,
    password: body.password,
  });
  return c.json(created, 201);
});

documentRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 20)));
  const favoriteQ = c.req.query("favorite");
  const docs = await listUserDocuments(c.env.DB, user.sub, {
    page,
    limit,
    search: c.req.query("search") ?? undefined,
    visibility: c.req.query("visibility") ?? undefined,
    from: c.req.query("from") ?? undefined,
    to: c.req.query("to") ?? undefined,
    folder: c.req.query("folder") ?? undefined,
    tag: c.req.query("tag") ?? undefined,
    favorite: favoriteQ === "1" || favoriteQ === "true",
  });
  const ids = docs.map((d) => d.document_id);
  const [tags, favorites, folderMap] = await Promise.all([
    getTagsForDocuments(c.env.DB, user.sub, ids),
    listFavoriteIds(c.env.DB, user.sub),
    getFolderMap(c.env.DB, user.sub),
  ]);
  const favSet = new Set(favorites);
  return c.json({
    items: docs.map((d) => ({
      ...mapDocumentSummary(d, c.env),
      tags: tags[d.document_id] ?? [],
      favorite: favSet.has(d.document_id),
      folder: folderMap[d.document_id] ?? null,
    })),
    page,
    limit,
  });
});

documentRoutes.get("/meta", requireAuth, async (c) => {
  const user = c.get("user")!;
  const [folders, folderMap, tags, favorites] = await Promise.all([
    listFolders(c.env.DB, user.sub),
    getFolderMap(c.env.DB, user.sub),
    getTagMap(c.env.DB, user.sub),
    listFavoriteIds(c.env.DB, user.sub),
  ]);
  return c.json({ folders, folderMap, tags, favorites });
});

documentRoutes.get("/audit", requireAuth, async (c) => {
  const user = c.get("user")!;
  const items = await listAudit(c.env.DB, user.sub, {
    limit: Number(c.req.query("limit") ?? 40),
  });
  return c.json({ items });
});

// Trash routes must be registered before /:id
documentRoutes.get("/trash", requireAuth, async (c) => {
  const user = c.get("user")!;
  const docs = await listDeletedDocuments(c.env.DB, user.sub);
  return c.json({
    items: docs.map((d) => mapDocumentSummary(d, c.env)),
  });
});

documentRoutes.post("/trash/:id/restore", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user")!;
  const restored = await restoreDocument(c.env, id, user.sub);
  return c.json(mapDocumentSummary(restored!, c.env));
});

documentRoutes.delete("/trash/:id", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user")!;
  await purgeDocument(c.env, id, user.sub);
  return c.json({ ok: true });
});

documentRoutes.get("/folders", requireAuth, async (c) => {
  const user = c.get("user")!;
  const folders = await listFolders(c.env.DB, user.sub);
  const map = await getFolderMap(c.env.DB, user.sub);
  return c.json({ folders, map });
});

documentRoutes.put("/:id/folder", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (doc.user_id !== user.sub) throw new AppError(403, "FORBIDDEN", "Only the owner can set folder");
  const body = z.object({ folder: z.string().max(120).nullable() }).parse(await c.req.json());
  await setDocumentFolder(c.env.DB, user.sub, id, body.folder);
  await writeAudit(c.env.DB, {
    userId: user.sub,
    action: "document.folder",
    resourceType: "document",
    resourceId: id,
    meta: { folder: body.folder },
  });
  return c.json({ ok: true, folder: body.folder });
});

documentRoutes.put("/:id/tags", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (doc.user_id !== user.sub) throw new AppError(403, "FORBIDDEN", "Only the owner can set tags");
  const body = z.object({ tags: z.array(z.string().max(40)).max(20) }).parse(await c.req.json());
  const tags = await setDocumentTags(c.env.DB, user.sub, id, body.tags);
  await writeAudit(c.env.DB, {
    userId: user.sub,
    action: "document.tags",
    resourceType: "document",
    resourceId: id,
    meta: { tags },
  });
  return c.json({ ok: true, tags });
});

documentRoutes.put("/:id/favorite", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (doc.user_id !== user.sub) throw new AppError(403, "FORBIDDEN", "Only the owner can favorite");
  const body = z.object({ favorite: z.boolean() }).parse(await c.req.json());
  const favorite = await setFavorite(c.env.DB, user.sub, id, body.favorite);
  await writeAudit(c.env.DB, {
    userId: user.sub,
    action: body.favorite ? "document.favorite" : "document.unfavorite",
    resourceType: "document",
    resourceId: id,
  });
  return c.json({ ok: true, favorite });
});

documentRoutes.get("/:id/schema", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (doc.user_id !== user.sub) throw new AppError(403, "FORBIDDEN", "Only the owner can read schema");
  const row = await getDocumentSchema(c.env.DB, id, user.sub);
  return c.json({ schema: row?.schema_json ?? null });
});

documentRoutes.put("/:id/schema", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (doc.user_id !== user.sub) throw new AppError(403, "FORBIDDEN", "Only the owner can set schema");
  const body = z.object({ schema: z.string().max(200_000).nullable() }).parse(await c.req.json());
  const schema = await setDocumentSchema(c.env.DB, user.sub, id, body.schema);
  await writeAudit(c.env.DB, {
    userId: user.sub,
    action: "document.schema",
    resourceType: "document",
    resourceId: id,
  });
  return c.json({ ok: true, schema });
});

documentRoutes.post("/:id/one-time", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (doc.user_id !== user.sub) throw new AppError(403, "FORBIDDEN", "Only the owner can mint one-time links");
  const token = await createOneTimeToken(c.env.DB, id, user.sub);
  await writeAudit(c.env.DB, {
    userId: user.sub,
    action: "document.one_time",
    resourceType: "document",
    resourceId: id,
  });
  return c.json({
    token,
    url: `${c.env.APP_URL}/view/${id}?ot=${token}`,
  });
});

documentRoutes.get("/:id", optionalAuth, async (c) => {
  const id = c.req.param("id")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  await assertCanAccessDocument(doc, c.get("user")?.sub, c.req.header("X-Document-Password"));
  const content = await readDocumentBody(c.env.DOCUMENTS, doc);
  return c.json({
    ...mapDocumentSummary(doc, c.env),
    content,
  });
});

documentRoutes.put("/:id", optionalAuth, async (c) => {
  const id = c.req.param("id")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");

  const user = c.get("user");
  if (doc.user_id) {
    if (!user || user.sub !== doc.user_id) {
      throw new AppError(403, "FORBIDDEN", "Only the owner can update this document");
    }
  }

  const body = z.object({ content: z.unknown() }).parse(await c.req.json());
  const version = await updateDocumentContent(c.env, doc, body.content, user?.sub ?? null);
  return c.json({ id, version, updatedAt: new Date().toISOString() });
});

documentRoutes.patch("/:id", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (doc.user_id !== user.sub && user.role !== "admin") {
    throw new AppError(403, "FORBIDDEN", "Only the owner can update metadata");
  }
  const body = z
    .object({
      name: z.string().max(200).nullable().optional(),
      visibility: visibilitySchema.optional(),
      expireAt: z.string().datetime().nullable().optional(),
      password: z.string().min(4).max(128).nullable().optional(),
    })
    .parse(await c.req.json());
  await patchDocumentMeta(c.env, doc, body);
  await writeAudit(c.env.DB, {
    userId: user.sub,
    action: "document.meta",
    resourceType: "document",
    resourceId: id,
    meta: {
      visibility: body.visibility,
      expireAt: body.expireAt,
      name: body.name,
    },
  });
  const updated = await getDocumentByPublicId(c.env.DB, id);
  return c.json(mapDocumentSummary(updated!, c.env));
});

documentRoutes.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (doc.user_id !== user.sub && user.role !== "admin") {
    throw new AppError(403, "FORBIDDEN", "Only the owner can delete this document");
  }
  await softDeleteDocument(c.env, doc);
  await writeAudit(c.env.DB, {
    userId: user.sub,
    action: "document.delete",
    resourceType: "document",
    resourceId: id,
  });
  return c.json({ ok: true });
});

documentRoutes.post("/:id/duplicate", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (doc.user_id !== user.sub) {
    throw new AppError(403, "FORBIDDEN", "Only the owner can duplicate this document");
  }
  const content = await readDocumentBody(c.env.DOCUMENTS, doc);
  const created = await createDocument(c.env, {
    content,
    userId: user.sub,
    visibility: doc.visibility === "password" ? "private" : doc.visibility,
    name: doc.name ? `${doc.name} (copy)` : `${doc.document_id}-copy`,
  });
  return c.json(created, 201);
});

documentRoutes.get("/:id/download", optionalAuth, async (c) => {
  const id = c.req.param("id")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  await assertCanAccessDocument(doc, c.get("user")?.sub, c.req.header("X-Document-Password"));
  const content = await readDocumentBody(c.env.DOCUMENTS, doc);
  return new Response(JSON.stringify(content, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${id}.json"`,
    },
  });
});

documentRoutes.get("/:id/versions", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (doc.user_id !== user.sub && user.role !== "admin") {
    throw new AppError(403, "FORBIDDEN", "Only the owner can view versions");
  }
  const versions = await listVersions(c.env.DB, id);
  return c.json({
    items: versions.map((v) => ({
      version: v.version,
      size: v.size,
      createdBy: v.created_by,
      createdAt: v.created_at,
    })),
  });
});

documentRoutes.get("/:id/versions/:version", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const version = Number(c.req.param("version"));
  const user = c.get("user")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (doc.user_id !== user.sub && user.role !== "admin") {
    throw new AppError(403, "FORBIDDEN", "Only the owner can view versions");
  }
  const { meta, content } = await getVersionContent(c.env, id, version);
  return c.json({
    version: meta.version,
    size: meta.size,
    createdAt: meta.created_at,
    content,
  });
});

documentRoutes.post("/:id/versions/:version/restore", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const version = Number(c.req.param("version"));
  const user = c.get("user")!;
  const doc = await getDocumentByPublicId(c.env.DB, id);
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  if (doc.user_id !== user.sub) {
    throw new AppError(403, "FORBIDDEN", "Only the owner can restore versions");
  }
  const next = await restoreVersion(c.env, doc, version, user.sub);
  return c.json({ id, restoredFrom: version, version: next });
});
