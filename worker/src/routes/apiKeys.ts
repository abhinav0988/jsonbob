import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { createApiKey, listApiKeys, revokeApiKey } from "../services/apiKeys";

export const apiKeyRoutes = new Hono<AppBindings>();

apiKeyRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const items = await listApiKeys(c.env.DB, user.sub);
  return c.json({ items });
});

apiKeyRoutes.post("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = z
    .object({
      name: z.string().min(1).max(120).nullable().optional(),
    })
    .parse(await c.req.json().catch(() => ({})));
  const created = await createApiKey(c.env.DB, user.sub, body.name);
  return c.json(created, 201);
});

apiKeyRoutes.delete("/:id", requireAuth, async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id")!;
  await revokeApiKey(c.env.DB, id, user.sub);
  return c.json({ ok: true });
});
