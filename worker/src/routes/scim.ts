import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { createId, nowIso } from "../lib/ids";
import type { AppBindings } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { findUserByEmail, findUserById, registerUser } from "../services/users";

export const scimRoutes = new Hono<AppBindings>();

/** Minimal SCIM 2.0 Users stub (RFC 7644-ish). Auth via Bearer JWT or API key. */
scimRoutes.use("*", requireAuth);

scimRoutes.get("/Users", async (c) => {
  const startIndex = Math.max(1, Number(c.req.query("startIndex") ?? "1") || 1);
  const count = Math.min(100, Math.max(1, Number(c.req.query("count") ?? "20") || 20));
  const filter = c.req.query("filter");

  let rows: Array<{ id: string; name: string; email: string; is_active: number }> = [];

  if (filter) {
    const emailMatch = /userName eq "([^"]+)"/i.exec(filter);
    if (emailMatch?.[1]) {
      const user = await findUserByEmail(c.env.DB, emailMatch[1]);
      if (user) {
        rows = [{ id: user.id, name: user.name, email: user.email, is_active: user.is_active }];
      }
    }
  } else {
    const result = await c.env.DB.prepare(
      `SELECT id, name, email, is_active FROM users ORDER BY created_at LIMIT ? OFFSET ?`,
    )
      .bind(count, startIndex - 1)
      .all<{ id: string; name: string; email: string; is_active: number }>();
    rows = result.results ?? [];
  }

  const resources = rows.map(toScimUser);
  return c.json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: resources.length,
    startIndex,
    itemsPerPage: resources.length,
    Resources: resources,
  });
});

scimRoutes.get("/Users/:id", async (c) => {
  const id = c.req.param("id")!;
  const user = await findUserById(c.env.DB, id);
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");
  return c.json(toScimUser(user));
});

scimRoutes.post("/Users", async (c) => {
  const body = z
    .object({
      schemas: z.array(z.string()).optional(),
      userName: z.string().email(),
      displayName: z.string().min(1).max(120).optional(),
      name: z
        .object({
          formatted: z.string().optional(),
          givenName: z.string().optional(),
          familyName: z.string().optional(),
        })
        .optional(),
      active: z.boolean().optional(),
      emails: z
        .array(
          z.object({
            value: z.string().email(),
            primary: z.boolean().optional(),
            type: z.string().optional(),
          }),
        )
        .optional(),
    })
    .parse(await c.req.json());

  const email = body.userName.trim().toLowerCase();
  const existing = await findUserByEmail(c.env.DB, email);
  if (existing) {
    throw new AppError(409, "CONFLICT", "User already exists");
  }

  const displayName =
    body.displayName?.trim() ||
    body.name?.formatted?.trim() ||
    [body.name?.givenName, body.name?.familyName].filter(Boolean).join(" ").trim() ||
    email.split("@")[0]!;

  // SCIM provisioning creates users with a random password; IdP manages auth thereafter.
  const password = `scim-${createId()}-${createId()}`;
  const user = await registerUser(c.env.DB, {
    name: displayName,
    email,
    password,
  });

  if (body.active === false) {
    await c.env.DB.prepare("UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?")
      .bind(nowIso(), user.id)
      .run();
    const refreshed = await findUserById(c.env.DB, user.id);
    return c.json(toScimUser(refreshed ?? user), 201);
  }

  return c.json(toScimUser(user), 201);
});

function toScimUser(user: {
  id: string;
  name: string;
  email: string;
  is_active: number;
}) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: user.id,
    userName: user.email,
    displayName: user.name,
    active: Boolean(user.is_active),
    emails: [{ value: user.email, primary: true, type: "work" }],
    meta: {
      resourceType: "User",
      location: `/scim/v2/Users/${user.id}`,
    },
  };
}
