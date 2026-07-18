import { createId, nowIso } from "../lib/ids";
import { AppError } from "../lib/errors";

export type OrgRow = {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  created_at: string;
};

export type OrgMemberRow = {
  org_id: string;
  user_id: string;
  role: string;
  created_at: string;
};

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function createOrg(
  db: D1Database,
  ownerUserId: string,
  input: { name: string; slug?: string },
) {
  const name = input.name.trim();
  if (!name) throw new AppError(400, "VALIDATION_ERROR", "Organization name is required");

  let slug = (input.slug?.trim() || slugify(name)) || createId().slice(0, 8).toLowerCase();
  slug = slugify(slug);
  if (!slug) throw new AppError(400, "VALIDATION_ERROR", "Invalid organization slug");

  const existing = await db
    .prepare("SELECT id FROM orgs WHERE slug = ?")
    .bind(slug)
    .first<{ id: string }>();
  if (existing) throw new AppError(409, "CONFLICT", "Organization slug already exists");

  const id = createId();
  const now = nowIso();

  await db.batch([
    db
      .prepare(
        `INSERT INTO orgs (id, name, slug, owner_user_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, name, slug, ownerUserId, now),
    db
      .prepare(
        `INSERT INTO org_members (org_id, user_id, role, created_at)
         VALUES (?, ?, 'owner', ?)`,
      )
      .bind(id, ownerUserId, now),
  ]);

  const org = await db.prepare("SELECT * FROM orgs WHERE id = ?").bind(id).first<OrgRow>();
  if (!org) throw new AppError(500, "INTERNAL", "Failed to create organization");
  return org;
}

export async function listOrgsForUser(db: D1Database, userId: string) {
  return db
    .prepare(
      `SELECT o.*, m.role AS member_role
       FROM orgs o
       INNER JOIN org_members m ON m.org_id = o.id
       WHERE m.user_id = ?
       ORDER BY o.created_at DESC`,
    )
    .bind(userId)
    .all<OrgRow & { member_role: string }>()
    .then((r) => r.results ?? []);
}

export async function addMember(
  db: D1Database,
  orgId: string,
  actorUserId: string,
  input: { userId: string; role?: string },
) {
  const org = await db.prepare("SELECT * FROM orgs WHERE id = ?").bind(orgId).first<OrgRow>();
  if (!org) throw new AppError(404, "NOT_FOUND", "Organization not found");

  const actor = await db
    .prepare("SELECT role FROM org_members WHERE org_id = ? AND user_id = ?")
    .bind(orgId, actorUserId)
    .first<{ role: string }>();
  if (!actor || (actor.role !== "owner" && actor.role !== "admin")) {
    throw new AppError(403, "FORBIDDEN", "Only org owners or admins can add members");
  }

  const target = await db
    .prepare("SELECT id FROM users WHERE id = ?")
    .bind(input.userId)
    .first<{ id: string }>();
  if (!target) throw new AppError(404, "NOT_FOUND", "User not found");

  const role = input.role?.trim() || "member";
  const now = nowIso();

  const existing = await db
    .prepare("SELECT user_id FROM org_members WHERE org_id = ? AND user_id = ?")
    .bind(orgId, input.userId)
    .first();
  if (existing) throw new AppError(409, "CONFLICT", "User is already a member");

  await db
    .prepare(
      `INSERT INTO org_members (org_id, user_id, role, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(orgId, input.userId, role, now)
    .run();

  return db
    .prepare("SELECT * FROM org_members WHERE org_id = ? AND user_id = ?")
    .bind(orgId, input.userId)
    .first<OrgMemberRow>();
}

export function toPublicOrg(org: OrgRow & { member_role?: string }) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    ownerUserId: org.owner_user_id,
    createdAt: org.created_at,
    ...(org.member_role ? { role: org.member_role } : {}),
  };
}
