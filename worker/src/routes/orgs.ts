import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { addMember, createOrg, listOrgsForUser, toPublicOrg } from "../services/orgs";

export const orgRoutes = new Hono<AppBindings>();

orgRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const items = await listOrgsForUser(c.env.DB, user.sub);
  return c.json({ items: items.map(toPublicOrg) });
});

orgRoutes.post("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = z
    .object({
      name: z.string().min(1).max(120),
      slug: z.string().min(1).max(64).optional(),
    })
    .parse(await c.req.json());
  const org = await createOrg(c.env.DB, user.sub, body);
  return c.json({ org: toPublicOrg({ ...org, member_role: "owner" }) }, 201);
});

orgRoutes.post("/:id/members", requireAuth, async (c) => {
  const user = c.get("user")!;
  const orgId = c.req.param("id")!;
  const body = z
    .object({
      userId: z.string().min(1),
      role: z.string().min(1).max(32).optional(),
    })
    .parse(await c.req.json());
  const member = await addMember(c.env.DB, orgId, user.sub, body);
  return c.json(
    {
      member: member
        ? {
            orgId: member.org_id,
            userId: member.user_id,
            role: member.role,
            createdAt: member.created_at,
          }
        : null,
    },
    201,
  );
});
